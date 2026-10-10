using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.BrowserLogin;
using NexusPipeline.Plugin.GameCheckIn.Credentials;

namespace NexusPipeline.Plugin.GameCheckIn;

/// <summary>森空岛和 SKPORT 的独立签名客户端。两个平台共享协议形状，使用独立 host/app/profile 配置。</summary>
internal sealed class SklandClient
{
    private const string SklandAppCode = "4ca99fa6b56cc2ba";
    private const string SkportAppCode = "6eb76d4e13aa36e6";
    private const string UserAgent = "Skland/1.5.1 (com.hypergryph.skland; build:100501001; Android 34; ) Okhttp/4.11.0";
    private const string RequestedWith = "com.hypergryph.skland";

    private readonly IPluginHttpClientFactory _http;
    private readonly string _platform;
    private readonly Func<CancellationToken, Task<string>> _deviceId;

    public SklandClient(
        IPluginHttpClientFactory http,
        string platform,
        Func<CancellationToken, Task<string>>? deviceIdProvider = null)
    {
        if (platform is not ("skland" or "skport")) throw new ArgumentOutOfRangeException(nameof(platform));
        _http = http;
        _platform = platform;
        _deviceId = deviceIdProvider ?? new SklandDeviceFingerprintProvider(http).GetDeviceIdAsync;
    }

    internal string Platform => _platform;

