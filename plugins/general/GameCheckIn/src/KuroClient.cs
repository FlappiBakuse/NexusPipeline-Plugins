using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

/// <summary>库街区游戏签到客户端；仅访问角色绑定和游戏签到 API，不执行社区任务。</summary>
internal sealed class KuroClient
{
    private const string BaseUrl = "https://api.kurobbs.com";
    private const string UserAgent = "Mozilla/5.0 (Linux; Android 14; NexusPipeline) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36 Kuro/2.2.0 KuroGameBox/2.2.0";
    private const string Source = "android";

    private readonly IPluginHttpClientFactory _http;

    public KuroClient(IPluginHttpClientFactory http)
    {
        _http = http;
    }

    public async Task<CheckInResult> SignAsync(
        KuroGameDefinition game,
        string token,
        string devCode,
        string distinctId,
        CancellationToken cancellationToken)
    {
        try
        {
            using JsonDocument roles = await SendFormAsync(
                "/user/role/findRoleList",
                token,
                devCode,
                distinctId,
                new Dictionary<string, string> { ["gameId"] = game.GameId },
                cancellationToken).ConfigureAwait(false);
            CheckInResult? roleError = MapRoleResponse(roles, game.Code);
            if (roleError is not null)
            {
                return roleError;
            }
            List<Role> roleList = ReadRoles(roles, game.GameId);
            if (roleList.Count == 0)
            {
                return new CheckInResult("kuro", game.Code, "no_role", "当前账号没有可签到角色", false);
            }

            bool signed = false;
            bool already = true;
            foreach (Role role in roleList)
            {
                using JsonDocument response = await SendFormAsync(
                    "/encourage/signIn/v2",
                    token,
                    devCode,
                    distinctId,
                    new Dictionary<string, string>
                    {
                        ["gameId"] = game.GameId,
                        ["serverId"] = role.ServerId,
                        ["roleId"] = role.RoleId,
                        ["userId"] = role.UserId,
                        ["reqMonth"] = DateTimeOffset.Now.ToString("yyyy-MM"),
                    },
                    cancellationToken).ConfigureAwait(false);
                CheckInResult result = MapResponse(response, game.Code) ??
                    new CheckInResult("kuro", game.Code, "server_error", "签到接口返回未知状态", false);
                if (result.Code == "already")
                {
                    continue;
                }
                already = false;
                if (!result.Success)
                {
                    return result;
                }
                signed = true;
            }
            return signed
                ? new CheckInResult("kuro", game.Code, "success", "签到成功", true)
                : already
                    ? new CheckInResult("kuro", game.Code, "already", "今日已签到", true)
                    : new CheckInResult("kuro", game.Code, "server_error", "签到接口返回未知状态", false);
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

    private async Task<JsonDocument> SendFormAsync(
        string path,
        string token,
        string devCode,
        string distinctId,
        IReadOnlyDictionary<string, string> fields,
        CancellationToken cancellationToken)
    {
        using HttpClient client = _http.CreateClient(new Uri(BaseUrl + path), TimeSpan.FromSeconds(30));
        using var request = new HttpRequestMessage(HttpMethod.Post, BaseUrl + path);
        request.Headers.TryAddWithoutValidation("pragma", "no-cache");
        request.Headers.TryAddWithoutValidation("cache-control", "no-cache");
        request.Headers.TryAddWithoutValidation("source", Source);
        request.Headers.TryAddWithoutValidation("lang", "zh-Hans");
        request.Headers.TryAddWithoutValidation("devcode", devCode);
        request.Headers.TryAddWithoutValidation("distinct_id", distinctId);
        request.Headers.TryAddWithoutValidation("countrycode", "CN");
        request.Headers.TryAddWithoutValidation("model", "NexusPipeline");
        request.Headers.TryAddWithoutValidation("version", "2.2.0");
        request.Headers.TryAddWithoutValidation("versioncode", "2200");
        request.Headers.TryAddWithoutValidation("token", token);
        request.Headers.TryAddWithoutValidation("x-requested-with", "com.kurogame.kjq");
        request.Headers.Accept.Clear();
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.UserAgent.ParseAdd(UserAgent);
        request.Content = new FormUrlEncodedContent(fields);
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

    private static List<Role> ReadRoles(JsonDocument document, string gameId)
    {
        var result = new List<Role>();
        if (!document.RootElement.TryGetProperty("data", out JsonElement data)
            || data.ValueKind != JsonValueKind.Array)
        {
            return result;
        }
        foreach (JsonElement item in data.EnumerateArray())
        {
            string roleGameId = ReadString(item, "gameId") ?? "";
            if (roleGameId.Length > 0 && !roleGameId.Equals(gameId, StringComparison.Ordinal))
            {
                continue;
            }
            string roleId = ReadString(item, "roleId") ?? "";
            string serverId = ReadString(item, "serverId") ?? "";
            string userId = ReadString(item, "userId") ?? "";
            if (roleId.Length > 0 && serverId.Length > 0 && userId.Length > 0)
            {
                result.Add(new Role(roleId, serverId, userId));
            }
        }
        return result;
    }

    internal static CheckInResult? MapResponse(JsonDocument document, string gameCode)
    {
        int code = document.RootElement.TryGetProperty("code", out JsonElement codeNode)
            && codeNode.TryGetInt32(out int value)
            ? value
            : int.MinValue;
        string message = document.RootElement.TryGetProperty("msg", out JsonElement messageNode)
            ? messageNode.GetString() ?? ""
            : "";
        return code switch
        {
            200 => new CheckInResult("kuro", gameCode, "success", "签到成功", true),
            1511 => new CheckInResult("kuro", gameCode, "already", "今日已签到", true),
            220 => new CheckInResult("kuro", gameCode, "credential_expired", "Token 已失效，请重新获取", false),
            1513 => new CheckInResult("kuro", gameCode, "manual_action_required", message.Length > 0 ? message : "账号信息需要手动确认", false),
            int.MinValue => new CheckInResult("kuro", gameCode, "server_error", "响应格式无效", false),
            _ => new CheckInResult("kuro", gameCode, "server_error", message.Length > 0 ? message : "接口返回未知错误", false),
        };
    }

    private static CheckInResult? MapRoleResponse(JsonDocument document, string gameCode)
    {
        int code = document.RootElement.TryGetProperty("code", out JsonElement codeNode)
            && codeNode.TryGetInt32(out int value)
            ? value
            : int.MinValue;
        return code == 200 ? null : MapResponse(document, gameCode);
    }

    private static string? ReadString(JsonElement element, string property)
    {
        if (!element.TryGetProperty(property, out JsonElement value))
        {
            return null;
        }
        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.ToString(),
            _ => null,
        };
    }

    private static CheckInResult TransportError(string gameCode) =>
        new("kuro", gameCode, "transport_error", "请求失败或响应格式无效", false);

    private sealed record Role(string RoleId, string ServerId, string UserId);
}
