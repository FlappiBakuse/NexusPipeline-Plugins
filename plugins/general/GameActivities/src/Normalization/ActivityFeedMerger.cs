using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.GameActivities;

internal static class ActivityFeedMerger
{
    public static void PreserveOfficialFields(JsonObject current, JsonObject previous)
    {
        if (current["overview"] is JsonObject overview && previous["overview"] is JsonObject cachedOverview
            && ActivityPolicy.Text(current["contentPeriod"]?["key"]) == ActivityPolicy.Text(previous["contentPeriod"]?["key"]))
            PreserveCover(overview, cachedOverview);
        var old = previous["activities"]!.AsArray().OfType<JsonObject>().ToDictionary(item => ActivityPolicy.Text(item["eventId"]), StringComparer.Ordinal);
        foreach (var item in current["activities"]!.AsArray().OfType<JsonObject>())
        {
            if (!old.TryGetValue(ActivityPolicy.Text(item["eventId"]), out var cached)) continue;
            PreserveCover(item, cached);
            var paths = new HashSet<string>(StringComparer.Ordinal);
            if (ActivityPolicy.Text(item["officialLinkKind"]) == "missing" && ActivityPolicy.Text(cached["officialLinkKind"]) != "missing")
                foreach (string field in new[] { "description", "descriptionTruncated", "officialUrl", "officialLinkKind", "category", "availability" })
                {
                    item[field] = cached[field]?.DeepClone();
                    paths.Add("/" + field);
                }
            foreach (string field in new[] { "start", "playEnd", "claimEnd" })
            {
                if (!Official(cached["times"]?[field]) || Official(item["times"]?[field])) continue;
                if (item["times"]?[field] is { } aggregate)
                {
                    var evidence = ActivityNormalizer.Evidence("/times/" + field, ActivityPolicy.Text(aggregate["sourceRef"]), "aggregate:original-time");
                    evidence["note"] = aggregate.ToJsonString(ActivityNormalizer.Json);
                    item["provenance"]!.AsArray().Add(evidence);
                }
                item["times"]![field] = cached["times"]![field]!.DeepClone();
                paths.Add("/times/" + field);
            }
            foreach (var evidence in cached["provenance"]!.AsArray())
                if (paths.Contains(ActivityPolicy.Text(evidence?["field"])) && ActivityPolicy.Text(evidence?["sourceRef"]).StartsWith("official:", StringComparison.Ordinal))
                    item["provenance"]!.AsArray().Add(evidence!.DeepClone());
        }
    }

    private static void PreserveCover(JsonObject current, JsonObject previous)
    {
        if (current["cover"]?["assetId"] is not null || previous["cover"]?["assetId"] is null) return;
        current["cover"] = previous["cover"]!.DeepClone();
        var provenance = current["provenance"]!.AsArray();
        foreach (var evidence in provenance.Where(value => ActivityPolicy.Text(value?["field"]) == "/cover").ToArray()) provenance.Remove(evidence);
        foreach (var evidence in previous["provenance"]!.AsArray())
            if (ActivityPolicy.Text(evidence?["field"]) == "/cover") provenance.Add(evidence!.DeepClone());
    }

    private static bool Official(JsonNode? time) => ActivityPolicy.Text(time?["sourceRef"]).StartsWith("official:", StringComparison.Ordinal);
}
