using System.Security.Cryptography;
using System.Text.Json;
using NexusPipeline.Extensibility.Frontend;
using NexusPipeline.Extensibility.Lifecycle;
using NexusPipeline.Extensibility.State;

namespace NexusPipeline.Extensions.CustomWallpaper;

internal sealed class WallpaperService(ExtensionActivationContext context) : IAsyncDisposable
{
    private const string DocumentName = "settings";
    private readonly SemaphoreSlim _serial = new(1, 1);
    private readonly WallpaperCursor _cursor = new();
    private static readonly JsonSerializerOptions StateOptions = new(WallpaperJson.Options)
    { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };
    private IExtensionDocuments Documents => context.Documents ?? throw new IOException("wallpaper_documents_unavailable");
    private IExtensionImages Images => context.Images ?? throw new IOException("wallpaper_images_unavailable");

    internal async ValueTask<FrontendResult> InvokeAsync(FrontendCall call, CancellationToken cancellation)
    {
        await _serial.WaitAsync(cancellation);
        try
        {
            if (call.Operation == "read-settings-result")
            {
                using var resultPayload = JsonDocument.Parse(call.Payload);
                var resultInput = resultPayload.RootElement;
                Members(resultInput, "operationId");
                var id = resultInput.GetProperty("operationId").GetGuid();
                if (id == Guid.Empty) throw new IOException("wallpaper_operation_required");
                var commit = await Documents.ReadCommitAsync(id, cancellation);
                return new("application/json", JsonSerializer.SerializeToUtf8Bytes(
                    new { operationId = id, committed = commit is not null }, StateOptions));
            }
            var (before, revision) = await LoadAsync(cancellation);
            if (call.Operation == "upload-asset")
            {
                var next = Upload(before, call);
                await SaveAsync(call, revision, next, new(call.ContentType, call.Payload), cancellation);
                return await StateAsync(cancellation);
            }
            using var payload = JsonDocument.Parse(call.Payload);
            var input = payload.RootElement;
            if (call.Operation == "read-asset")
            {
                Members(input, "assetId");
                var id = input.GetProperty("assetId").GetString()!;
                if (!before.Assets.Any(asset => asset.Id == id)) throw new IOException("wallpaper_asset_missing");
                var image = await Images.ReadAsync(id, cancellation);
                return new(image.Info.ContentType, image.Content);
            }
            if (call.Operation == "read-state" || call.Operation == "advance-rotation")
            {
                Members(input);
                return await StateAsync(before, revision, cancellation);
            }
            var nextDocument = call.Operation switch
            {
                "save-settings" => Patch(before, revision, input),
                "delete-asset" => Delete(before, input),
                "save-palette" => Palette(before, input),
                _ => throw new IOException("wallpaper_operation_unknown")
            };
            await SaveAsync(call, revision, nextDocument, null, cancellation);
            return await StateAsync(cancellation);
        }
        finally { _serial.Release(); }
    }

    private async ValueTask<(WallpaperDocument Document, long Revision)> LoadAsync(CancellationToken cancellation)
    {
        var saved = await Documents.ReadAsync(DocumentName, cancellation);
        var document = saved is null ? WallpaperDocument.Empty() : WallpaperJson.Read(saved.Json);
        var inventory = await Images.ListAsync(DocumentName, cancellation);
        if (inventory.Count != document.Assets.Length || document.Assets.Any(asset =>
            !inventory.Any(image => image.Id == asset.Id && image.SizeBytes == asset.SizeBytes)))
            throw new IOException("wallpaper_inventory_changed");
        return (document, saved?.Revision ?? 0);
    }

    private ValueTask<DocumentCommit> SaveAsync(FrontendCall call, long revision, WallpaperDocument document,
        ExtensionImageInput? addition, CancellationToken cancellation)
    {
        WallpaperJson.Validate(document);
        return Images.WriteAsync(call.OperationId ?? throw new IOException("wallpaper_operation_required"), DocumentName,
            revision, JsonSerializer.SerializeToUtf8Bytes(document, WallpaperJson.Options), document.Assets.Select(asset => asset.Id).ToArray(),
            addition, cancellation);
    }

    private async ValueTask<FrontendResult> StateAsync(CancellationToken cancellation)
    {
        var (document, revision) = await LoadAsync(cancellation);
        return await StateAsync(document, revision, cancellation);
    }

