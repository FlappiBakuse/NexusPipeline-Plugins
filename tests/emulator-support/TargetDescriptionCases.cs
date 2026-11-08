using NexusPipeline.Extensions.EmulatorSupport;
using static Fixtures;

internal static class TargetDescriptionCases
{
    internal static void Run(Action<string, Action> run)
    {
        run("saved-vendor-target-identities-remain-stable", () => {
            Assert(Target(EmulatorVendors.LdPlayer).Id == "77f0fb19d4a7a72bd2cc77fff8e9eb5abd0aa5fe5db3ae05f159903d0692a173");
            Assert(Target(EmulatorVendors.Nox).Id == "a454dcc48852c204c2d4fec80cd15394a2a445f83897a8cf5c6bbb5a67e81631");
            Assert(Target(EmulatorVendors.BlueStacks).Id == "c836950866bd128e99867efee8f0eb3a2e845dc1d3c3eb15fe9844a38593c844");
        });
        run("vendor-description-declares-frozen-command-and-instance-location", () => {
            var provider = new EmulatorProvider();
            var ld = provider.Describe(Target(EmulatorVendors.LdPlayer));
            Assert(ld.Launch.Arguments.SequenceEqual(new[] { "launch", "--index", "0" }) &&
                ld.Quit!.Arguments.SequenceEqual(new[] { "quit", "--index", "0" }) && ld.Locations.Single().RelativePath == "vms/leidian0");
            var nox = provider.Describe(Target(EmulatorVendors.Nox));
            Assert(nox.Launch.Arguments.SequenceEqual(new[] { "launch", "-name:NoxPlayer" }));
            var blue = provider.Describe(Target(EmulatorVendors.BlueStacks));
            Assert(blue.Launch.Detached && blue.Quit is null && blue.Launch.Arguments.SequenceEqual(new[] { "--instance", "Pie64" }));
            Assert(provider.Layouts.Single(value => value.Vendor == EmulatorVendors.Nox).ControlParentDirectories.Contains("bin"));
        });
        run("vendor-instance-directory-is-derived-only-from-selected-configurations", () => {
            var target = Target(EmulatorVendors.Nox);
            var chosen = Config("<VirtualBox/>", "BignoxVMS/nox/nox.vbox", "selected");
            target = target with { Installation = target.Installation with { Configurations = [chosen, Config("<VirtualBox/>", "BignoxVMS/other/other.vbox", "other")] },
                Instance = target.Instance with { ConfigIds = [chosen.Id] } };
            var location = EmulatorTargetPolicy.Describe(target).Locations.Single();
            Assert(location.ConfigurationId == "selected" && location.RelativePath == ".");
        });
    }
}
