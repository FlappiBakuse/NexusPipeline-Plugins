using NexusPipeline.Extensions.EmulatorSupport;
using static Fixtures;

internal static class SelectionCases
{
    internal static void Run(Action<string, Action> run)
    {
        foreach (var vendor in Enum.GetValues<EmulatorVendor>())
        {
            run("target-has-physical-install-tool-and-explicit-instance/" + vendor, () => {
                var target = Target(vendor); Assert(target.Id.Length == 64 && target.Fingerprint.Length == 64 && target.Instance.DisplayName == "same display");
                var other = target.Installation with { Id = "other", RootPhysicalId = "other-physical-root" };
                Assert(EmulatorSelection.Identity(other, target.Instance) != target.Id);
                Reject(() => EmulatorSelection.Select([(target.Installation, new("enumerated", [target.Instance]))], target.Id, target.Endpoint, false), "emulator_script_android_unsupported");
            });
            run("target-cannot-follow-updated-reinstalled-or-replaced-tool/" + vendor, () => {
                var target = Target(vendor);
                foreach (var changed in new[] { target.Installation with { Control = target.Installation.Control with { Sha256 = new string('b', 64) } },
                    target.Installation with { RootPhysicalId = "replacement-root" }, target.Installation with { Adb = target.Installation.Adb! with { Revision = 2 } } })
                    Reject(() => EmulatorSelection.Verify(target, changed, target.Instance), "emulator_target_changed");
                Reject(() => EmulatorSelection.Verify(target, target.Installation, target.Instance with { CandidatePorts = [5557] }), "emulator_target_changed");
            });
            run("exact-process-requires-frozen-host-evidence-not-just-pid/" + vendor, () => {
                var target = Target(vendor); var process = Process(target);
                Assert(EmulatorSelection.Process(target, target.Instance, [process], process)?.EvidenceId == process.EvidenceId);
                Assert(EmulatorSelection.Process(target, target.Instance, [process], null) is null);
                foreach (var changed in new[] { process with { StartedAt = process.StartedAt.AddSeconds(1) }, process with { EvidenceId = "other-proof" },
                    process with { ImagePhysicalId = "other-image" }, process with { InstallationId = "other-install" } })
                    Assert(EmulatorSelection.Process(target, target.Instance, [changed], process) is null);
            });
        }
        foreach (var invalid in new[] { "10.0.0.1:5555", "127.0.0.1:0", "127.0.0.1:65536", "127.0.0.1:+5555", "localhost:5555/path", "evil.localhost:5555" })
            run("endpoint-reject/" + invalid, () => Reject(() => EmulatorPaths.Endpoint(invalid), "emulator_endpoint_invalid"));
        run("endpoint-canonicalizes-local-alias-without-dns-and-keeps-ipv6", () => {
            Assert(EmulatorPaths.Endpoint("localhost:5555") == "127.0.0.1:5555" && EmulatorPaths.Endpoint("[::1]:5555") == "[::1]:5555");
        });
        run("same-display-multiple-installations-require-explicit-source-and-unique-port", () => {
            var target = Target(EmulatorVendor.LdPlayer); var other = Install(EmulatorVendor.LdPlayer, "second-install");
            var second = target.Instance with { CandidatePorts = [5557] }; var sources = new[] { (target.Installation, new EmulatorEnumeration("enumerated", [target.Instance])), (other, new EmulatorEnumeration("enumerated", [second])) };
            var selected = EmulatorSelection.Select(sources, EmulatorSelection.Identity(other, second), "127.0.0.1:5557", true);
            Assert(selected.Installation.Id == other.Id);
            Reject(() => EmulatorSelection.Select(sources, target.Instance.DisplayName, target.Endpoint, true), "emulator_instance_deleted");
            Reject(() => EmulatorSelection.Select([(target.Installation, new("enumerated", [target.Instance])), (other, new("enumerated", [target.Instance]))], target.Id, target.Endpoint, true), "emulator_endpoint_ambiguous");
        });
        run("bluestacks-process-requires-one-exact-instance-argv-and-one-proof", () => {
            var target = Target(EmulatorVendor.BlueStacks); var process = Process(target);
            Assert(BlueStacksPolicy.Process(target, [process with { Arguments = ["--instance", "Pie64_2"] }]) is null);
            Assert(BlueStacksPolicy.Process(target, [process with { Arguments = ["--instance", "Pie64", "--instance", "Pie64_2"] }]) is null);
            Assert(BlueStacksPolicy.Process(target, [process, process with { EvidenceId = "second", ProcessId = 4321 }]) is null);
        });
        run("frozen-source-detects-original-byte-sha-changes-and-keeps-utf16", () => {
            var bytes = System.Text.Encoding.Unicode.GetPreamble().Concat(System.Text.Encoding.Unicode.GetBytes("<VirtualBox/>")).ToArray();
            var config = new EmulatorConfig("cfg", "nox/nox.vbox", "physical", Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(bytes)), 1, bytes);
            config.Validate(); Assert(EmulatorText.Decode(config.Bytes.Span) == "<VirtualBox/>"); bytes[^1] = 1; Reject(config.Validate, "emulator_config_identity_invalid");
        });
        run("tool-paths-refuse-traversal-ads-outside-root-and-command-files", () => {
            var installation = Install(EmulatorVendor.Nox); installation.Validate();
            foreach (var path in new[] { "C:\\Other\\NoxConsole.exe", "C:\\Tools\\installation\\..\\NoxConsole.exe", "C:\\Tools\\installation\\NoxConsole.exe:stream", "C:\\Tools\\installation\\NoxConsole.cmd" })
                Reject(() => (installation with { Control = installation.Control with { Path = path } }).Validate());
        });
        run("configuration-snapshot-rejects-path-and-physical-aliases", () => {
            var first = Config("<VirtualBox/>", "nox/nox.vbox", "one");
            foreach (var second in new[] { first with { Id = "two", PhysicalId = "other", RelativePath = "NOX/NOX.VBOX" },
                first with { Id = "two", RelativePath = "nox/copy.vbox" } })
                Reject(() => Install(EmulatorVendor.Nox, "nox", [first, second]).Validate(), "emulator_config_set_invalid");
        });
    }
}
