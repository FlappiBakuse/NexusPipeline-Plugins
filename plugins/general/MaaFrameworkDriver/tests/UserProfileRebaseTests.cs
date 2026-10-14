using System.Text.Json.Nodes;
using Xunit;

namespace NexusPipeline.Plugin.MaaFrameworkDriver.Tests;

public sealed class UserProfileRebaseTests
{
    [Fact]
    public void EffectiveConfigurationChangesValuesButCannotRebindFrozenTaskIdentity()
    {
        var profile = new DriverProfile { ProfileId = "owned", PackageRoot = "trusted", NativeDirectory = "native",
            TaskOccurrences = [new() { OccurrenceId = "one", PiTaskName = "T", Options = new() { ["Choice"] = "old" } }] };
        var configuration = EffectiveConfiguration.FromProfile(profile);
        configuration["taskOccurrences"]![0]!["options"]!["Choice"] = "new";
        var modified = EffectiveConfiguration.Apply(profile, configuration);
        Assert.Equal("new", modified.TaskOccurrences[0].Options["Choice"]!.GetValue<string>());
        Assert.Equal("old", profile.TaskOccurrences[0].Options["Choice"]!.GetValue<string>());
        Assert.Equal(profile.PackageRoot, modified.PackageRoot);
        configuration["taskOccurrences"]![0]!["piTaskName"] = "Other";
        Assert.Throws<InvalidDataException>(() => EffectiveConfiguration.Apply(profile, configuration));
        configuration = EffectiveConfiguration.FromProfile(profile);
        configuration["packageRoot"] = "other";
        Assert.Throws<System.Text.Json.JsonException>(() => EffectiveConfiguration.Apply(profile, configuration));
    }

    [Fact]
    public void RebaseInheritsSourceChangesPreservesUserEditsAndRejectsRemovedEditedTasks()
    {
        var first = new TaskOccurrence { OccurrenceId = "first", SourceTaskId = "source-first", PiTaskName = "T", Enabled = true, RepeatCount = 1 };
        var original = new DriverProfile { SchemaVersion = 3, ProfileId = "profile", PackageRoot = "root", Revision = "old",
            TaskOccurrences = [first], Options = new() { ["inherited"] = 1, ["custom"] = 2 } };
        var user = original with { Revision = "user", ParentRevision = "old", TaskOccurrences = [first with { RepeatCount = 3 }],
            Options = new() { ["inherited"] = 1, ["custom"] = 9 }, AuthorizedFingerprint = "old-proof" };
        var second = first with { OccurrenceId = "second", SourceTaskId = "source-second" };
        var current = original with { Revision = "new", TaskOccurrences = [first with { Enabled = false }, second],
            Options = new() { ["inherited"] = 4, ["custom"] = 5, ["added"] = true } };
        var rebased = UserProfileRebase.Apply(original, current, user);
        Assert.Equal("new", rebased.ParentRevision); Assert.Equal("user", rebased.Revision); Assert.Empty(rebased.AuthorizedFingerprint);
        Assert.Equal(4, rebased.Options["inherited"]!.GetValue<int>()); Assert.Equal(9, rebased.Options["custom"]!.GetValue<int>());
        Assert.True(rebased.Options["added"]!.GetValue<bool>());
        Assert.False(rebased.TaskOccurrences[0].Enabled); Assert.Equal(3, rebased.TaskOccurrences[0].RepeatCount);
        Assert.Equal("second", rebased.TaskOccurrences[1].OccurrenceId);
        Assert.Throws<InvalidDataException>(() => UserProfileRebase.Apply(original, current with { TaskOccurrences = [second] }, user));
        Assert.Throws<InvalidDataException>(() => UserProfileRebase.Apply(original, current with { PackageRoot = "other" }, user));
        Assert.True(JsonNode.DeepEquals(original.Options, new JsonObject { ["inherited"] = 1, ["custom"] = 2 }));
    }
}
