using NexusPipeline.Extensions.GameActivities;

internal static class ViewFixture
{
    internal static async Task WriteAsync(string fixtures, string destination)
    {
        var docs = new TestDocuments(); var network = new TestNetwork();
        network.Handler = (uri, _) => Task.FromResult(new ActivityResponse(200, new Dictionary<string, string[]>(),
            File.ReadAllBytes(Path.Combine(fixtures, Path.GetFileName(uri.AbsolutePath)))));
        await using var service = new ActivityCoordinator(docs, network, new TestClock()); await service.InitializeAsync(default);
        await service.SaveAsync(Guid.NewGuid(), 0, new ActivitySettings { SelectedGames = ["blue-archive"],
            Progressions = new() { ["blue-archive"] = "cn", ["neverness-to-everness"] = "global" } }, default);
        await TestActivity.Idle(service);
        var result = new { state = await service.StateAsync(default), feeds = await Task.WhenAll(ActivitySources.All.Select(async source =>
            await service.FeedAsync(source.Id, default))) };
        await File.WriteAllBytesAsync(destination, ActivityJson.Bytes(result));
    }
}