    private async ValueTask<FrontendResult> StateAsync(WallpaperDocument document, long revision, CancellationToken cancellation)
    {
        var session = context.Desktop is null ? null : await context.Desktop.ReadSessionAsync(cancellation);
        var (current, next) = _cursor.Resolve(document, session, DateTimeOffset.UtcNow);
        return new("application/json", JsonSerializer.SerializeToUtf8Bytes(new
        {
            revision, document.Enabled, effectiveEnabled = document.Enabled && current is not null,
            assets = document.Assets.Select(asset => new { asset.Id, asset.Name, asset.SizeBytes,
                palette = asset.Palette.Count == 0 ? null : asset.Palette }), document.Order, document.SelectedId, currentId = current,
            rotation = new { document.Rotation.Mode, document.Rotation.IntervalMinutes, document.Rotation.EpochUnixMs, nextSwitchAt = next },
            document.Effects, limits = new { maxAssetBytes = 8388608, maxAssets = 32, maxTotalBytes = 268435456 }
        }, StateOptions));
    }

    private static WallpaperDocument Upload(WallpaperDocument before, FrontendCall call)
    {
        if (call.ContentType is not ("image/png" or "image/jpeg" or "image/webp") ||
            call.Payload.Length is < 1 or > 8388608 || call.FileName is not { Length: >= 1 and <= 256 })
            throw new IOException("wallpaper_upload_invalid");
        var id = Convert.ToHexStringLower(SHA256.HashData(call.Payload.Span));
        if (before.Assets.Any(asset => asset.Id == id)) return before;
        return before with
        {
            Assets = [.. before.Assets, new(id, call.FileName, call.Payload.Length, new(StringComparer.Ordinal))],
            Order = [.. before.Order, id], SelectedId = before.SelectedId ?? id
        };
    }

    private static WallpaperDocument Patch(WallpaperDocument before, long revision, JsonElement input)
    {
        Members(input, "revision", "patch");
        if (input.GetProperty("revision").GetInt64() != revision) throw new InvalidOperationException("wallpaper_revision_conflict");
        var patch = input.GetProperty("patch");
        Members(patch, "enabled", "selectedId", "order", "rotation", "effects");
        var result = before;
        if (patch.TryGetProperty("enabled", out var enabled)) result = result with { Enabled = enabled.GetBoolean() };
        if (patch.TryGetProperty("selectedId", out var selected)) result = result with { SelectedId = selected.GetString() };
        if (patch.TryGetProperty("order", out var order)) result = result with { Order = order.EnumerateArray().Select(item => item.GetString()!).ToArray() };
        if (patch.TryGetProperty("effects", out var effects))
            result = result with { Effects = effects.Deserialize<WallpaperEffects>(WallpaperJson.Options) ?? throw new JsonException("wallpaper_effects_invalid") };
        if (patch.TryGetProperty("rotation", out var rotation))
        {
            Members(rotation, "mode", "intervalMinutes", "epochUnixMs", "nextSwitchAt");
            var mode = rotation.GetProperty("mode").GetString()!;
            var interval = rotation.GetProperty("intervalMinutes").GetInt32();
            var epoch = mode == before.Rotation.Mode && interval == before.Rotation.IntervalMinutes ?
                before.Rotation.EpochUnixMs : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            result = result with { Rotation = new(mode, interval, epoch) };
        }
        WallpaperJson.Validate(result);
        return result;
    }

    private static WallpaperDocument Delete(WallpaperDocument before, JsonElement input)
    {
        Members(input, "id");
        var id = input.GetProperty("id").GetString();
        if (!before.Assets.Any(asset => asset.Id == id)) throw new IOException("wallpaper_asset_missing");
        var order = before.Order.Where(value => value != id).ToArray();
        return before with { Assets = before.Assets.Where(asset => asset.Id != id).ToArray(), Order = order,
            SelectedId = before.SelectedId == id ? order.FirstOrDefault() : before.SelectedId };
    }

    private static WallpaperDocument Palette(WallpaperDocument before, JsonElement input)
    {
        Members(input, "id", "palette");
        var id = input.GetProperty("id").GetString();
        if (!before.Assets.Any(asset => asset.Id == id)) throw new IOException("wallpaper_asset_missing");
        var palette = input.GetProperty("palette").Deserialize<Dictionary<string, string>>(WallpaperJson.Options)
            ?? throw new JsonException("wallpaper_palette_invalid");
        WallpaperJson.ValidatePalette(palette);
        return before with { Assets = before.Assets.Select(asset => asset.Id == id ? asset with { Palette = palette } : asset).ToArray() };
    }

    private static void Members(JsonElement value, params string[] names)
    {
        if (value.ValueKind != JsonValueKind.Object || value.EnumerateObject().Any(member => !names.Contains(member.Name, StringComparer.Ordinal)))
            throw new JsonException("wallpaper_request_invalid");
    }

    public ValueTask DisposeAsync()
    {
        _serial.Dispose();
        return ValueTask.CompletedTask;
    }
}
