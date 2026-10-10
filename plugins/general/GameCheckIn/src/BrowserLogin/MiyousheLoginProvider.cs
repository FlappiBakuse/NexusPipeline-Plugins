using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.Credentials;

namespace NexusPipeline.Plugin.GameCheckIn.BrowserLogin;

internal sealed class MiyousheLoginProvider(IPluginHttpClientFactory http)
{
    internal const string FlowVersion = "1";
    private static readonly string[] Domains = [".mihoyo.com", ".miyoushe.com"];
    private static readonly string[] Names = ["cookie_token_v2", "account_id_v2", "account_mid_v2", "cookie_token", "account_id"];

    internal static PluginBrowserLoginFlow Flow(bool ready) => new("cn", "米游社", FlowVersion, "https://www.miyoushe.com/",
        ["https://www.miyoushe.com", "https://user.mihoyo.com"], ["https://user.mihoyo.com"],
        Domains.SelectMany(domain => Names.Select(name => new PluginBrowserCookieRule(domain, "/", name))).ToArray(), [], ready);

    internal static string Normalize(PluginBrowserCapture capture)
    {
        if (capture.Storage.Count != 0 || capture.Cookies.Any(c => !Domains.Contains(c.Domain) || c.Path != "/" || !Names.Contains(c.Name))
            || capture.Cookies.Select(c => (c.Domain, c.Name)).Distinct().Count() != capture.Cookies.Count)
            throw new CredentialException("credential_capture_invalid");
        var cookies = capture.Cookies.Where(c => c.Value.Length > 0).ToArray();
        if (cookies.Any(c => !CredentialRecord.ValidValue(c.Value) || c.Value.Any(v => char.IsWhiteSpace(v) || v is ';' or ',')))
            throw new CredentialException("secret_value_invalid");
        var grouped = cookies.GroupBy(c => c.Name, StringComparer.Ordinal).ToArray();
        if (grouped.Any(g => g.Select(c => c.Value).Distinct(StringComparer.Ordinal).Count() != 1))
            throw new CredentialException("credential_capture_ambiguous");
        var values = grouped.ToDictionary(g => g.Key, g => g.First().Value, StringComparer.Ordinal);
        var ids = cookies.Where(c => c.Name is "account_id_v2" or "account_id").Select(c => c.Value).Distinct(StringComparer.Ordinal).ToArray();
        if (ids.Length > 1 || ids.Any(id => id.Length > 32 || !id.All(char.IsAsciiDigit)))
            throw new CredentialException("credential_capture_ambiguous");
        bool Complete(string tokenName, string idName) => Domains.Any(domain => cookies.Any(c => c.Domain == domain && c.Name == tokenName)
            && cookies.Any(c => c.Domain == domain && c.Name == idName));
        string[] selected = Complete("cookie_token_v2", "account_id_v2") ? Names[..3]
            : Complete("cookie_token", "account_id") ? Names[3..] : throw new CredentialException("credential_fields_missing");
        string cookie = string.Join("; ", selected.Where(values.ContainsKey).Select(name => name + "=" + values[name]));
        if (!CredentialRecord.ValidValue(cookie)) throw new CredentialException("secret_value_invalid");
        return cookie;
    }

    internal async Task<CredentialRecord> ValidateAsync(PluginBrowserCapture capture, CancellationToken token)
    {
        string cookie = Normalize(capture);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token);
        deadline.CancelAfter(TimeSpan.FromSeconds(30));
        string identity = await new MiyousheClient(http).ValidateCredentialAsync(cookie, deadline.Token).ConfigureAwait(false);
        return new(1, cookie, "browser", identity, DateTimeOffset.UtcNow, FlowVersion);
    }
}
