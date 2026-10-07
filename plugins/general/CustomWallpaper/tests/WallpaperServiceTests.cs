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
    public async Task RemoteReadsAndStartupRotationKeepStoredConfigAndRuntimeBytes()
    {
        var context = new FakePluginHostContext("CustomWallpaper");
        var service = CreateService(context, () => DateTimeOffset.UtcNow);
        await service.InitializeAsync();
        await UploadIdAsync(service, PngBytes(21));
        await UploadIdAsync(service, PngBytes(22));
        await service.ApplySettingsAsync(new JsonObject { ["enabled"] = true, ["rotation"] = new JsonObject { ["mode"] = "startup" } });
        string config = (await context.Config.ReadAsync<JsonObject>())!.ToJsonString();
        string? runtime = (await context.ScopedData.ReadJsonAsync(WallpaperService.RotationScope))?.ToJsonString();
        var web = new WallpaperWebApi(service); web.Register(context.WebApi);
        var route = context.WebApi.Routes.Single(item => item.Route == "rotation/advance-session");
        foreach (var kind in new[] { PluginClientConnectionKind.Remote, PluginClientConnectionKind.Unknown })
        {
            var response = await route.Handler(new("POST", route.Route, new Dictionary<string, string>(), null, kind), CancellationToken.None);
            Assert.Equal(200, response.StatusCode);
            await service.GetStateAsync();
            Assert.Equal(config, (await context.Config.ReadAsync<JsonObject>())!.ToJsonString());
            Assert.Equal(runtime, (await context.ScopedData.ReadJsonAsync(WallpaperService.RotationScope))?.ToJsonString());
        }
        web.Dispose();
    }

    private static JsonObject TimerContract() => JsonNode.Parse(
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "fixtures", "timer-contract.json")))!.AsObject();

    private static void AssertTimerFrame(JsonObject expected, JsonObject state)
    {
        Assert.Equal(expected["currentId"]!.GetValue<string>(), state["currentId"]!.GetValue<string>());
        Assert.Equal(expected["revision"]!.GetValue<long>(), state["revision"]!.GetValue<long>());
        Assert.True(JsonNode.DeepEquals(expected["rotation"], state["rotation"]));
    }

    [Fact]
    public async Task Rotation_TimerSlotChangesCurrentWallpaperAndReportsNextSwitch()
    {
        JsonObject contract = TimerContract();
        DateTimeOffset now = DateTimeOffset.FromUnixTimeMilliseconds(contract["epochUnixMs"]!.GetValue<long>());
        var context = new FakePluginHostContext("custom-wallpaper");
        var stores = new CountingStores(context);
        var service = new WallpaperService(stores, stores, context.Assets, context.Logger, () => now);
        string first = await UploadIdAsync(service, PngBytes(11));
        string second = await UploadIdAsync(service, PngBytes(12));
        await context.ScopedData.WriteAsync(WallpaperService.RotationScope, new WallpaperRotationRuntime { LastRandomId = second });
        JsonObject configured = await service.ApplySettingsAsync(new JsonObject
        {
            ["enabled"] = true,
            ["rotation"] = new JsonObject { ["mode"] = "timer", ["intervalMinutes"] = 1, ["epochUnixMs"] = now.ToUnixTimeMilliseconds() },
        });
        AssertTimerFrame(contract["before"]!.AsObject(), configured);
        string config = (await context.Config.ReadAsync<JsonObject>())!.ToJsonString();
        string runtime = (await context.ScopedData.ReadJsonAsync(WallpaperService.RotationScope))!.ToJsonString();
        int writes = stores.Writes;
        now = DateTimeOffset.FromUnixTimeMilliseconds(contract["boundaryUnixMs"]!.GetValue<long>());
        for (int index = 0; index < 4; index++)
        {
            AssertTimerFrame(contract["before"]!.AsObject(), await service.GetStateAsync());
            Assert.Equal(writes, stores.Writes);
            Assert.Equal(config, (await context.Config.ReadAsync<JsonObject>())!.ToJsonString());
            Assert.Equal(runtime, (await context.ScopedData.ReadJsonAsync(WallpaperService.RotationScope))!.ToJsonString());
            now = now.AddSeconds(1);
        }
        await service.CheckTimerAsync(CancellationToken.None);
        Assert.Equal(writes + 1, stores.Writes);
        AssertTimerFrame(contract["committed"]!.AsObject(), await service.GetStateAsync());
        WallpaperRotationRuntime committed = (await context.ScopedData.ReadAsync<WallpaperRotationRuntime>(WallpaperService.RotationScope))!;
        Assert.Equal(1, committed.TimerSlot);
        Assert.Equal(second, committed.LastRandomId);
        Assert.Equal(config, (await context.Config.ReadAsync<JsonObject>())!.ToJsonString());
        await service.CheckTimerAsync(CancellationToken.None);
        Assert.Equal(writes + 1, stores.Writes);
    }

    [Fact]
    public async Task Rotation_SingleAssetAdvancesDeadlineWithoutChangingImageOrRevision()
    {
        JsonObject contract = TimerContract();
        DateTimeOffset now = DateTimeOffset.FromUnixTimeMilliseconds(contract["epochUnixMs"]!.GetValue<long>());
        var context = new FakePluginHostContext("custom-wallpaper");
        WallpaperService service = CreateService(context, () => now);
        await UploadIdAsync(service, PngBytes(11));
        JsonObject configured = await service.ApplySettingsAsync(new JsonObject
        {
            ["enabled"] = true,
            ["rotation"] = new JsonObject { ["mode"] = "timer", ["intervalMinutes"] = 1, ["epochUnixMs"] = now.ToUnixTimeMilliseconds() },
        });
        AssertTimerFrame(contract["singleBefore"]!.AsObject(), configured);
        now = DateTimeOffset.FromUnixTimeMilliseconds(contract["commitUnixMs"]!.GetValue<long>());
        AssertTimerFrame(contract["singleBefore"]!.AsObject(), await service.GetStateAsync());
        await service.CheckTimerAsync(CancellationToken.None);
        AssertTimerFrame(contract["singleCommitted"]!.AsObject(), await service.GetStateAsync());
        Assert.Equal(1, (await context.ScopedData.ReadAsync<WallpaperRotationRuntime>(WallpaperService.RotationScope))!.TimerSlot);
    }

    [Fact]
    public async Task Rotation_UninitializedOrMismatchedRuntimeKeepsStableReadOnlyDeadline()
    {
        DateTimeOffset now = DateTimeOffset.FromUnixTimeMilliseconds(1_000_000);
        var context = new FakePluginHostContext("custom-wallpaper");
        var stores = new CountingStores(context);
        var service = new WallpaperService(stores, stores, context.Assets, context.Logger, () => now);
        string id = await UploadIdAsync(service, PngBytes(11));
        foreach (long epoch in new long[] { 0, 900_000, 950_000 })
        {
            WallpaperConfig config = (await context.Config.ReadAsync<WallpaperConfig>())!;
            config.Enabled = true;
            config.Rotation = new() { Mode = "timer", IntervalMinutes = 2, EpochUnixMs = epoch };
            await context.Config.WriteAsync(config);
            await context.ScopedData.WriteAsync(WallpaperService.RotationScope,
                new WallpaperRotationRuntime { LastRandomId = id, TimerSlot = 4, TimerEpochUnixMs = 900_000, TimerIntervalMinutes = 1 });
            string beforeConfig = (await context.Config.ReadAsync<JsonObject>())!.ToJsonString();
            string beforeRuntime = (await context.ScopedData.ReadJsonAsync(WallpaperService.RotationScope))!.ToJsonString();
            int writes = stores.Writes;
            for (int index = 0; index < 10; index++)
            {
                JsonObject state = await service.GetStateAsync();
                Assert.Equal(id, state["currentId"]!.GetValue<string>());
                Assert.Equal(DateTimeOffset.FromUnixTimeMilliseconds(epoch), DateTimeOffset.Parse(state["rotation"]!["nextSwitchAt"]!.GetValue<string>()));
                now = now.AddSeconds(1);
            }
            Assert.Equal(writes, stores.Writes);
            Assert.Equal(beforeConfig, (await context.Config.ReadAsync<JsonObject>())!.ToJsonString());
            Assert.Equal(beforeRuntime, (await context.ScopedData.ReadJsonAsync(WallpaperService.RotationScope))!.ToJsonString());
            await service.CheckTimerAsync(CancellationToken.None);
            JsonObject committed = await service.GetStateAsync();
            Assert.True(DateTimeOffset.Parse(committed["rotation"]!["nextSwitchAt"]!.GetValue<string>()) > now);
            Assert.Equal(config.Revision, committed["revision"]!.GetValue<long>());
        }
    }

    private sealed class CountingStores(FakePluginHostContext context) : IPluginConfigStore, IPluginScopedDataStore
    {
        public int Writes { get; private set; }
        public ValueTask<T?> ReadAsync<T>(CancellationToken cancellationToken = default) => context.Config.ReadAsync<T>(cancellationToken);
        public ValueTask WriteAsync<T>(T value, CancellationToken cancellationToken = default)
        {
            Writes++;
            return context.Config.WriteAsync(value, cancellationToken);
        }
        public ValueTask<T?> ReadAsync<T>(string scope, CancellationToken cancellationToken = default) => context.ScopedData.ReadAsync<T>(scope, cancellationToken);
        public ValueTask WriteAsync<T>(string scope, T value, CancellationToken cancellationToken = default)
        {
            Writes++;
            return context.ScopedData.WriteAsync(scope, value, cancellationToken);
        }
        public ValueTask<JsonObject?> ReadJsonAsync(string scope, CancellationToken cancellationToken = default) => context.ScopedData.ReadJsonAsync(scope, cancellationToken);
        public ValueTask WriteJsonAsync(string scope, JsonObject value, CancellationToken cancellationToken = default)
        {
            Writes++;
            return context.ScopedData.WriteJsonAsync(scope, value, cancellationToken);
        }
        public ValueTask DeleteAsync(string scope, CancellationToken cancellationToken = default)
        {
            Writes++;
            return context.ScopedData.DeleteAsync(scope, cancellationToken);
        }
    }

    [Fact]
    public async Task InitializationPreservesUnsupportedAppearanceScope()
    {
        var context = new FakePluginHostContext("custom-wallpaper");
        const string scope = "legacy-appearance-import";
        var payload = new JsonObject { ["schemaVersion"] = 1, ["settings"] = new JsonObject { ["providerEnabled"] = true } };
        await context.ScopedData.WriteJsonAsync(scope, payload);
        string before = (await context.ScopedData.ReadJsonAsync(scope))!.ToJsonString();
        WallpaperService service = CreateService(context, () => DateTimeOffset.UtcNow);
        await service.InitializeAsync();
        await service.InitializeAsync();
        Assert.Equal(before, (await context.ScopedData.ReadJsonAsync(scope))!.ToJsonString());
        Assert.Empty((await service.GetStateAsync())["assets"]!.AsArray());
    }
}
