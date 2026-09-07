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
        CancellationToken cancellationToken)
    {
        try
        {
            using HttpClient client = _http.CreateClient(game.Os.InfoEndpoint, TimeSpan.FromSeconds(30));
            JsonDocument info = await SendAsync(
                client,
                game.Os.InfoEndpoint,
                HttpMethod.Get,
                cookie,
                game.Os.SignGame,
                game.Os.ActId,
                body: null,
                cancellationToken).ConfigureAwait(false);
            CheckInResult? early = ReadCommonResponse(info, "os", game.Code);
            if (early is not null) return early;
            if (IsAlreadySigned(info)) return Already(game.Code);
            if (IsFirstBind(info)) return new CheckInResult("os", game.Code, "first_bind", "尚未绑定签到活动", false);

            using JsonDocument sign = await SendAsync(
                client,
                game.Os.SignEndpoint,
                HttpMethod.Post,
                cookie,
                game.Os.SignGame,
                game.Os.ActId,
                JsonSerializer.Serialize(new { lang = "en-us", act_id = game.Os.ActId }),
                cancellationToken).ConfigureAwait(false);
            return MapSignResponse(sign, "os", game.Code);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return TransportError(game.Code);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (HttpRequestException)
        {
            return TransportError(game.Code);
        }
        catch (JsonException)
        {
            return TransportError(game.Code);
        }
        catch (InvalidOperationException)
        {
            return TransportError(game.Code);
        }
        catch
        {
            return TransportError(game.Code);
        }
    }

    private async Task<JsonDocument> SendAsync(
        HttpClient client,
        Uri endpoint,
        HttpMethod method,
        string cookie,
        string signGame,
        string actId,
        string? body,
        CancellationToken cancellationToken)
    {
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
        request.Headers.TryAddWithoutValidation("Referer", Origin + "/");
        request.Headers.TryAddWithoutValidation("Cookie", cookie);
        request.Headers.TryAddWithoutValidation("x-rpc-signgame", signGame);
        request.Headers.UserAgent.ParseAdd(UserAgent);
        using HttpResponseMessage response = await client.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"HTTP {(int)response.StatusCode}");
        }
        await using Stream stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        return await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    internal static CheckInResult? ReadCommonResponse(JsonDocument document, string platform, string gameCode)
    {
        JsonElement root = document.RootElement;
        if (HasCaptcha(root))
        {
            return new CheckInResult(platform, gameCode, "captcha_required", "需要手动完成验证码，本次已停止", false);
        }
        int retcode = ReadRetcode(root);
        return retcode switch
        {
            0 => null,
            -5003 => Already(gameCode, platform),
            -100 => new CheckInResult(platform, gameCode, "invalid_cookie", "Cookie 无效或未登录", false),
            -10002 => new CheckInResult(platform, gameCode, "game_not_available", "当前游戏暂不可签到", false),
            -500 => new CheckInResult(platform, gameCode, "rate_limited", "请求过于频繁", false),
            _ => new CheckInResult(platform, gameCode, "api_error", "接口返回未知错误", false),
        };
    }

    internal static CheckInResult MapSignResponse(JsonDocument document, string platform, string gameCode)
    {
        CheckInResult? common = ReadCommonResponse(document, platform, gameCode);
        if (common is not null) return common;
        return new CheckInResult(platform, gameCode, "success", "签到成功", true);
    }

    internal static bool IsAlreadySigned(JsonDocument document) =>
        ReadBool(document.RootElement, "data", "is_sign")
        || ReadBool(document.RootElement, "data", "isSign");

    internal static bool IsFirstBind(JsonDocument document) =>
        ReadBool(document.RootElement, "data", "first_bind")
        || ReadBool(document.RootElement, "data", "firstBind");

    internal static bool HasCaptcha(JsonElement root)
    {
        if (root.TryGetProperty("gt", out _) || root.TryGetProperty("challenge", out _)) return true;
        if (root.TryGetProperty("data", out JsonElement data)
            && data.ValueKind == JsonValueKind.Object
            && (data.TryGetProperty("gt", out _) || data.TryGetProperty("challenge", out _))) return true;
        string message = root.TryGetProperty("message", out JsonElement messageNode) ? messageNode.ToString() : "";
        return message.Contains("验证码", StringComparison.OrdinalIgnoreCase)
            || message.Contains("captcha", StringComparison.OrdinalIgnoreCase)
            || message.Contains("验证", StringComparison.OrdinalIgnoreCase);
    }

    internal static int ReadRetcode(JsonElement root) =>
        root.TryGetProperty("retcode", out JsonElement value) && value.TryGetInt32(out int retcode) ? retcode : int.MinValue;

    internal static bool ReadBool(JsonElement root, string parent, string property)
    {
        if (!root.TryGetProperty(parent, out JsonElement data)
            || data.ValueKind != JsonValueKind.Object
            || !data.TryGetProperty(property, out JsonElement value))
        {
            return false;
        }
        return value.ValueKind == JsonValueKind.True
            || value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out int number) && number != 0
            || value.ValueKind == JsonValueKind.String && bool.TryParse(value.GetString(), out bool parsed) && parsed;
    }

    private static CheckInResult Already(string gameCode, string platform = "os") =>
        new(platform, gameCode, "already", "今日已签到", true);

    private static CheckInResult TransportError(string gameCode) =>
        new("os", gameCode, "transport_error", "请求失败或响应格式无效", false);
}