    internal async Task<string> ValidateCredentialAsync(string value, CancellationToken token)
    {
        CredentialValidation.RawToken(value);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token);
        deadline.CancelAfter(TimeSpan.FromSeconds(30));
        var profile = Profile.For(_platform, endfield: true);
        string deviceId = await _deviceId(deadline.Token).ConfigureAwait(false);
        try
        {
            var (cred, signToken) = await AuthenticateAsync(value, profile, deviceId, deadline.Token, validateHttpStatus: true).ConfigureAwait(false);
            using var user = await SignedRequestAsync(new Uri(profile.WebBase + "/user"), cred, signToken, profile, "",
                HttpMethod.Get, "", null, deadline.Token, validateHttpStatus: true).ConfigureAwait(false);
            CredentialValidation.RequireCode(user, "code", 0, 401, 10002);
            var data = CredentialValidation.Property(user.RootElement, "data", JsonValueKind.Object);
            var account = CredentialValidation.Property(data, "user", JsonValueKind.Object);
            string identity = CredentialValidation.MaskIdentity(_platform, ReadString(account, "id"));
            using var bindings = await SignedRequestAsync(new Uri(profile.ApiBase + "/game/player/binding"), cred, signToken, profile, "",
                HttpMethod.Get, "", null, deadline.Token, validateHttpStatus: true).ConfigureAwait(false);
            CredentialValidation.RequireCode(bindings, "code", 0, 401, 10002);
            var bindingData = CredentialValidation.Property(bindings.RootElement, "data", JsonValueKind.Object);
            CredentialValidation.Property(bindingData, "list", JsonValueKind.Array);
            // An authenticated account can legitimately have no bound game roles.
            return identity;
        }
        catch (SklandCredentialException ex)
        {
            throw new CredentialException(ex.Code == "risk_control" ? "credential_rejected" : "credential_not_authenticated");
        }
        catch (InvalidOperationException)
        {
            throw new CredentialException("readonly_validation_failed");
        }
    }

    public async Task<CheckInResult> SignAsync(
        SklandGameDefinition game,
        string token,
        CancellationToken cancellationToken)
    {
        try
        {
            Profile profile = Profile.For(_platform, game.IsEndfield);
            string deviceId = await _deviceId(cancellationToken).ConfigureAwait(false);
            (string cred, string signToken) = await AuthenticateAsync(token, profile, deviceId, cancellationToken).ConfigureAwait(false);
            string signedDeviceId = game.IsEndfield ? "" : deviceId;
            using JsonDocument bindings = await SignedRequestAsync(
                new Uri(profile.ApiBase + "/game/player/binding"),
                cred,
                signToken,
                profile,
                signedDeviceId,
                HttpMethod.Get,
                body: "",
                extraHeaders: null,
                cancellationToken).ConfigureAwait(false);
            CheckInResult? bindingError = MapCommonError(bindings, game.Code);
            if (bindingError is not null)
            {
                return bindingError;
            }

            List<Binding> candidates = ReadBindings(bindings, game);
            if (candidates.Count == 0)
            {
                return new CheckInResult(_platform, game.Code, "no_role", "当前账号没有可签到角色", false);
            }

            bool signed = false;
            bool already = true;
            foreach (Binding binding in candidates)
            {
                string path = game.IsEndfield ? "/game/endfield/attendance" : "/game/attendance";
                string body = game.IsEndfield
                    ? ""
                    : JsonSerializer.Serialize(new { uid = binding.Uid, gameId = game.GameId });
                Dictionary<string, string>? headers = game.IsEndfield
                    ? new(StringComparer.OrdinalIgnoreCase)
                    {
                        ["sk-game-role"] = $"3_{binding.RoleId}_{binding.ServerId}",
                    }
                    : null;
                using JsonDocument response = await SignedRequestAsync(
                    new Uri(profile.ApiBase + path),
                    cred,
                    signToken,
                    profile,
                    signedDeviceId,
                    HttpMethod.Post,
                    body,
                    headers,
                    cancellationToken).ConfigureAwait(false);
                CheckInResult result = MapAttendanceResult(response, game.Code) with { Platform = _platform };
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
                ? new CheckInResult(_platform, game.Code, "success", "签到成功", true)
                : already
                    ? new CheckInResult(_platform, game.Code, "already", "今日已签到", true)
                    : new CheckInResult(_platform, game.Code, "server_error", "接口返回未知状态", false);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return TransportError(game.Code);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (SklandCredentialException ex)
        {
            return new CheckInResult(_platform, game.Code, ex.Code, ex.Message, false);
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

    internal static string ComputeSign(
        string signToken,
        string path,
        string body,
        string timestamp,
        string deviceId,
        string platform,
        string versionName)
    {
        string headerJson = JsonSerializer.Serialize(new
        {
            platform,
            timestamp,
            dId = deviceId,
            vName = versionName,
        });
        string message = path + body + timestamp + headerJson;
        byte[] hmac = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(signToken),
            Encoding.UTF8.GetBytes(message));
        string hex = Convert.ToHexString(hmac).ToLowerInvariant();
        return Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(hex))).ToLowerInvariant();
    }

    private async Task<(string Cred, string SignToken)> AuthenticateAsync(
        string token,
        Profile profile,
        string deviceId,
        CancellationToken cancellationToken,
        bool validateHttpStatus = false)
    {
        string timestamp = UnixTimestamp();
        using JsonDocument grant = await SendJsonAsync(
            new Uri(profile.AuthBase + "/user/oauth2/v2/grant"),
            HttpMethod.Post,
            JsonSerializer.Serialize(new { token, appCode = profile.AppCode, type = 0 }),
            AuthHeaders(profile, timestamp, deviceId),
            cancellationToken, validateHttpStatus).ConfigureAwait(false);
        if (validateHttpStatus) CredentialValidation.RequireCode(grant, "status", 0, 1);
        if (validateHttpStatus)
            CredentialValidation.Property(CredentialValidation.Property(grant.RootElement, "data", JsonValueKind.Object), "code", JsonValueKind.String);
        if (!grant.RootElement.TryGetProperty("status", out JsonElement status)
            || !status.TryGetInt32(out int statusCode)
            || statusCode != 0)
        {
            throw new SklandCredentialException("credential_expired", "通行证 Token 无效或已过期");
        }
        if (!grant.RootElement.TryGetProperty("data", out JsonElement grantData)
            || !grantData.TryGetProperty("code", out JsonElement codeElement)
            || string.IsNullOrWhiteSpace(codeElement.GetString()))
        {
            throw new SklandCredentialException("credential_expired", "通行证授权码获取失败");
        }

        using JsonDocument credential = await SendJsonAsync(
            new Uri(profile.WebBase + "/user/auth/generate_cred_by_code"),
            HttpMethod.Post,
            JsonSerializer.Serialize(new { kind = 1, code = codeElement.GetString() }),
            AuthHeaders(profile, timestamp, deviceId),
            cancellationToken, validateHttpStatus).ConfigureAwait(false);
        if (validateHttpStatus) CredentialValidation.RequireCode(credential, "code", 0, 401, 10002);
        if (validateHttpStatus)
        {
            var credentialData = CredentialValidation.Property(credential.RootElement, "data", JsonValueKind.Object);
            CredentialValidation.RawToken(CredentialValidation.Property(credentialData, "cred", JsonValueKind.String).GetString());
            CredentialValidation.RawToken(CredentialValidation.Property(credentialData, "token", JsonValueKind.String).GetString());
        }
        if (!credential.RootElement.TryGetProperty("code", out JsonElement credentialCode)
            || !credentialCode.TryGetInt32(out int code)
            || code != 0)
        {
            string message = credential.RootElement.TryGetProperty("message", out JsonElement messageNode)
                ? messageNode.GetString() ?? "通行证授权失败"
                : "通行证授权失败";
            string resultCode = message.Contains("设备", StringComparison.OrdinalIgnoreCase)
                || message.Contains("风险", StringComparison.OrdinalIgnoreCase)
                ? "risk_control"
                : "credential_expired";
            throw new SklandCredentialException(resultCode, message);
        }
        if (!credential.RootElement.TryGetProperty("data", out JsonElement data)
            || !data.TryGetProperty("cred", out JsonElement credNode)
            || !data.TryGetProperty("token", out JsonElement signTokenNode))
        {
            throw new SklandCredentialException("credential_expired", "通行证凭据响应格式无效");
        }
        string cred = credNode.GetString() ?? "";
        string signToken = signTokenNode.GetString() ?? "";
        if (cred.Length == 0 || signToken.Length == 0)
        {
            throw new SklandCredentialException("credential_expired", "通行证凭据为空");
        }
        return (cred, signToken);
    }

    private async Task<JsonDocument> SignedRequestAsync(
        Uri endpoint,
        string cred,
        string signToken,
        Profile profile,
        string deviceId,
        HttpMethod method,
        string body,
        Dictionary<string, string>? extraHeaders,
        CancellationToken cancellationToken,
        bool validateHttpStatus = false)
    {
        string timestamp = UnixTimestamp();
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["cred"] = cred,
            ["User-Agent"] = UserAgent,
            ["Accept-Encoding"] = "gzip",
            ["Connection"] = "close",
            ["X-Requested-With"] = RequestedWith,
            ["platform"] = profile.Platform,
            ["timestamp"] = timestamp,
            ["dId"] = deviceId,
            ["vName"] = profile.VersionName,
            ["sign"] = ComputeSign(signToken, endpoint.AbsolutePath, body, timestamp, deviceId, profile.Platform, profile.VersionName),
        };
        if (method == HttpMethod.Post)
        {
            headers["Content-Type"] = "application/json";
        }
        if (extraHeaders is not null)
        {
            foreach ((string name, string value) in extraHeaders)
            {
                headers[name] = value;
            }
        }
        return await SendJsonAsync(endpoint, method, body, headers, cancellationToken, validateHttpStatus).ConfigureAwait(false);
    }

    private async Task<JsonDocument> SendJsonAsync(
        Uri endpoint,
        HttpMethod method,
        string body,
        IReadOnlyDictionary<string, string> headers,
        CancellationToken cancellationToken,
        bool validateHttpStatus = false)
    {
        using HttpClient client = _http.CreateClient(endpoint, TimeSpan.FromSeconds(30));
        using var request = new HttpRequestMessage(method, endpoint);
        foreach ((string name, string value) in headers)
        {
            if (name.Equals("Content-Type", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }
            request.Headers.TryAddWithoutValidation(name, value);
        }
        if (method == HttpMethod.Post)
        {
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        }
        using HttpResponseMessage response = await client.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken).ConfigureAwait(false);
        return await CredentialValidation.ReadResponseAsync(response, cancellationToken, validateHttpStatus).ConfigureAwait(false);
    }

    private static Dictionary<string, string> AuthHeaders(Profile profile, string timestamp, string deviceId) =>
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Content-Type"] = "application/json",
            ["User-Agent"] = UserAgent,
            ["X-Requested-With"] = RequestedWith,
            ["platform"] = profile.Platform,
            ["timestamp"] = timestamp,
            ["dId"] = deviceId,
            ["vName"] = profile.VersionName,
        };

    private static List<Binding> ReadBindings(JsonDocument document, SklandGameDefinition game)
    {
        var result = new List<Binding>();
        if (!document.RootElement.TryGetProperty("data", out JsonElement data))
        {
            return result;
        }
        IEnumerable<JsonElement> games;
        if (data.ValueKind == JsonValueKind.Array)
        {
            games = data.EnumerateArray();
        }
        else if (data.ValueKind == JsonValueKind.Object
            && data.TryGetProperty("list", out JsonElement list)
            && list.ValueKind == JsonValueKind.Array)
        {
            games = list.EnumerateArray();
        }
        else if (data.ValueKind == JsonValueKind.Object
            && data.TryGetProperty("games", out JsonElement legacyGames)
            && legacyGames.ValueKind == JsonValueKind.Array)
        {
            games = legacyGames.EnumerateArray();
        }
        else if (data.ValueKind == JsonValueKind.Object)
        {
            games = new[] { data };
        }
        else
        {
            games = Array.Empty<JsonElement>();
        }
        foreach (JsonElement gameNode in games)
        {
            string appCode = ReadString(gameNode, "appCode") ?? ReadString(gameNode, "app_code") ?? "";
            if (appCode.Length > 0
                && !appCode.Equals(game.IsEndfield ? "endfield" : "arknights", StringComparison.OrdinalIgnoreCase)
                && !appCode.Equals(game.GameId, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }
            if (!gameNode.TryGetProperty("bindingList", out JsonElement listNode)
                && !gameNode.TryGetProperty("binding_list", out listNode))
            {
                continue;
            }
            if (listNode.ValueKind != JsonValueKind.Array)
            {
                continue;
            }
            foreach (JsonElement binding in listNode.EnumerateArray())
            {
                string uid = ReadString(binding, "uid") ?? "";
                string gameId = ReadString(binding, "channelMasterId") ?? ReadString(binding, "gameId") ?? "";
                if (uid.Length == 0 || gameId.Length == 0)
                {
                    continue;
                }
                if (game.IsEndfield)
                {
                    if (binding.TryGetProperty("roles", out JsonElement roles) && roles.ValueKind == JsonValueKind.Array)
                    {
                        foreach (JsonElement role in roles.EnumerateArray())
                        {
                            AddEndfieldBinding(result, uid, role);
                        }
                    }
                    if (result.Count == 0
                        && binding.TryGetProperty("defaultRole", out JsonElement defaultRole)
                        && defaultRole.ValueKind == JsonValueKind.Object)
                    {
                        AddEndfieldBinding(result, uid, defaultRole);
                    }
                }
                else
                {
                    result.Add(new Binding(uid, gameId, "", ""));
                }
            }
        }
        return result;
    }

    private static void AddEndfieldBinding(List<Binding> result, string uid, JsonElement role)
    {
        string roleId = ReadString(role, "roleId") ?? "";
        string serverId = ReadString(role, "serverId") ?? "";
        if (roleId.Length > 0 && serverId.Length > 0)
        {
            result.Add(new Binding(uid, "3", roleId, serverId));
        }
    }

    private static CheckInResult MapAttendanceResult(JsonDocument document, string gameCode)
    {
        int code = ReadCode(document.RootElement);
        return code switch
        {
            0 => new CheckInResult("", gameCode, "success", "签到成功", true),
            10001 => new CheckInResult("", gameCode, "already", "今日已签到", true),
            401 or 10002 => new CheckInResult("", gameCode, "credential_expired", "登录凭据已失效", false),
            _ => new CheckInResult("", gameCode, "server_error", ReadMessage(document.RootElement, "签到接口返回失败"), false),
        };
    }

    private CheckInResult? MapCommonError(JsonDocument document, string gameCode)
    {
        int code = ReadCode(document.RootElement);
        if (code == 0)
        {
            return null;
        }
        if (code is 401 or 10002)
        {
            return new CheckInResult(_platform, gameCode, "credential_expired", "登录凭据已失效", false);
        }
        return new CheckInResult(_platform, gameCode, "server_error", ReadMessage(document.RootElement, "角色信息获取失败"), false);
    }

    private CheckInResult TransportError(string gameCode) =>
        new(_platform, gameCode, "transport_error", "请求失败或响应格式无效", false);

    private static int ReadCode(JsonElement root) =>
        root.TryGetProperty("code", out JsonElement value) && value.TryGetInt32(out int code) ? code : int.MinValue;

    private static string ReadMessage(JsonElement root, string fallback) =>
        root.TryGetProperty("message", out JsonElement message) ? message.GetString() ?? fallback : fallback;

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

    private static string UnixTimestamp() => DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();

    private sealed record Binding(string Uid, string GameId, string RoleId, string ServerId);

    private sealed record Profile(
        string AuthBase,
        string WebBase,
        string ApiBase,
        string AppCode,
        string Platform,
        string VersionName)
    {
        public static Profile For(string platform, bool endfield) => platform switch
        {
            "skport" => new Profile(
                "https://as.gryphline.com",
                "https://zonai.skport.com/web/v1",
                "https://zonai.skport.com/api/v1",
                SkportAppCode,
                "3",
                "1.0.0"),
            _ when endfield => new Profile(
                "https://as.hypergryph.com",
                "https://zonai.skland.com/web/v1",
                "https://zonai.skland.com/api/v1",
                SklandAppCode,
                "3",
                "1.0.0"),
            _ => new Profile(
                "https://as.hypergryph.com",
                "https://zonai.skland.com/web/v1",
                "https://zonai.skland.com/api/v1",
                SklandAppCode,
                "1",
                "1.5.1"),
        };
    }

    private sealed class SklandCredentialException : Exception
    {
        public SklandCredentialException(string code, string message)
            : base(message)
        {
            Code = code;
        }

        public string Code { get; }
    }
}
