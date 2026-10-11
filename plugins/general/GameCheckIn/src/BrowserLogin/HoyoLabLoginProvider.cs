using System.Text;
using System.Text.Json;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.Credentials;

namespace NexusPipeline.Plugin.GameCheckIn.BrowserLogin;

internal sealed class HoyoLabLoginProvider(IPluginHttpClientFactory http)
{
    internal const string FlowVersion = "1";
    internal static readonly string[] CookieNames = ["ltoken_v2", "ltuid_v2", "ltmid_v2", "ltoken", "ltuid"];
    internal static PluginBrowserLoginFlow Flow(bool ready) => new("os", "HoYoLAB", FlowVersion, "https://www.hoyolab.com/",
        ["https://www.hoyolab.com", "https://account.hoyoverse.com", "https://account.hoyolab.com"], [],
        CookieNames.Select(name => new PluginBrowserCookieRule(".hoyolab.com", "/", name)).ToArray(), [], ready);

    internal static string Normalize(PluginBrowserCapture capture)
    {
        if (capture.Storage.Count != 0 || capture.Cookies.Any(c => c.Domain != ".hoyolab.com" || c.Path != "/" || !CookieNames.Contains(c.Name))
            || capture.Cookies.Select(c => c.Name).Distinct(StringComparer.Ordinal).Count() != capture.Cookies.Count) throw new CredentialException("credential_capture_invalid");
        var values = capture.Cookies.Where(c => c.Value.Length > 0).ToDictionary(c => c.Name, c => c.Value, StringComparer.Ordinal);
        bool v2 = values.ContainsKey("ltoken_v2") && values.ContainsKey("ltuid_v2");
        bool v1 = values.ContainsKey("ltoken") && values.ContainsKey("ltuid");
        if (!v2 && !v1) throw new CredentialException("credential_fields_missing");
        var ids = new[] { "ltuid_v2", "ltuid" }.Where(values.ContainsKey).Select(k => values[k]).Distinct(StringComparer.Ordinal).ToArray();
        if (ids.Length != 1 || ids[0].Length is < 1 or > 32 || !ids[0].All(char.IsAsciiDigit)) throw new CredentialException("credential_capture_ambiguous");
        if (values.Values.Any(value => value.Any(c => char.IsControl(c) || c is ';' or ','))) throw new CredentialException("secret_value_invalid");
        string cookie = string.Join("; ", CookieNames.Where(values.ContainsKey).Select(name => name + "=" + values[name]));
        if (!CredentialRecord.ValidValue(cookie)) throw new CredentialException("secret_value_invalid");
        return cookie;
    }
    internal async Task<CredentialRecord> ValidateAsync(PluginBrowserCapture capture, CancellationToken token)
    {
        string cookie = Normalize(capture);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token);
        deadline.CancelAfter(TimeSpan.FromSeconds(30));
        foreach (var (gameBiz, code) in new[] { ("hk4e_global", "gi"), ("hkrpg_global", "hsr"), ("nap_global", "zzz"), ("bh3_global", "bh3") })
        {
            var endpoint = new Uri("https://api-account-os.hoyolab.com/binding/api/getUserGameRolesByLtoken?game_biz=" + gameBiz);
            using var document = await ReadAsync(endpoint, cookie, "https://www.hoyolab.com", "https://www.hoyolab.com/", null, deadline.Token).ConfigureAwait(false);
            var root = document.RootElement;
            if (!root.TryGetProperty("retcode", out var retcode) || retcode.ValueKind != JsonValueKind.Number) throw new CredentialException("readonly_validation_failed");
            if (retcode.GetInt32() != 0) throw new CredentialException(retcode.GetInt32() == -100 ? "credential_not_authenticated" : "credential_rejected");
            if (!root.TryGetProperty("data", out var data) || !data.TryGetProperty("list", out var list) || list.ValueKind != JsonValueKind.Array) throw new CredentialException("readonly_identity_unverified");
            foreach (var role in list.EnumerateArray())
            {
                if (!role.TryGetProperty("game_uid", out var uid) || uid.ValueKind != JsonValueKind.String || uid.GetString() is not { Length: >= 4 and <= 32 } value
                    || !value.All(char.IsAsciiDigit)) continue;
                var game = GameDefinitions.Find(code)!.Os;
                using var info = await ReadAsync(new Uri(game.InfoEndpoint + "?lang=en-us&act_id=" + Uri.EscapeDataString(game.ActId)),
                    cookie, "https://act.hoyolab.com", game.Referer, game.SignGame, deadline.Token).ConfigureAwait(false);
                if (!info.RootElement.TryGetProperty("retcode", out var infoCode) || infoCode.ValueKind != JsonValueKind.Number || infoCode.GetInt32() != 0
                    || !info.RootElement.TryGetProperty("data", out var infoData) || infoData.ValueKind != JsonValueKind.Object
                    || !infoData.TryGetProperty("is_sign", out var signed) || signed.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
                    throw new CredentialException("readonly_signin_status_unverified");
                // Identity comes from the authenticated role response; info proves the same value works for the existing client.
                int visible = value.Length >= 6 ? 2 : 1;
                string masked = gameBiz + " · " + value[..visible] + new string('*', Math.Min(12, value.Length - visible * 2)) + value[^visible..];
                return new(1, cookie, "browser", masked, DateTimeOffset.UtcNow, FlowVersion);
            }
        }
        throw new CredentialException("readonly_identity_unverified");
    }
    private async Task<JsonDocument> ReadAsync(Uri endpoint, string cookie, string origin, string referer, string? signGame, CancellationToken token)
    {
        using var client = http.CreateClient(endpoint, TimeSpan.FromSeconds(30));
        using var request = new HttpRequestMessage(HttpMethod.Get, endpoint);
        request.Headers.Add("Cookie", cookie);request.Headers.Add("Origin", origin);request.Headers.Add("Referer", referer);
        request.Headers.Add("x-rpc-language", "en-us");if (signGame is not null) request.Headers.Add("x-rpc-signgame", signGame);
        request.Headers.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) throw new CredentialException("readonly_validation_failed");
        await using var stream = await response.Content.ReadAsStreamAsync(token).ConfigureAwait(false);
        using var bytes = new MemoryStream();var buffer = new byte[8192];int count;
        while ((count = await stream.ReadAsync(buffer, token).ConfigureAwait(false)) != 0)
        { if (bytes.Length + count > 262144) throw new CredentialException("readonly_validation_failed");bytes.Write(buffer, 0, count); }
        return JsonDocument.Parse(bytes.ToArray());
    }
}
