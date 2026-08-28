using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed class MiyousheClient
{
    private const string Origin = "https://www.miyoushe.com";
    private const string Referer = "https://www.miyoushe.com/ys/";
    private const string UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    private const string AppVersion = "2.109.0";
    private const string Channel = "miyousheluodi";
    private const string ClientType = "5";
    private const string Salt = "d9200c846b10886e8c874fc33c8f308b";
    private readonly IPluginHttpClientFactory _http;

    public MiyousheClient(IPluginHttpClientFactory http)
    {
        _http = http;
    }

    public async Task<CheckInResult> SignAsync(
        GameDefinition game,
        string cookie,
        string deviceId,
        CancellationToken cancellationToken)
    {
        try
        {
            using HttpClient client = _http.CreateClient(GameDefinitions.RolesEndpoint, TimeSpan.FromSeconds(30));
            using JsonDocument roles = await SendAsync(
                client,
                new Uri(GameDefinitions.RolesEndpoint + "?game_biz=" + Uri.EscapeDataString(game.Cn.GameBiz)),
                HttpMethod.Get,
                cookie,
                deviceId,
                game.Cn.SignGame,
                null,
                cancellationToken).ConfigureAwait(false);
            CheckInResult? roleError = MapGeneralResponse(roles, game.Code);
            if (roleError is not null) return roleError;
            List<Role> roleList = ReadRoles(roles);
            if (roleList.Count == 0)
            {
                return new CheckInResult("cn", game.Code, "game_not_available", "当前账号没有可签到角色", false);
            }

            bool signed = false;
            bool already = true;
            foreach (Role role in roleList)
            {
                using JsonDocument info = await SendAsync(
                    client,
                    BuildInfoUri(game.Cn.InfoEndpoint, game.Cn.ActId, role),
                    HttpMethod.Get,
                    cookie,
                    deviceId,
                    game.Cn.SignGame,
                    null,
                    cancellationToken).ConfigureAwait(false);
                CheckInResult? infoError = MapGeneralResponse(info, game.Code);
                if (infoError is not null) return infoError;
                if (HoyoLabClient.IsAlreadySigned(info)) continue;
                already = false;
                if (HoyoLabClient.IsFirstBind(info))
                {
                    return new CheckInResult("cn", game.Code, "first_bind", "尚未绑定签到活动", false);
                }

                using JsonDocument sign = await SendAsync(
                    client,
                    game.Cn.SignEndpoint,
                    HttpMethod.Post,
                    cookie,
                    deviceId,
                    game.Cn.SignGame,
                    JsonSerializer.Serialize(new { act_id = game.Cn.ActId, region = role.Region, uid = role.Uid }),
                    cancellationToken).ConfigureAwait(false);
                CheckInResult result = HoyoLabClient.MapSignResponse(sign, "cn", game.Code);
                if (!result.Success) return result;
                signed = true;
            }
            return signed
                ? new CheckInResult("cn", game.Code, "success", "签到成功", true)
                : already
                    ? new CheckInResult("cn", game.Code, "already", "今日已签到", true)
                    : new CheckInResult("cn", game.Code, "api_error", "接口返回未知状态", false);
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
        string deviceId,
        string signGame,
        string? body,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, endpoint);
        if (body is not null)
        {
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        }
        request.Headers.Accept.Clear();
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.TryAddWithoutValidation("Origin", Origin);
        request.Headers.TryAddWithoutValidation("Referer", Referer);
        request.Headers.TryAddWithoutValidation("Cookie", cookie);
        request.Headers.TryAddWithoutValidation("DS", GenerateDs());
        request.Headers.TryAddWithoutValidation("x-rpc-device_id", deviceId);
        request.Headers.TryAddWithoutValidation("x-rpc-channel", Channel);
        request.Headers.TryAddWithoutValidation("x-rpc-app_version", AppVersion);
        request.Headers.TryAddWithoutValidation("x-rpc-client_type", ClientType);
        request.Headers.TryAddWithoutValidation("x-rpc-signgame", signGame);
        request.Headers.TryAddWithoutValidation("X-Requested-With", "com.mihoyo.hyperion");
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

    internal static string GenerateDs()
    {
        long timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        Span<byte> randomBytes = stackalloc byte[6];
        RandomNumberGenerator.Fill(randomBytes);
        const string alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
        var random = new StringBuilder(6);
        foreach (byte value in randomBytes)
        {
            random.Append(alphabet[value % alphabet.Length]);
        }
        string randomText = random.ToString();
        string input = $"salt={Salt}&t={timestamp}&r={randomText}";
        string checksum = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(input))).ToLowerInvariant();
        return $"{timestamp},{randomText},{checksum}";
    }

    private static Uri BuildInfoUri(Uri endpoint, string actId, Role role) =>
        new(endpoint + $"?lang=zh-cn&act_id={Uri.EscapeDataString(actId)}&region={Uri.EscapeDataString(role.Region)}&uid={Uri.EscapeDataString(role.Uid)}");

    private static List<Role> ReadRoles(JsonDocument document)
    {
        if (!document.RootElement.TryGetProperty("data", out JsonElement data)
            || !data.TryGetProperty("list", out JsonElement list)
            || list.ValueKind != JsonValueKind.Array)
        {
            return new List<Role>();
        }
        var roles = new List<Role>();
        foreach (JsonElement item in list.EnumerateArray())
        {
            string uid = ReadString(item, "game_uid") ?? ReadString(item, "gameUid") ?? "";
            string region = ReadString(item, "region") ?? "";
            if (!string.IsNullOrWhiteSpace(uid) && !string.IsNullOrWhiteSpace(region))
            {
                roles.Add(new Role(uid, region));
            }
        }
        return roles;
    }

    private static CheckInResult? MapGeneralResponse(JsonDocument document, string gameCode)
    {
        CheckInResult? common = HoyoLabClient.ReadCommonResponse(document, "cn", gameCode);
        if (common is not null) return common;
        return HoyoLabClient.ReadRetcode(document.RootElement) == 0
            ? null
            : new CheckInResult("cn", gameCode, "api_error", "接口返回未知错误", false);
    }

    private static string? ReadString(JsonElement element, string name) =>
        element.TryGetProperty(name, out JsonElement value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static CheckInResult TransportError(string gameCode) =>
        new("cn", gameCode, "transport_error", "请求失败或响应格式无效", false);

    private sealed record Role(string Uid, string Region);
}
