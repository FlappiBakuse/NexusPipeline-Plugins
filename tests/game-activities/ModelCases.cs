using System.Text;
using NexusPipeline.Extensions.GameActivities;

internal static class ModelCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run, string fixtures)
    {
        foreach (var source in ActivitySources.All)
            await run("source-fields/" + source.File, () => Check.Sync(() =>
            {
                var parsed = SraFeed.Parse(source, File.ReadAllBytes(Path.Combine(fixtures, source.File + ".json")));
                Check.That(parsed.Content.FeedId == source.Id && parsed.Content.SnapshotId.Length == 64);
                Check.That(parsed.Content.Events.All(item => item.Id.Length == 64));
                using var expected = System.Text.Json.JsonDocument.Parse(File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "expected-time-values.json")));
                var points = new[] { parsed.Content.Overview.Start, parsed.Content.Overview.End }
                    .Concat(parsed.Content.Events.SelectMany(item => new[] { item.Start, item.PlayEnd })).Where(item => item is not null).ToArray();
                var values = expected.RootElement.GetProperty(source.File).EnumerateArray().ToArray();
                Check.That(points.Length == values.Length);
                for (var index = 0; index < points.Length; index++)
                {
                    Check.That(points[index]!.RawValue == values[index].GetProperty("raw").GetString());
                    Check.That(points[index]!.InstantUtc == DateTimeOffset.Parse(values[index].GetProperty("utc").GetString()!, System.Globalization.CultureInfo.InvariantCulture));
                }
                Check.That(source.Endpoint.AbsolutePath.EndsWith(source.File + ".json", StringComparison.Ordinal));
                if (source.File == "nte-en-US") Check.That(source.Locale == "en-US" && source.ProgressionId == "global");
                if (source.File == "end") Check.That(parsed.Content.Events.Any(item => item.Kind is not null));
            }));
        foreach (var source in ActivitySources.All)
            await run("known-source-default-offset/" + source.Id, () => Check.Sync(() =>
            {
                Check.That(ActivityTimes.Parse("2026-11-01T08:30:00", source)!.InstantUtc == DateTimeOffset.Parse("2026-11-01T00:30:00Z"));
                Check.That(ActivityTimes.Parse("2026-11-01T08:30:00Z", source)!.InstantUtc == DateTimeOffset.Parse("2026-11-01T08:30:00Z"));
                Check.That(ActivityTimes.Parse("2026-11-01T08:30:00-04:00", source)!.InstantUtc == DateTimeOffset.Parse("2026-11-01T12:30:00Z"));
                Check.That(ActivityTimes.Parse("2026-02-30T08:30:00", source)!.InstantUtc is null);
                Check.That(ActivityTimes.Parse("", source) is null);
            }));
        foreach (var (input, expected) in new[] { ("2026-03-29T03:00:00+02:00", "2026-03-29T01:00:00.0000000+00:00"),
            ("2026-11-01T01:30:00-04:00", "2026-11-01T05:30:00.0000000+00:00"),
            ("2026-11-01T01:30:00-05:00", "2026-11-01T06:30:00.0000000+00:00"),
            ("2026-10-25T12:00:00Z", "2026-10-25T12:00:00.0000000+00:00") })
            await run("explicit-time/" + input, () => Check.Sync(() => Check.That(ActivityTimes.Parse(input)?.InstantUtc?.ToString("O") == expected)));
        foreach (var input in new[] { "2026-10-25T12:00:00", "2026-11-01", "2026-11-01T01:30", "2026-02-30T10:00:00Z", "bad", "2026-10-25 12:00" })
            await run("unknown-time/" + input, () => Check.Sync(() =>
            { var parsed = ActivityTimes.Parse(input); Check.That(parsed?.InstantUtc is null && parsed?.RawValue == input && parsed.TimeBasis == "unknown"); }));
        await run("event-groups-and-invalid-interval", () => Check.Sync(() =>
        {
            var now = DateTimeOffset.Parse("2026-10-25T12:00Z");
            ActivityEvent Event(string? start, string? end) => new("id", "title", null, null, ActivityTimes.Parse(start), ActivityTimes.Parse(end), null);
            Check.That(ActivityTimes.Phase(Event("2026-10-25T11:00Z", "2026-10-25T13:00Z"), now) == "ongoing");
            Check.That(ActivityTimes.Phase(Event("2026-10-25T13:00Z", "2026-10-25T14:00Z"), now) == "upcoming");
            Check.That(ActivityTimes.Phase(Event("2026-10-25T10:00Z", "2026-10-25T12:00Z"), now) == "ended");
            Check.That(ActivityTimes.Phase(Event("2026-10-25T14:00Z", "2026-10-25T13:00Z"), now) == "unknown");
            Check.That(ActivityTimes.Phase(Event("2026-10-25T11:00", "2026-10-25T13:00"), now) == "unknown");
        }));
        await run("defaults-none-full-game-order", () => Check.Sync(() =>
        { var settings = new ActivitySettings().Validate(); Check.That(settings.GameOrder.Length == 8 && ActivitySources.All.Length == 11 && ActivitySources.Selected(settings).Length == 0); }));
        await run("progressions-persist-while-unsubscribed", () => Check.Sync(() =>
        {
            var settings = new ActivitySettings { Progressions = new() { ["blue-archive"] = "jp", ["neverness-to-everness"] = "global" } }.Validate();
            var enabled = (settings with { SelectedGames = ["neverness-to-everness", "blue-archive"] }).Validate();
            Check.That(ActivitySources.Selected(enabled).Select(s => s.Id).SequenceEqual(new[] { "blue-archive/jp", "neverness-to-everness/global" }));
        }));
        foreach (var settings in new[] { new ActivitySettings { GameOrder = ["blue-archive"] }, new ActivitySettings { SelectedGames = ["bad"] },
            new ActivitySettings { SelectedGames = ["blue-archive", "blue-archive"] }, new ActivitySettings { RotationSeconds = 0 },
            new ActivitySettings { Progressions = new() }, new ActivitySettings { PauseOnInteraction = false }, new ActivitySettings { FormatVersion = 2 } })
            await run("settings-reject/" + ActivityTimes.Hash(System.Text.Json.JsonSerializer.Serialize(settings)), () => Check.Reject(() => Check.Sync(() => settings.Validate())));
        foreach (var body in new[] { "{}", "{\"version\":\"1\",\"activities\":{}}", "{\"version\":\"1\",\"activities\":[{}]}",
            "{\"version\":\"1\",\"activities\":[],\"version\":\"2\"}", "{\"version\":\"1\",\"activities\":[{\"name\":4}]}" })
            await run("source-reject/" + ActivityTimes.Hash(body), () => Check.Reject(() => Check.Sync(() => SraFeed.Parse(ActivitySources.All[0], Encoding.UTF8.GetBytes(body)))));
        await run("unknown-saved-format-is-not-default", () => Check.Reject(() => Check.Sync(() => ActivityJson.Read<ActivitySettings>("{}"u8.ToArray()))));
        foreach (var alias in new[] { "\"FormatVersion\":1", "\"formatVersion\":1,\"FormatVersion\":1" })
            await run("settings-case-alias-rejected/" + alias, () => Check.Reject(() => Check.Sync(() =>
            {
                var canonical = System.Text.Encoding.UTF8.GetString(ActivityJson.Bytes(new ActivitySettings()));
                ActivityJson.Read<ActivitySettings>(System.Text.Encoding.UTF8.GetBytes(canonical.Replace("\"formatVersion\":1", alias, StringComparison.Ordinal)));
            })));
        await run("duplicate-titles-distinct-occurrences", () => Check.Sync(() =>
        {
            var parsed = SraFeed.Parse(ActivitySources.All[0], "{\"version\":\"1\",\"activities\":[{\"name\":\"same\"},{\"name\":\"same\"}]}"u8.ToArray());
            Check.That(parsed.Content.Events.Select(item => item.Id).Distinct().Count() == 2);
        }));
        foreach (var url in new[] { "http://i0.hdslb.com/a.png", "https://evil.test/a.png", "https://i0.hdslb.com.evil.test/a", "https://user@i0.hdslb.com/a", "https://i0.hdslb.com:444/a", "https://i0.hdslb.com/a#x" })
            await run("cover-origin-reject/" + url, () => Check.Sync(() => Check.That(!ActivityCovers.Allowed(url))));
        await run("cover-failure-preserves-text-no-announcement-link", () => Check.Sync(() =>
        {
            var parsed = SraFeed.Parse(ActivitySources.All[0], "{\"version\":\"1\",\"cover\":\"https://evil.test/a\",\"activities\":[{\"name\":\"text\",\"url\":\"https://evil.test\",\"cover\":\"http://i0.hdslb.com/a\"}]}"u8.ToArray());
            Check.That(parsed.Content.Events[0].Title == "text" && parsed.Content.Events[0].CoverUrl is null && parsed.Diagnostics.Contains("activity_cover_origin_rejected"));
        }));
    }
}
