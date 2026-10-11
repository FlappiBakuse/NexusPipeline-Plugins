using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.Credentials;

namespace NexusPipeline.Plugin.GameCheckIn.BrowserLogin;

internal sealed class KuroLoginProvider(IPluginHttpClientFactory http, LoginValidationTrace? trace = null)
{
    internal const string FlowVersion = "3";
    internal static PluginBrowserLoginFlow Flow(bool ready) => new("kuro", "库街区", FlowVersion, "https://www.kurobbs.com/mc/home/9",
        ["https://www.kurobbs.com"], [], [], [new("https://www.kurobbs.com", "localStorage", "auth_token", []),
            new("https://www.kurobbs.com", "localStorage", "distinct_id", [])], ready)
        { PageBootstrap = LoginPageBootstrap.For("kuro", "https://www.kurobbs.com/mc/home/9") };

    internal static string Normalize(PluginBrowserCapture capture)
    {
        if (capture.Cookies.Count != 0 || capture.JsonValues.Count != 0 || capture.Storage.Count > 2 || capture.Storage.Any(s => s.Origin != "https://www.kurobbs.com"
            || s.Storage != "localStorage" || s.Key is not ("auth_token" or "distinct_id"))
            || capture.Storage.Select(s => s.Key).Distinct(StringComparer.Ordinal).Count() != capture.Storage.Count)
            throw new CredentialException("credential_capture_invalid");
        return CredentialValidation.RawToken(capture.Storage.SingleOrDefault(s => s.Key == "auth_token")?.Value);
    }

    internal async Task<CredentialRecord> ValidateAsync(PluginBrowserCapture capture, CancellationToken token)
    {
        string value = Normalize(capture);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token);
        deadline.CancelAfter(TimeSpan.FromSeconds(30));
        var web = new CredentialWebContext("kuro", DistinctId: capture.Storage.SingleOrDefault(s => s.Key == "distinct_id")?.Value);
        if (!web.Valid()) throw new CredentialException("credential_capture_invalid");
        string identity = await new KuroClient(http, trace: trace).ValidateCredentialAsync(value, deadline.Token, web).ConfigureAwait(false);
        return new(1, value, "browser", identity, DateTimeOffset.UtcNow, FlowVersion, web);
    }
}
