using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed record TajiduoCredential(string AccessToken, string RefreshToken, string Uid, string DeviceId, string? RoleId = null)
{
    internal static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    internal static TajiduoCredential? Parse(string value)
    {
        try
        {
            using var doc = JsonDocument.Parse(value);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return null;
            var names = doc.RootElement.EnumerateObject().Select(p => p.Name).ToArray();
            if (names.Distinct(StringComparer.Ordinal).Count() != names.Length || names.Any(n => n is not ("accessToken" or "refreshToken" or "uid" or "deviceId" or "roleId"))) return null;
            var credential = JsonSerializer.Deserialize<TajiduoCredential>(value, Options);
            return credential is not null && Header(credential.AccessToken) && Header(credential.RefreshToken)
                && Header(credential.DeviceId) && Id(credential.Uid) && (credential.RoleId is null || Id(credential.RoleId)) ? credential : null;
        }
        catch (JsonException) { return null; }
    }
    internal string Encode() => JsonSerializer.Serialize(this, Options);
    internal static bool Header(string? value) => !string.IsNullOrEmpty(value) && value.Length <= 4096 && value.All(c => c is >= '!' and <= '~');
    internal static bool Id(string? value) => !string.IsNullOrEmpty(value) && value.Length <= 40 && value.All(char.IsAsciiDigit);
}

internal sealed class TajiduoClient(IPluginHttpClientFactory http)
{
    private const string Base = "https://bbs-api.tajiduo.com";
    private const string AppVersion = "1.2.5";
    internal async Task<CheckInResult> SignAsync(string value, Func<string, Task<bool>> persist, CancellationToken token)
    {
        var credential = TajiduoCredential.Parse(value);
        if (credential is null) return Result("invalid_credential", "请填写塔吉多原生凭据 JSON；网页登录 Cookie 不适用");
        bool submitted = false;
        try
        {
            using var client = http.CreateClient(new Uri(Base), TimeSpan.FromSeconds(30));
            using var refresh = await Send(client, credential, "/usercenter/api/refreshToken", true, true, null, token);
            if (!Ok(refresh)) return Result("credential_expired", "塔吉多凭据刷新失败，请重新登录");
            var data = refresh.RootElement.GetProperty("data");
            var access = data.GetProperty("accessToken").GetString();
            var refreshToken = data.GetProperty("refreshToken").GetString();
            if (!TajiduoCredential.Header(access) || !TajiduoCredential.Header(refreshToken)
                || data.TryGetProperty("uid", out var uid) && Identifier(uid) != credential.Uid) return Result("verification_state_unknown", "凭据刷新响应无效");
            credential = credential with { AccessToken = access!, RefreshToken = refreshToken! };
            // Persist rotating credentials before any game mutation; an edited or deleted task must not be resurrected.
            if (!await persist(credential.Encode())) return Result("credential_changed", "凭据已变更，请重新运行");
            using var roles = await Send(client, credential, "/usercenter/api/v2/getGameRoles?gameId=1289", false, true, null, token);
            if (!Ok(roles)) return Result("api_error", "角色查询失败");
            var list = roles.RootElement.GetProperty("data").GetProperty("roles");
            if (list.ValueKind != JsonValueKind.Array) return Result("verification_state_unknown", "角色响应格式未知");
            var ids = list.EnumerateArray().Select(r => Identifier(r.GetProperty("roleId"))).ToArray();
            if (ids.Any(id => !TajiduoCredential.Id(id))) return Result("verification_state_unknown", "角色响应格式未知");
            ids = ids.Distinct(StringComparer.Ordinal).ToArray();
            if (ids.Length == 0 || credential.RoleId is not null && !ids.Contains(credential.RoleId)) return Result("no_role", "当前账号没有指定的异环角色");
            if (credential.RoleId is null && ids.Length != 1) return Result("role_selection_required", "检测到多个角色，请在凭据 JSON 中指定 roleId");
            var role = credential.RoleId ?? ids[0];
            using var before = await Send(client, credential, "/apihub/awapi/signin/state?gameId=1289", false, false, null, token);
            bool? signed = Signed(before);
            if (signed is true) return Result("already", "今日已签到", true);
            if (signed is null) return Result("verification_state_unknown", "签到状态格式未知");
            token.ThrowIfCancellationRequested();
            submitted = true;
            using var sign = await Send(client, credential, "/apihub/awapi/sign", true, false,
                new Dictionary<string, string> { ["gameId"] = "1289", ["roleId"] = role }, token);
            using var after = await Send(client, credential, "/apihub/awapi/signin/state?gameId=1289", false, false, null, token);
            return Signed(after) is true ? Result("success", "签到状态已确认", true) : Result("success_unconfirmed", "签到结果尚未确认，请稍后查询");
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested) { throw; }
        catch { return submitted ? Result("success_unconfirmed", "签到结果尚未确认，请稍后查询") : Result("transport_error", "官方请求失败或响应格式无效"); }
    }
    internal static string Ds(long timestamp, string nonce) => $"{timestamp},{nonce},{Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes($"{timestamp}{nonce}{AppVersion}pUds3dfMkl"))).ToLowerInvariant()}";
    private static CheckInResult Result(string code, string message, bool success = false) => new("tajiduo", "nte", code, message, success);
    private static string Identifier(JsonElement value) => value.ValueKind == JsonValueKind.String ? value.GetString()! : value.ValueKind == JsonValueKind.Number ? value.GetRawText() : "";
    private static bool Ok(JsonDocument doc) => doc.RootElement.TryGetProperty("code", out var code) && code.TryGetInt32(out int number) && number == 0;
    private static bool? Signed(JsonDocument doc) => Ok(doc) && doc.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Object
        && data.TryGetProperty("todaySign", out var flag) && flag.ValueKind is JsonValueKind.True or JsonValueKind.False ? flag.GetBoolean() : null;
    private static async Task<JsonDocument> Send(HttpClient client, TajiduoCredential credential, string route, bool post, bool native,
        Dictionary<string, string>? body, CancellationToken token)
    {
        using var request = new HttpRequestMessage(post ? HttpMethod.Post : HttpMethod.Get, Base + route);
        // The official API uses an opaque token, not an RFC authentication scheme and parameter pair.
        request.Headers.TryAddWithoutValidation("Authorization", route.EndsWith("/refreshToken", StringComparison.Ordinal) ? credential.RefreshToken : credential.AccessToken);
        request.Headers.Add("Accept", "application/json");
        if (native)
        {
            NativeHeaders(request, credential.Uid, credential.DeviceId);
        }
        else
        {
            request.Headers.Add("Origin", "https://webstatic.tajiduo.com");
            request.Headers.Referrer = new Uri("https://webstatic.tajiduo.com/");
            request.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Tajiduo/1.2.2");
        }
        if (post) request.Content = new FormUrlEncodedContent(body ?? new Dictionary<string, string>());
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token);
        return await CheckInResponse.ReadAsync(response, token, codeProperty: "code");
    }
    internal static void NativeHeaders(HttpRequestMessage request, string uid, string device)
    {
        request.Headers.Add("appVersion", AppVersion);
        request.Headers.Add("platform", "android");
        request.Headers.Add("uid", uid);
        request.Headers.Add("deviceId", device);
        request.Headers.Add("debug-uid", "3");
        request.Headers.Add("ds", Ds(DateTimeOffset.UtcNow.ToUnixTimeSeconds(), Convert.ToHexString(RandomNumberGenerator.GetBytes(4)).ToLowerInvariant()));
        request.Headers.TryAddWithoutValidation("User-Agent", "okhttp/4.12.0");
    }
}
