namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record HoyoEndpoint(string ActId, string Info, string Sign, string SignGame, string GameBiz, string Referer);
internal static class HoyoEndpoints
{
    internal static HoyoEndpoint For(string platform, string game)
    {
        CheckInCatalog.Game(platform, game);
        if (platform == "os") return game switch {
            "gi" => new("e202102251931481", "https://sg-hk4e-api.hoyolab.com/event/sol/info", "https://sg-hk4e-api.hoyolab.com/event/sol/sign", "gi", "hk4e_global", "https://act.hoyolab.com/"),
            "hsr" => new("e202303301540311", "https://sg-public-api.hoyolab.com/event/luna/os/info", "https://sg-public-api.hoyolab.com/event/luna/os/sign", "hsr", "hkrpg_global", "https://act.hoyolab.com/"),
            "zzz" => new("e202406031448091", "https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/info", "https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/sign", "zzz", "nap_global", "https://act.hoyolab.com/"),
            "bh3" => new("e202110291205111", "https://sg-public-api.hoyolab.com/event/mani/info", "https://sg-public-api.hoyolab.com/event/mani/sign", "honkai3rd", "bh3_global", "https://act.hoyolab.com/"),
            _ => throw new CheckInFailure("checkin_game_unknown") };
        if (platform != "cn") throw new CheckInFailure("checkin_platform_unknown");
        var ordinary = "https://api-takumi.mihoyo.com/event/luna/";
        return game switch {
            "gi" => new("e202311201442471", ordinary + "info", ordinary + "sign", "hk4e", "hk4e_cn", "https://www.miyoushe.com/ys/"),
            "hsr" => new("e202304121516551", ordinary + "info", ordinary + "sign", "hkrpg", "hkrpg_cn", "https://www.miyoushe.com/ys/"),
            "zzz" => new("e202406242138391", "https://act-nap-api.mihoyo.com/event/luna/zzz/info", "https://act-nap-api.mihoyo.com/event/luna/zzz/sign", "zzz", "nap_cn", "https://www.miyoushe.com/ys/"),
            "bh3" => new("e202306201626331", ordinary + "info", ordinary + "sign", "bh3", "bh3_cn", "https://www.miyoushe.com/bh3/"),
            _ => throw new CheckInFailure("checkin_game_unknown") };
    }
}
