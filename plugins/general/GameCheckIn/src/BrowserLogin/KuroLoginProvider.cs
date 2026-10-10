using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.Credentials;

namespace NexusPipeline.Plugin.GameCheckIn.BrowserLogin;

internal sealed class KuroLoginProvider(IPluginHttpClientFactory http)
{
    internal const string FlowVersion = "1";
    internal static PluginBrowserLoginFlow Flow(bool ready) => new("kuro", "库街区", FlowVersion, "https://www.kurobbs.com/login-page",
        ["https://www.kurobbs.com"], [], [], [new("https://www.kurobbs.com", "localStorage", "auth_token", [])], ready);

    internal static string Normalize(PluginBrowserCapture capture)
    {
        if (capture.Cookies.Count != 0 || capture.Storage.Count > 1 || capture.Storage.Any(s => s.Origin != "https://www.kurobbs.com"
            || s.Storage != "localStorage" || s.Key != "auth_token")) throw new CredentialException("credential_capture_invalid");
        return CredentialValidation.RawToken(capture.Storage.SingleOrDefault()?.Value);
    }

    internal async Task<CredentialRecord> ValidateAsync(PluginBrowserCapture capture, CancellationToken token)
    {
        string value = Normalize(capture);
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(token);
        deadline.CancelAfter(TimeSpan.FromSeconds(30));
        string identity = await new KuroClient(http).ValidateCredentialAsync(value, deadline.Token).ConfigureAwait(false);
        return new(1, value, "browser", identity, DateTimeOffset.UtcNow, FlowVersion);
    }
}
