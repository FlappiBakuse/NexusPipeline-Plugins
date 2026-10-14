using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed class HoyoLabClient
{
    private const string Origin = "https://act.hoyolab.com";
    private const string UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    private readonly IPluginHttpClientFactory _http;

    public HoyoLabClient(IPluginHttpClientFactory http)
    {
        _http = http;
    }

    public async Task<CheckInResult> SignAsync(
        GameDefinition game,
        string cookie,
        CancellationToken cancellationToken, CheckInDiagnostics? diagnostics = null)
    {
        bool submitted = false;
        try
        {
            using HttpClient client = _http.CreateClient(game.Os.InfoEndpoint, TimeSpan.FromSeconds(30));
            using JsonDocument info = await SendAsync(
                client,
                game.Os.InfoEndpoint,
                HttpMethod.Get,
                cookie,
                game.Os.SignGame,
                game.Os.ActId,
                game.Os.Referer,
                body: null,
                cancellationToken, diagnostics, game.Code, "info").ConfigureAwait(false);
            CheckInResult? early = ReadCommonResponse(info, "os", game.Code);
            if (early is not null) return early;
            bool? signed = CheckInResponse.Signed(info);
            if (signed == true) return Already(game.Code);
            if (IsFirstBind(info)) return new CheckInResult("os", game.Code, "first_bind", "尚未绑定签到活动", false);

            if (signed is null) return new CheckInResult("os", game.Code, "verification_state_unknown", "签到状态格式未知", false);
            submitted = true;
            using JsonDocument sign = await SendAsync(
                client,
                game.Os.SignEndpoint,
                HttpMethod.Post,
                cookie,
                game.Os.SignGame,
                game.Os.ActId,
                game.Os.Referer,
                JsonSerializer.Serialize(new { lang = "en-us", act_id = game.Os.ActId }),
                cancellationToken, diagnostics, game.Code, "sign").ConfigureAwait(false);
            CheckInResult? signError = ReadCommonResponse(sign, "os", game.Code);
            if (signError is not null && signError.Code != "success_unconfirmed") return signError;
            using JsonDocument confirmation = await SendAsync(client, game.Os.InfoEndpoint, HttpMethod.Get,
                cookie, game.Os.SignGame, game.Os.ActId, game.Os.Referer, null, cancellationToken, diagnostics, game.Code, "confirm").ConfigureAwait(false);
            return ReadCommonResponse(confirmation, "os", game.Code) is null && CheckInResponse.Signed(confirmation) == true
                ? new CheckInResult("os", game.Code, "success", "签到成功", true)
                : CheckInResponse.Unconfirmed("os", game.Code);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return submitted ? CheckInResponse.Unconfirmed("os", game.Code) : TransportError(game.Code);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (HttpRequestException)
        {
            return submitted ? CheckInResponse.Unconfirmed("os", game.Code) : TransportError(game.Code);
        }
        catch (JsonException)
        {
            return submitted ? CheckInResponse.Unconfirmed("os", game.Code) : TransportError(game.Code);
        }
        catch (InvalidOperationException)
        {
            return submitted ? CheckInResponse.Unconfirmed("os", game.Code) : TransportError(game.Code);
        }
        catch
        {
            return submitted ? CheckInResponse.Unconfirmed("os", game.Code) : TransportError(game.Code);
        }
    }

    private async Task<JsonDocument> SendAsync(
        HttpClient client,
        Uri endpoint,
        HttpMethod method,
        string cookie,
        string signGame,
        string actId,
        string referer,
        string? body,
        CancellationToken cancellationToken, CheckInDiagnostics? diagnostics, string game, string phase)
    {
        long started = Stopwatch.GetTimestamp();
        Uri requestUri = method == HttpMethod.Get
            ? new Uri(endpoint + "?lang=en-us&act_id=" + Uri.EscapeDataString(actId))
            : endpoint;
        using var request = new HttpRequestMessage(method, requestUri);
        if (body is not null)
        {
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        }
        request.Headers.Accept.Clear();
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.TryAddWithoutValidation("Origin", Origin);
        request.Headers.TryAddWithoutValidation("Referer", referer);
        request.Headers.TryAddWithoutValidation("Cookie", cookie);
        request.Headers.TryAddWithoutValidation("x-rpc-signgame", signGame);
        request.Headers.UserAgent.ParseAdd(UserAgent);
        using HttpResponseMessage response = await client.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken).ConfigureAwait(false);
        bool inspected = false;
        try
        {
            return await CheckInResponse.ReadAsync(response, cancellationToken, root =>
            {
                inspected = true;
                diagnostics?.Response("os", game, phase, (int)response.StatusCode, root, (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds);
            }).ConfigureAwait(false);
        }
        catch
        {
            if (!inspected) diagnostics?.Response("os", game, phase, (int)response.StatusCode, null, (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds);
            throw;
        }
    }

    internal static CheckInResult? ReadCommonResponse(JsonDocument document, string platform, string gameCode)
    {
        JsonElement root = document.RootElement;
        try { CheckInResponse.Validate(root); }
        catch (JsonException) { return new CheckInResult(platform, gameCode, "verification_state_unknown", "接口响应格式未知", false); }
        int retcode = ReadRetcode(root);
        if (retcode == 0)
        {
            return CheckInResponse.Verification(root) switch
            {
                VerificationState.NoChallenge => null,
                VerificationState.ChallengeRequired => new CheckInResult(platform, gameCode, "captcha_required", "官方接口要求验证，签到尚未完成", false),
                VerificationState.Incomplete => new CheckInResult(platform, gameCode, "challenge_incomplete", "验证信息不完整", false),
                _ => new CheckInResult(platform, gameCode, "verification_state_unknown", "验证状态未知", false),
            };
        }
        return retcode switch
        {
            -5003 => CheckInResponse.Unconfirmed(platform, gameCode),
            -100 => new CheckInResult(platform, gameCode, "invalid_cookie", "Cookie 无效或未登录", false),
            -10002 => new CheckInResult(platform, gameCode, "game_not_available", "当前游戏暂不可签到", false),
            -500 => new CheckInResult(platform, gameCode, "rate_limited", "请求过于频繁", false),
            _ => new CheckInResult(platform, gameCode, "api_error", "接口返回未知错误", false),
        };
    }

    internal static bool IsFirstBind(JsonDocument document) =>
        ReadBool(document.RootElement, "data", "first_bind")
        || ReadBool(document.RootElement, "data", "firstBind");

    internal static int ReadRetcode(JsonElement root) =>
        root.ValueKind == JsonValueKind.Object && root.TryGetProperty("retcode", out JsonElement value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out int retcode) ? retcode : int.MinValue;

    internal static bool ReadBool(JsonElement root, string parent, string property)
    {
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty(parent, out JsonElement data)
            || data.ValueKind != JsonValueKind.Object
            || !data.TryGetProperty(property, out JsonElement value))
        {
            return false;
        }
        return value.ValueKind == JsonValueKind.True;
    }

    private static CheckInResult Already(string gameCode, string platform = "os") =>
        new(platform, gameCode, "already", "今日已签到", true);

    private static CheckInResult TransportError(string gameCode) =>
        new("os", gameCode, "transport_error", "请求失败或响应格式无效", false);
}
