namespace NexusPipeline.AndroidToolFixture;

internal static partial class FixtureExtensions
{
    static partial void Dispatch(string[] args, ref Task<int?>? result) =>
        result = EmulatorVendorFixture.RunAsync(AppContext.BaseDirectory, args);
}
