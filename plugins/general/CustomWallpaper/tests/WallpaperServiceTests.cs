using System.Text;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.TestKit;
using Xunit;

namespace NexusPipeline.Plugin.CustomWallpaper.Tests;

public sealed class WallpaperServiceTests
{
    private static byte[] PngBytes(byte seed = 0) =>
        new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, seed, 0x01, 0x02, 0x03, 0x04 };

    private static byte[] JpegBytes(byte seed = 0) =>
        new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, seed, 0x10, 0x4A, 0x46, 0x49, 0x46 };

    private static WallpaperService CreateService(FakePluginHostContext context, Func<DateTimeOffset> utcNow) =>
        new(context.Config, context.ScopedData, context.Assets, context.Logger, utcNow);

    private static Task<JsonObject> UploadAsync(WallpaperService service, byte[] bytes, string mime = "image/png", string name = "wallpaper.png") =>
        service.UploadAsync(new MemoryStream(bytes), mime, name, bytes.LongLength);

    private static async Task<string> UploadIdAsync(WallpaperService service, byte[] bytes, string mime = "image/png")
    {
        JsonObject result = await UploadAsync(service, bytes, mime).ConfigureAwait(false);
        return result["asset"]!["id"]!.GetValue<string>();
    }

    [Fact]
    public async Task Upload_StoresContentAddressedAssetAndProjectsState()
    {
        var context = new FakePluginHostContext("custom-wallpaper");
        WallpaperService service = CreateService(context, () => DateTimeOffset.UtcNow);

        JsonObject result = await UploadAsync(service, PngBytes(), "image/png", "我的壁纸.png");

        Assert.True(result["ok"]!.GetValue<bool>());
        string id = result["asset"]!["id"]!.GetValue<string>();
        Assert.Equal(64, id.Length);
        Assert.Equal(id, Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(PngBytes())).ToLowerInvariant());
        Assert.Equal("我的壁纸.png", result["asset"]!["originalName"]!.GetValue<string>());

        JsonObject state = await service.GetStateAsync();
        Assert.Equal(id, state["selectedId"]!.GetValue<string>());
        Assert.Single(state["order"]!.AsArray());
        Assert.False(state["effectiveEnabled"]!.GetValue<bool>());

        JsonObject updated = await service.ApplySettingsAsync(new JsonObject { ["enabled"] = true });
        Assert.True(updated["effectiveEnabled"]!.GetValue<bool>());
        Assert.Single(await context.Assets.ListAsync(WallpaperService.AssetScope));
    }

    [Theory]
    [InlineData("image/gif", "invalid_type")]
    [InlineData("text/plain", "invalid_type")]
    public async Task Upload_RejectsUnsupportedContentType(string mime, string expectedCode)
    {
        var context = new FakePluginHostContext("custom-wallpaper");
        WallpaperService service = CreateService(context, () => DateTimeOffset.UtcNow);

        WallpaperException error = await Assert.ThrowsAsync<WallpaperException>(() => UploadAsync(service, PngBytes(), mime));

        Assert.Equal(expectedCode, error.Code);
    }

    [Fact]
    public async Task Upload_RejectsContentThatDoesNotMatchDeclaredType()
    {
        var context = new FakePluginHostContext("custom-wallpaper");
        WallpaperService service = CreateService(context, () => DateTimeOffset.UtcNow);

        WallpaperException error = await Assert.ThrowsAsync<WallpaperException>(() => UploadAsync(service, JpegBytes(), "image/png"));

        Assert.Equal("invalid_image", error.Code);
        Assert.Empty(await context.Assets.ListAsync(WallpaperService.AssetScope));
    }

    [Fact]
    public async Task Upload_RejectsFilesAboveThePluginQuota()
    {
        var context = new FakePluginHostContext("custom-wallpaper");
        WallpaperService service = CreateService(context, () => DateTimeOffset.UtcNow);
        byte[] oversized = new byte[(8 * 1024 * 1024) + 1];
        oversized[0] = 0x89; oversized[1] = 0x50; oversized[2] = 0x4E; oversized[3] = 0x47;
        oversized[4] = 0x0D; oversized[5] = 0x0A; oversized[6] = 0x1A; oversized[7] = 0x0A;

        WallpaperException error = await Assert.ThrowsAsync<WallpaperException>(() => UploadAsync(service, oversized));

        Assert.Equal("too_large", error.Code);
    }

    [Fact]
    public async Task Upload_DeduplicatesIdenticalContent()
    {
        var context = new FakePluginHostContext("custom-wallpaper");
        WallpaperService service = CreateService(context, () => DateTimeOffset.UtcNow);

        JsonObject first = await UploadAsync(service, PngBytes(7));
        JsonObject second = await UploadAsync(service, PngBytes(7));

        Assert.False(first["duplicate"]!.GetValue<bool>());
        Assert.True(second["duplicate"]!.GetValue<bool>());
        Assert.Single(second["state"]!["assets"]!.AsArray());
        Assert.Equal(first["asset"]!["id"]!.GetValue<string>(), second["asset"]!["id"]!.GetValue<string>());
    }

    [Fact]
    public async Task Upload_EnforcesAssetCountQuota()
    {
        var context = new FakePluginHostContext("custom-wallpaper");
        WallpaperService service = CreateService(context, () => DateTimeOffset.UtcNow);
        for (int index = 0; index < WallpaperService.MaxAssets; index += 1)
        {
            await UploadAsync(service, PngBytes((byte)index));
        }

        WallpaperException error = await Assert.ThrowsAsync<WallpaperException>(() => UploadAsync(service, PngBytes(200)));

        Assert.Equal("quota_count", error.Code);
    }

    [Fact]
    public async Task Delete_RemovesAssetFromConfigAndStorage()
    {
        var context = new FakePluginHostContext("custom-wallpaper");
        WallpaperService service = CreateService(context, () => DateTimeOffset.UtcNow);
        string id = await UploadIdAsync(service, PngBytes(3));

        JsonObject state = await service.DeleteAsync(id);

        Assert.Empty(state["assets"]!.AsArray());
        Assert.Empty(state["order"]!.AsArray());
        Assert.Equal("", state["selectedId"]!.GetValue<string>());
        Assert.Empty(await context.Assets.ListAsync(WallpaperService.AssetScope));

        WallpaperException error = await Assert.ThrowsAsync<WallpaperException>(() => service.DeleteAsync(id));
        Assert.Equal("not_found", error.Code);
    }

    [Fact]
    public async Task SavePalette_ValidatesTokensAndBumpsRevision()
    {
        var context = new FakePluginHostContext("custom-wallpaper");
        WallpaperService service = CreateService(context, () => DateTimeOffset.UtcNow);
        string id = await UploadIdAsync(service, PngBytes(4));

        JsonObject state = await service.SavePaletteAsync(id, new JsonObject { ["--accent"] = "#123456" });

        JsonObject asset = state["assets"]!.AsArray()[0]!.AsObject();
        Assert.Equal(3, asset["paletteVersion"]!.GetValue<int>());
        Assert.Equal("#123456", asset["palette"]!["--accent"]!.GetValue<string>());

        WallpaperException error = await Assert.ThrowsAsync<WallpaperException>(() =>
            service.SavePaletteAsync(id, new JsonObject { ["--unknown-token"] = "#123456" }));
        Assert.Equal("invalid_palette", error.Code);
    }

    [Fact]
    public async Task ApplySettings_RejectsOrderWithUnknownAsset()
    {
        var context = new FakePluginHostContext("custom-wallpaper");
        WallpaperService service = CreateService(context, () => DateTimeOffset.UtcNow);
        await UploadIdAsync(service, PngBytes(5));

        WallpaperException error = await Assert.ThrowsAsync<WallpaperException>(() => service.ApplySettingsAsync(new JsonObject
        {
            ["order"] = new JsonArray(new string('a', 64)),
        }));

        Assert.Equal("invalid_config", error.Code);
    }

    [Fact]
    public async Task Rotation_TimerSlotChangesCurrentWallpaperAndReportsNextSwitch()
    {
        DateTimeOffset now = new(2026, 9, 12, 10, 0, 0, TimeSpan.Zero);
        var context = new FakePluginHostContext("custom-wallpaper");
        WallpaperService service = CreateService(context, () => now);
        string first = await UploadIdAsync(service, PngBytes(11));
        string second = await UploadIdAsync(service, PngBytes(12));

        JsonObject configured = await service.ApplySettingsAsync(new JsonObject
        {
            ["enabled"] = true,
            ["rotation"] = new JsonObject
            {
                ["mode"] = "timer",
                ["intervalMinutes"] = 1,
                ["epochUnixMs"] = now.ToUnixTimeMilliseconds(),
            },
        });
        string inFirstSlot = configured["currentId"]!.GetValue<string>();
        Assert.Contains(inFirstSlot, new[] { first, second });
        Assert.NotNull(configured["rotation"]!["nextSwitchAt"]!.GetValue<string>());

        now = now.AddMinutes(2);
        JsonObject rotated = await service.GetStateAsync();
        Assert.NotEqual(inFirstSlot, rotated["currentId"]!.GetValue<string>());
    }

    [Fact]
    public async Task Rotation_StartupAdvanceMovesToAnotherWallpaper()
    {
        var context = new FakePluginHostContext("custom-wallpaper");
        WallpaperService service = CreateService(context, () => DateTimeOffset.UtcNow);
        await UploadIdAsync(service, PngBytes(21));
        await UploadIdAsync(service, PngBytes(22));
        await service.ApplySettingsAsync(new JsonObject
        {
            ["enabled"] = true,
            ["rotation"] = new JsonObject { ["mode"] = "startup" },
        });

        JsonObject first = await service.GetStateAsync();
        JsonObject second = await service.AdvanceRotationAsync("startup");

        Assert.NotEqual(first["currentId"]!.GetValue<string>(), second["currentId"]!.GetValue<string>());
    }

    [Fact]
    public async Task LegacyImport_MovesPayloadIntoSettingsAndRemovesMigrationScope()
    {
        var context = new FakePluginHostContext("custom-wallpaper");
        WallpaperService first = CreateService(context, () => DateTimeOffset.UtcNow);
        string assetId = await UploadIdAsync(first, PngBytes(31));
        await context.Config.WriteAsync(new WallpaperConfig { Assets = new List<WallpaperAssetRecord>(), Order = new List<string>() });
        await context.Assets.DeleteAsync(WallpaperService.AssetScope, assetId);
        PluginAssetInfo stored = await context.Assets.WriteAsync(
            WallpaperService.AssetScope,
            "png",
            new MemoryStream(PngBytes(31)));
        await context.ScopedData.WriteJsonAsync(WallpaperService.LegacyImportScope, new JsonObject
        {
            ["schemaVersion"] = 1,
            ["settings"] = new JsonObject
            {
                ["selectedId"] = stored.Id,
                ["providerEnabled"] = true,
                ["rotation"] = new JsonObject { ["mode"] = "timer", ["intervalMinutes"] = 15 },
                ["effects"] = new JsonObject { ["blurPx"] = 6, ["dimPercent"] = 30 },
            },
            ["assets"] = new JsonArray(new JsonObject
            {
                ["id"] = stored.Id,
                ["extension"] = "png",
                ["originalName"] = "旧壁纸.png",
                ["mimeType"] = "image/png",
                ["palette"] = new JsonObject { ["--accent"] = "#abcdef" },
                ["paletteVersion"] = 3,
            }),
        });

        WallpaperService service = CreateService(context, () => DateTimeOffset.UtcNow);
        await service.InitializeAsync();
        JsonObject state = await service.GetStateAsync();

        Assert.Single(state["assets"]!.AsArray());
        JsonObject asset = state["assets"]!.AsArray()[0]!.AsObject();
        Assert.Equal(stored.Id, asset["id"]!.GetValue<string>());
        Assert.Equal("旧壁纸.png", asset["originalName"]!.GetValue<string>());
        Assert.Equal("#abcdef", asset["palette"]!["--accent"]!.GetValue<string>());
        Assert.True(state["enabled"]!.GetValue<bool>());
        Assert.Equal("timer", state["rotation"]!["mode"]!.GetValue<string>());
        Assert.Equal(15, state["rotation"]!["intervalMinutes"]!.GetValue<int>());
        Assert.Equal(6, state["effects"]!["blurPx"]!.GetValue<int>());
        Assert.False(context.ScopedData.Contains(WallpaperService.LegacyImportScope));

        await service.InitializeAsync();
        JsonObject repeated = await service.GetStateAsync();
        Assert.Single(repeated["assets"]!.AsArray());
    }

    [Fact]
    public async Task LegacyImport_SkipsAssetsMissingFromStorage()
    {
        var context = new FakePluginHostContext("custom-wallpaper");
        await context.ScopedData.WriteJsonAsync(WallpaperService.LegacyImportScope, new JsonObject
        {
            ["schemaVersion"] = 1,
            ["assets"] = new JsonArray(new JsonObject
            {
                ["id"] = new string('b', 64),
                ["extension"] = "jpg",
                ["originalName"] = "缺失.jpg",
                ["mimeType"] = "image/jpeg",
            }),
        });

        WallpaperService service = CreateService(context, () => DateTimeOffset.UtcNow);
        await service.InitializeAsync();
        JsonObject state = await service.GetStateAsync();

        Assert.Empty(state["assets"]!.AsArray());
        Assert.Contains(context.Logger.Entries, entry => entry.Message.Contains("缺少资产文件", StringComparison.Ordinal));
    }
}
