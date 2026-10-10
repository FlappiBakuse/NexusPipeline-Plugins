using System.Globalization;
using System.Text.Json.Nodes;

namespace NexusPipeline.Plugin.GameActivities;

internal static class EventIdentityResolver
{
    public static void Reconcile(JsonObject current, JsonObject previous)
    {
        if (ActivityPolicy.Text(current["gameId"]) != ActivityPolicy.Text(previous["gameId"])
            || ActivityPolicy.Text(current["progressionId"]) != ActivityPolicy.Text(previous["progressionId"])
            || ActivityPolicy.Text(current["contentLocale"]) != ActivityPolicy.Text(previous["contentLocale"])) return;
        var items = current["activities"]!.AsArray().OfType<JsonObject>().ToArray();
        var old = previous["activities"]!.AsArray().OfType<JsonObject>().ToArray();
        var used = items.Select(item => ActivityPolicy.Text(item["eventId"])).ToHashSet(StringComparer.Ordinal);
        foreach (var item in items)
        {
            string incomingId = ActivityPolicy.Text(item["eventId"]);
            if (old.Any(candidate => ActivityPolicy.Text(candidate["eventId"]) == incomingId)) continue;
            var candidates = old.Where(candidate => !used.Contains(ActivityPolicy.Text(candidate["eventId"])) && SameEntity(item, candidate, current, previous)).ToArray();
            if (candidates.Length != 1 || items.Count(candidate => SameEntity(candidate, candidates[0], current, previous)) != 1) continue;
            string stableId = ActivityPolicy.Text(candidates[0]["eventId"]);
            string sourceRef = ActivityPolicy.Text(item["provenance"]![0]?["sourceRef"]);
            item["eventId"] = stableId;
            var evidence = ActivityNormalizer.Evidence("/eventId", sourceRef, "provider:identity-alias", "derived", "same-batch-identity-v1");
            evidence["note"] = "Incoming provider fingerprint: " + incomingId;
            item["provenance"]!.AsArray().Add(evidence);
            used.Add(stableId);
        }
    }

    public static bool IsOlderVersion(JsonObject current, JsonObject previous)
    {
        string next = ActivityPolicy.Text(current["version"]?["number"]), old = ActivityPolicy.Text(previous["version"]?["number"]);
        return Version.TryParse(next, out var nextVersion) && Version.TryParse(old, out var oldVersion) && nextVersion < oldVersion;
    }

    private static bool SameEntity(JsonObject current, JsonObject previous, JsonObject currentFeed, JsonObject previousFeed)
    {
        if (ActivityPolicy.Text(current["category"]) != ActivityPolicy.Text(previous["category"])
            || ActivityPolicy.Text(current["channel"]) != ActivityPolicy.Text(previous["channel"])) return false;
        bool bothExact = ActivityPolicy.Text(current["officialLinkKind"]) == "exact-activity"
            && ActivityPolicy.Text(previous["officialLinkKind"]) == "exact-activity"
            && ActivityPolicy.Text(current["officialUrl"]).Length > 0 && ActivityPolicy.Text(previous["officialUrl"]).Length > 0;
        if (bothExact && ActivityPolicy.Text(current["officialUrl"]) != ActivityPolicy.Text(previous["officialUrl"])) return false;
        bool exactNotice = bothExact
            && ActivityPolicy.Text(current["officialUrl"]) == ActivityPolicy.Text(previous["officialUrl"]);
        bool sameNameAndPeriod = ActivityPolicy.Text(current["title"]).Normalize() == ActivityPolicy.Text(previous["title"]).Normalize()
            && ActivityPolicy.Text(currentFeed["contentPeriod"]?["key"]).Length > 0
            && ActivityPolicy.Text(currentFeed["contentPeriod"]?["key"]) == ActivityPolicy.Text(previousFeed["contentPeriod"]?["key"]);
        if (!exactNotice && !sameNameAndPeriod) return false;
        var start = Calendar(current, "start"); var end = Calendar(current, "playEnd");
        var oldStart = Calendar(previous, "start"); var oldEnd = Calendar(previous, "playEnd");
        // Same-provider wall clocks can identify an overlapping batch without inventing a UTC offset.
        return start is not null && end is not null && oldStart is not null && oldEnd is not null
            && start < oldEnd && oldStart < end;
    }

    private static DateTime? Calendar(JsonObject item, string field)
    {
        string raw = ActivityPolicy.Text(item["times"]?[field]?["rawValue"]);
        foreach (var evidence in item["provenance"]!.AsArray())
        {
            if (ActivityPolicy.Text(evidence?["field"]) != "/times/" + field || ActivityPolicy.Text(evidence?["locator"]) != "aggregate:original-time") continue;
            var original = JsonNode.Parse(ActivityPolicy.Text(evidence?["note"]));
            raw = ActivityPolicy.Text(original?["rawValue"]);
        }
        return DateTime.TryParseExact(raw, "yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var calendar) ? calendar : null;
    }
}
