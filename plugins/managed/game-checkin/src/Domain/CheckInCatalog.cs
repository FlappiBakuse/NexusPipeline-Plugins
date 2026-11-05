namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInGame(string Code, string Name, string? ExternalGameId = null);
internal sealed record CheckInPlatform(string Id, string Name, CheckInGame[] Games);
internal static class CheckInCatalog
{
    internal static readonly CheckInPlatform[] Platforms = [
        new("cn", "米游社", [new("gi", "原神", "hk4e_cn"), new("hsr", "崩坏：星穹铁道", "hkrpg_cn"),
            new("zzz", "绝区零", "nap_cn"), new("bh3", "崩坏3", "bh3_cn")]),
        new("os", "HoYoLAB", [new("gi", "Genshin Impact", "hk4e_global"), new("hsr", "Honkai: Star Rail", "hkrpg_global"),
            new("zzz", "Zenless Zone Zero", "nap_global"), new("bh3", "Honkai Impact 3rd", "bh3_global")]),
        new("skland", "森空岛", [new("ak", "明日方舟", "1"), new("endfield", "明日方舟：终末地", "3")]),
        new("skport", "SKPORT", [new("endfield", "Arknights: Endfield", "3")]),
        new("kuro", "库街区", [new("ww", "鸣潮", "3"), new("pgr", "战双帕弥什", "2")]),
        new("tajiduo", "塔吉多", [new("nte", "异环", "1289")])
    ];
    internal static CheckInPlatform Platform(string id) => Platforms.SingleOrDefault(platform => platform.Id == id)
        ?? throw new CheckInFailure("checkin_platform_unknown");
    internal static CheckInGame Game(string platform, string code) => Platform(platform).Games.SingleOrDefault(game => game.Code == code)
        ?? throw new CheckInFailure("checkin_game_unknown");
}

internal sealed class CheckInFailure(string code) : Exception(code)
{
    internal string Code { get; } = code;
}
