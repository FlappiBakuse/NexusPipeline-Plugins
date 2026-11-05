using System.Text;
using NexusPipeline.Extensions.MaaFramework;

internal static class PolicyCases
{
    internal static IEnumerable<(string Name, Action Run)> All()
    {
        foreach (var completed in new[] { -1, 3, 4 })
            yield return ("repeat-rejects-invalid-offset-" + completed, () => {
                try { _ = MaaSessionPlan.Freeze([new("row", "source", "x", Encoding.UTF8.GetBytes("{}"), 3) { CompletedRepetitions = completed }]); }
                catch (IOException failure) when (failure.Message == "maa_session_task_invalid") { return; }
                throw new IOException("fixture_repetition_not_rejected");
            });
        yield return ("guard-legacy-command", () => Deny("{\"x\":{\"action\":\"Command\",\"exec\":\"never-execute\"}}", "Command"));
        yield return ("guard-object-screencap", () => Deny("{\"x\":{\"action\":{\"type\":\"Screencap\",\"param\":{\"filename\":\"never-write\"}}}}", "Screencap"));
        yield return ("guard-jsonc-escaped-command", () => Deny("{/*Command is not a text match*/\"x\":{\"action\":\"\\u0043ommand\",},}", "Command"));
        yield return ("guard-default-inherited-action", () => Deny("{\"Default\":{\"action\":{\"type\":\"Command\"}},\"x\":{\"action\":\"Default\"}}", "Command"));
        yield return ("guard-rejected-override-before-post", () => {
            DenyPlan("{\"x\":{\"action\":{\"type\":\"Command\"}}}", "Command");
            DenyPlan("{\"x\":{\"action\":\"Screencap\"}}", "Screencap");
        });
        yield return ("guard-description-and-entry-strings-are-data", () => {
            var text = "{\"Command\":{\"action\":\"DoNothing\",\"description\":\"Screencap Command \\\"action\\\":\\\"Command\\\"\"}}";
            MaaPipelineGuard.Check(MaaJson.Read(Encoding.UTF8.GetBytes(text)));
            _ = MaaSessionPlan.Freeze([new("row", "source", "Command", Encoding.UTF8.GetBytes(text), 1)]);
        });
        yield return ("guard-duplicate-action-not-accepted", () => {
            try { _ = MaaSessionPlan.Freeze([new("row", "source", "x", Encoding.UTF8.GetBytes("{\"x\":{\"action\":\"Command\",\"action\":\"DoNothing\"}}"), 1)]); }
            catch (MaaInputFailure failure) when (failure.Code == "maa_duplicate_field") { return; }
            throw new IOException("fixture_duplicate_not_rejected");
        });
    }
    private static void Deny(string text, string action)
    {
        try { MaaPipelineGuard.Check(MaaJson.Read(Encoding.UTF8.GetBytes(text))); }
        catch (IOException failure) when (failure.Message == "maa_native_action_requires_host_owner:" + action) { return; }
        throw new IOException("fixture_action_not_rejected");
    }
    private static void DenyPlan(string text, string action)
    {
        try { _ = MaaSessionPlan.Freeze([new("row", "source", "x", Encoding.UTF8.GetBytes(text), 1)]); }
        catch (IOException failure) when (failure.Message == "maa_native_action_requires_host_owner:" + action) { return; }
        throw new IOException("fixture_override_not_rejected");
    }
}
