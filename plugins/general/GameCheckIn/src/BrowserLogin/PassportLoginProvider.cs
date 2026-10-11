using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.Credentials;
using System.Text.Json;

namespace NexusPipeline.Plugin.GameCheckIn.BrowserLogin;

internal sealed class PassportLoginProvider(IPluginHttpClientFactory http, string platform, LoginValidationTrace? trace = null)
{
    internal static string FlowVersion(string platform) => platform switch
    {
        "skland" => "5",
        "skport" => "7",
        _ => throw new ArgumentOutOfRangeException(nameof(platform))
    };
    internal static PluginBrowserLoginFlow Flow(string platform, bool ready)
    {
        if (platform is not ("skland" or "skport")) throw new ArgumentOutOfRangeException(nameof(platform));
        string origin = "https://www." + platform + ".com";
        string account = platform == "skland" ? "https://user.hypergryph.com" : "https://user.gryphline.com";
        string endpoint = "https://web-api." + platform + ".com" +
            (platform == "skland" ? "/account/info/hg/check" : "/cookie_store/account_token");
        return new(platform, platform == "skland" ? "森空岛" : "SKPORT", FlowVersion(platform), origin,
            [origin, account], [account], [], platform == "skland"
                ? [new(origin, "localStorage", "SK_SHUMEI_DEVICE_ID_KEY", [])] : [], ready)
        {
            PageBootstrap = LoginPageBootstrap.For(platform, origin),
            JsonRequests = [new("passport-token", origin, endpoint, platform == "skland" ? "POST" : "GET", ["data", "content"])]
        };
    }

    internal static string Normalize(PluginBrowserCapture capture)
    {
        if (capture.Cookies.Count != 0 || capture.Storage.Count > 1 || capture.Storage.Any(s => s.Origin != "https://www.skland.com"
                || s.Storage != "localStorage" || s.Key != "SK_SHUMEI_DEVICE_ID_KEY") || capture.JsonValues.Count > 1
            || capture.JsonValues.Any(v => v.Id != "passport-token")) throw new CredentialException("credential_capture_invalid");
        return CredentialValidation.RawToken(capture.JsonValues.SingleOrDefault()?.Value);
    }

    internal async Task<CredentialRecord> ValidateAsync(PluginBrowserCapture capture, CancellationToken token)
    {
        string value = Normalize(capture);
        CredentialWebContext? web = null;
        if (platform == "skland")
        {
            string? raw = capture.Storage.SingleOrDefault()?.Value;
            if (string.IsNullOrEmpty(raw)) throw new CredentialException("credential_device_missing");
            try
            {
                using var device = JsonDocument.Parse(raw, new JsonDocumentOptions { MaxDepth = 4 });
                string? id = CredentialValidation.Property(device.RootElement, "id", JsonValueKind.String).GetString();
                web = new("skland", DeviceId: id);
                if (!web.Valid()) throw new CredentialException("credential_capture_invalid");
            }
            catch (JsonException) { throw new CredentialException("credential_capture_invalid"); }
        }
        else if (capture.Storage.Count != 0) throw new CredentialException("credential_capture_invalid");
        string identity = await new SklandClient(http, platform, trace: trace).ValidateCredentialAsync(value, token, web).ConfigureAwait(false);
        return new(1, value, "browser", identity, DateTimeOffset.UtcNow, FlowVersion(platform), web);
    }
}
