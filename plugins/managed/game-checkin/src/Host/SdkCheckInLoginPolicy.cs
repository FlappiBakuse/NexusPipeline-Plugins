using NexusPipeline.Extensibility.Lifecycle;
using NexusPipeline.Extensibility.Secrets;
using SdkCookie = NexusPipeline.Extensibility.Lifecycle.LoginCookieRule;
using SdkStorage = NexusPipeline.Extensibility.Lifecycle.LoginStorageRule;
using SdkJson = NexusPipeline.Extensibility.Lifecycle.LoginJsonRule;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class SdkCheckInLoginPolicy
{
    internal BrowserLoginPolicy Policy { get; }
    private SdkCheckInLoginPolicy(CheckInLoginPolicy source)
    {
        var domains = source.Cookies.Select(cookie => cookie.Domain).Distinct(StringComparer.Ordinal).ToArray();
        var cookies = source.Cookies.Select(cookie => new SdkCookie("d" + Array.IndexOf(domains, cookie.Domain) + "-" + cookie.Name,
            cookie.Domain, cookie.Path, cookie.Name)).ToArray();
        var storage = source.Storage.Select(rule => new SdkStorage(rule.Key switch {
            "SK_SHUMEI_DEVICE_ID_KEY" => "device", "auth_token" => "auth-token", "distinct_id" => "distinct-id",
            _ => throw new CheckInFailure("credential_capture_policy_invalid") }, rule.Origin, rule.Storage, rule.Key)).ToArray();
        var json = source.JsonRequests.Select(rule => new SdkJson(rule.Id, rule.Origin, rule.Endpoint, rule.Method, rule.Selector)).ToArray();
        var ready = new List<IReadOnlyList<string>>(); var equal = new List<IReadOnlyList<string>>(); var checks = new List<LoginValueCheck>();
        if (source.Platform is "cn" or "os")
        {
            var token = source.Platform == "cn" ? "cookie_token" : "ltoken"; var account = source.Platform == "cn" ? "account_id" : "ltuid";
            foreach (var domain in domains)
                foreach (var suffix in new[] { "_v2", "" })
                    ready.Add([cookies.Single(cookie => cookie.Domain == domain && cookie.Name == token + suffix).Id,
                        cookies.Single(cookie => cookie.Domain == domain && cookie.Name == account + suffix).Id]);
            equal.Add(cookies.Where(cookie => cookie.Name == account || cookie.Name == account + "_v2").Select(cookie => cookie.Id).ToArray());
            foreach (var group in cookies.GroupBy(cookie => cookie.Name).Where(group => group.Count() > 1 && group.Key != account && group.Key != account + "_v2"))
                equal.Add(group.Select(cookie => cookie.Id).ToArray());
            checks.AddRange(cookies.Select(cookie => new LoginValueCheck(cookie.Id,
                cookie.Name == account || cookie.Name == account + "_v2" ? "digits" : "cookie", [],
                cookie.Name == account || cookie.Name == account + "_v2" ? 32 : 16384)));
        }
        else if (source.Platform == "skland")
        { ready.Add(["passport-token", "device"]); checks.Add(new("device", "header", ["id"], 16384)); }
        else if (source.Platform == "skport") ready.Add(["passport-token"]);
        else if (source.Platform == "kuro")
        { ready.Add(["auth-token"]); checks.Add(new("auth-token", "token", [], 16384)); checks.Add(new("distinct-id", "header", [], 256)); }
        else throw new CheckInFailure("credential_capture_policy_invalid");
        checks.AddRange(json.Select(rule => new LoginValueCheck(rule.Id, "token", [], 16384)));
        Policy = new("checkin-" + source.Platform + "-v1", source.StartUrl, source.Origins, source.PopupOrigins,
            cookies, storage, json, ready, checks, equal);
    }
    internal static SdkCheckInLoginPolicy For(CheckInLoginPolicy source)
    {
        if (!ReferenceEquals(source, LoginPolicies.For(source.Platform))) throw new CheckInFailure("credential_capture_policy_invalid");
        return new(source);
    }
    internal BrowserCredentialCapture Read(BrowserLoginCapture capture)
    {
        var ids = Policy.Cookies.Select(rule => rule.Id).Concat(Policy.Storage.Select(rule => rule.Id)).Concat(Policy.JsonRequests.Select(rule => rule.Id)).ToHashSet(StringComparer.Ordinal);
        if (capture.Values.Keys.Any(id => !ids.Contains(id))) throw new CheckInFailure("credential_capture_invalid");
        string ReadValue(SecretDraft draft) { string? value = null; draft.Use(text => value = text.ToString()); return value!; }
        var cookies = Policy.Cookies.Where(rule => capture.Values.ContainsKey(rule.Id)).Select(rule =>
            new CapturedCookie(rule.Domain, rule.Path, rule.Name, ReadValue(capture.Values[rule.Id]))).ToArray();
        var storage = Policy.Storage.Where(rule => capture.Values.ContainsKey(rule.Id)).Select(rule =>
            new CapturedStorage(rule.Origin, rule.Storage, rule.Key, ReadValue(capture.Values[rule.Id]))).ToArray();
        var json = Policy.JsonRequests.Where(rule => capture.Values.ContainsKey(rule.Id)).Select(rule =>
            new CapturedJsonValue(rule.Id, ReadValue(capture.Values[rule.Id]))).ToArray();
        return new(cookies, storage, json);
    }
}
