namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record LoginCookieRule(string Domain, string Path, string Name);
internal sealed record LoginStorageRule(string Origin, string Storage, string Key);
internal sealed record LoginJsonRule(string Id, string Origin, string Endpoint, string Method, string[] Selector);
internal sealed record CheckInLoginPolicy(string Platform, string StartUrl, string[] Origins, string[] PopupOrigins,
    LoginCookieRule[] Cookies, LoginStorageRule[] Storage, LoginJsonRule[] JsonRequests);
internal static class LoginPolicies
{
    internal static readonly CheckInLoginPolicy[] Browser = [
        new("cn", "https://www.miyoushe.com/ys/", ["https://www.miyoushe.com", "https://user.mihoyo.com"], ["https://user.mihoyo.com"],
            new[] { ".mihoyo.com", ".miyoushe.com" }.SelectMany(domain => new[] { "cookie_token_v2", "account_id_v2", "account_mid_v2", "cookie_token", "account_id" }
                .Select(name => new LoginCookieRule(domain, "/", name))).ToArray(), [], []),
        new("os", "https://www.hoyolab.com/", ["https://www.hoyolab.com", "https://account.hoyoverse.com", "https://account.hoyolab.com"], [],
            new[] { "ltoken_v2", "ltuid_v2", "ltmid_v2", "ltoken", "ltuid" }.Select(name => new LoginCookieRule(".hoyolab.com", "/", name)).ToArray(), [], []),
        new("skland", "https://www.skland.com/", ["https://www.skland.com", "https://user.hypergryph.com"], ["https://user.hypergryph.com"], [],
            [new("https://www.skland.com", "localStorage", "SK_SHUMEI_DEVICE_ID_KEY")],
            [new("passport-token", "https://www.skland.com", "https://web-api.skland.com/account/info/hg/check", "POST", ["data", "content"])]),
        new("skport", "https://www.skport.com/", ["https://www.skport.com", "https://user.gryphline.com"], ["https://user.gryphline.com"], [], [],
            [new("passport-token", "https://www.skport.com", "https://web-api.skport.com/cookie_store/account_token", "GET", ["data", "content"])]),
        new("kuro", "https://www.kurobbs.com/mc/home/9", ["https://www.kurobbs.com"], [], [],
            [new("https://www.kurobbs.com", "localStorage", "auth_token"), new("https://www.kurobbs.com", "localStorage", "distinct_id")], [])
    ];
    internal static CheckInLoginPolicy For(string platform) => Browser.SingleOrDefault(policy => policy.Platform == platform)
        ?? throw new CheckInFailure("checkin_browser_platform_unavailable");
}
