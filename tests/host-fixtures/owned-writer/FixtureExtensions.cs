internal static partial class FixtureExtensions
{
    static partial void Dispatch(string[] args, ref Task<int?>? result) => result = RouteAsync(args);
    private static async Task<int?> RouteAsync(string[] args)
    {
        if (args is ["--pretask", "LaunchGamePC"] && File.Exists(Path.Combine(AppContext.BaseDirectory, "maa-startup-fixture.json")))
            return await MaaStartupFixture.RunAsync();
        if (args is ["maa-plugin", .. var maaArgs]) return await MaaPluginFixture.RunAsync(maaArgs);
        if (args is ["maa-plugin-harness", .. var maaHarnessArgs]) return await PluginSliceHarness.RunAsync(maaHarnessArgs, "maa-plugin");
        if (args is ["checkin-plugin", .. var checkinArgs]) return await GamePluginFixture.RunAsync(checkinArgs);
        if (args is ["checkin-plugin-harness", .. var checkinHarnessArgs]) return await PluginSliceHarness.RunAsync(checkinHarnessArgs, "checkin-plugin");
        if (args is ["bettergi-plugin", .. var bettergiArgs]) return await BetterGiPluginFixture.RunAsync(bettergiArgs);
        if (args is ["bettergi-plugin-harness", .. var bettergiHarnessArgs]) return await PluginSliceHarness.RunAsync(bettergiHarnessArgs, "bettergi-plugin");

        if (args is not ["process-output", .. var output]) return null;
        args = output;
        if (args is ["bettergi-restart", var bettergiConfiguration, var bettergiLog])
            return await BetterGiRetryOutput.RunAsync(bettergiConfiguration, bettergiLog);
        if (args is [var adapterMode, var configuration, var adapterLog] && adapterMode.StartsWith("bettergi-", StringComparison.Ordinal))
            return await BetterGiOutput.RunAsync(adapterMode, configuration, adapterLog);
        if (args is [var marchMode, var marchConfiguration, var marchLog] && marchMode.StartsWith("march7th-", StringComparison.Ordinal))
            return await March7thOutput.RunAsync(marchMode, marchConfiguration, marchLog);
        if (args is ["baah-restart", var baahConfiguration, var baahLog])
            return await BaahOutput.RunAsync(baahConfiguration, baahLog);
        if (args is ["baah-unknown", var unknownConfiguration, var unknownLog])
            return await BaahOutput.RunAsync(unknownConfiguration, unknownLog, failFirst: false);
        if (args is ["oknte-restart", var oknteConfiguration, var oknteLog])
            return await OkNteOutput.RunAsync(oknteConfiguration, oknteLog);
        if (args is ["native-resume", var extension, var resumeConfiguration, var resumeLog])
            return await NativeResumeOutput.RunAsync(extension, resumeConfiguration, resumeLog);
        return null;
    }
}
