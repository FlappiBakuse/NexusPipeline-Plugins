using NexusPipeline.Extensions.EmulatorSupport;
using static Fixtures;

internal static class DiscoveryCases
{
    internal static void Run(Action<string, Action> run)
    {
        run("discovery-collects-all-vendors-and-every-installation-without-first-match", () => {
            var host = new Inventory(); host.Items[EmulatorVendor.LdPlayer] = [Install(EmulatorVendor.LdPlayer, "ld-one"), Install(EmulatorVendor.LdPlayer, "ld-two")];
            host.Items[EmulatorVendor.Nox] = [Install(EmulatorVendor.Nox, "nox")];
            host.Items[EmulatorVendor.BlueStacks] = [Install(EmulatorVendor.BlueStacks, "blue", [Config("bst.instance.Pie64.adb_port=5559")])];
            var result = new EmulatorDiscovery(host).DiscoverAsync(true, default).GetAwaiter().GetResult();
            Assert(result.State == "discovered" && result.Sources.Count == 4 && result.Sources.Select(source => source.Installation.Id).Distinct().Count() == 4);
            Assert(host.Commands.Count == 3 && host.Commands.Count(command => command.Arguments.Single() == "list2") == 2 && host.Commands.Count(command => command.Arguments.Single() == "list") == 1);
        });
        run("discovery-never-offers-android-to-pc-only-script", () => {
            var host = new Inventory(); var result = new EmulatorDiscovery(host).DiscoverAsync(false, default).GetAwaiter().GetResult(); Assert(result.State == "notApplicable" && host.Calls == 0);
        });
        foreach (var state in new[] { "empty", "exit", "timeout", "malformed" })
            run("discovery-cli-result-is-observable/" + state, () => {
                var host = new Inventory { State = state }; host.Items[EmulatorVendor.LdPlayer] = [Install(EmulatorVendor.LdPlayer)];
                var result = new EmulatorDiscovery(host).DiscoverAsync(true, default).GetAwaiter().GetResult();
                var expected = state switch { "empty" => "emulator_instance_list_empty", "exit" => "emulator_enumeration_exit", "timeout" => "emulator_enumeration_timeout", _ => "ldplayer_list_invalid" };
                Assert(result.State == "unavailable" && result.Diagnostics.Any(item => item.Code == expected));
            });
        run("one-vendor-failure-does-not-hide-another-discovered-vendor", () => {
            var host = new Inventory { State = "exit" }; host.Items[EmulatorVendor.LdPlayer] = [Install(EmulatorVendor.LdPlayer)];
            host.Items[EmulatorVendor.BlueStacks] = [Install(EmulatorVendor.BlueStacks, "blue", [Config("bst.instance.Pie64.adb_port=5559")])];
            var result = new EmulatorDiscovery(host).DiscoverAsync(true, default).GetAwaiter().GetResult();
            Assert(result.Sources.Single().Installation.Vendor == EmulatorVendor.BlueStacks && result.Diagnostics.Any(item => item.Code == "emulator_enumeration_exit"));
        });
        run("missing-vendors-stay-distinct-from-installed-but-unready", () => {
            var result = new EmulatorDiscovery(new Inventory()).DiscoverAsync(true, default).GetAwaiter().GetResult();
            Assert(result.State == "unavailable" && result.Diagnostics.Count == 3 && result.Diagnostics.All(item => item.Code == "emulator_vendor_not_installed"));
        });
    }
    private sealed class Inventory : IEmulatorInventory
    {
        internal readonly Dictionary<EmulatorVendor, EmulatorInstallation[]> Items = [];
        internal readonly List<EmulatorCommand> Commands = [];
        internal string State = "completed";
        internal int Calls;
        public ValueTask<IReadOnlyList<EmulatorInstallation>> DiscoverAsync(EmulatorLayout layout, CancellationToken cancellationToken)
        { Calls++; return ValueTask.FromResult<IReadOnlyList<EmulatorInstallation>>(Items.GetValueOrDefault(layout.Vendor) ?? []); }
        public ValueTask<EmulatorCommandResult> EnumerateAsync(EmulatorInstallation installation, EmulatorCommand command, CancellationToken cancellationToken)
        {
            Commands.Add(command); var output = State switch { "empty" => "", "malformed" => "ERROR not an instance list", _ => installation.Vendor == EmulatorVendor.LdPlayer ? "0,same name,0,0,1,123,456" : "nox,NoxPlayer,1,2,3,456" };
            return ValueTask.FromResult(new EmulatorCommandResult(State == "timeout" ? "timeout" : "completed", State == "exit" ? 1 : 0, output, "", "host-action"));
        }
    }
}
