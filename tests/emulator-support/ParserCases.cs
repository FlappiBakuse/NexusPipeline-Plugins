using NexusPipeline.Extensions.EmulatorSupport;
using static Fixtures;

internal static class ParserCases
{
    internal static void Run(Action<string, Action> run)
    {
        run("ldplayer-official-seven-columns-preserve-index-window-state-and-pid", () => {
            var rows = LdPlayerPolicy.Parse("0,LDPlayer,2032678,1704928,1,7456,3500\n1,LDPlayer-1,0,0,0,-1,0").Instances;
            Assert(rows.Count == 2 && rows[0].Index == 0 && rows[0].ProcessId == 7456 && rows[1].ProcessId is null && rows[1].CandidatePorts.SequenceEqual(new[] { 5556, 5557 }));
        });
        run("ldplayer-title-comma-does-not-shift-pid-or-identity", () => {
            var row = LdPlayerPolicy.Parse("2,name,with,comma,0,0,1,1234,5678").Instances.Single(); Assert(row.DisplayName == "name,with,comma" && row.ProcessId == 1234 && row.Index == 2);
        });
        run("ldplayer-compact-external-format-has-no-guessed-pid", () => Assert(LdPlayerPolicy.Parse("3,one").Instances.Single().ProcessId is null));
        foreach (var invalid in new[] { "error: list unavailable", "-1,bad", "29991,overflow", "0,name,0,0,2,123,456", "0,name\n00,alias", "0,name,0,0,1,not-pid,0" })
            run("ldplayer-reject/" + invalid, () => Reject(() => LdPlayerPolicy.Parse(invalid)));
        run("nox-official-vm-identity-and-display-selector-remain-distinct", () => {
            var row = NoxPolicy.Parse("nox,NoxPlayer,2032678,1704928,3567547,7456", [Config("<VirtualBox><Machine><Forwarding name=\"adb\" proto=\"1\" hostport=\"62001\" guestport=\"5555\"/></Machine></VirtualBox>", "nox/nox.vbox")]).Instances.Single();
            Assert(row.Identity == "nox" && row.ControlName == "NoxPlayer" && row.ProcessId == 7456 && row.CandidatePorts.Single() == 62001);
        });
        run("nox-numeric-legacy-list-retains-explicit-index-without-pid-guess", () => {
            var row = NoxPolicy.Parse("0,Android7,started", []).Instances.Single(); Assert(row.Identity == "Android7" && row.Index == 0 && row.ControlName is null && row.ProcessId is null);
        });
        run("nox-labelled-and-whitespace-formats-use-bounded-explicit-fields", () => {
            Assert(NoxPolicy.Parse("index=1 name=Android7 pid=1234", []).Instances.Single().ProcessId == 1234);
            Assert(NoxPolicy.Parse("nox  NoxPlayer", []).Instances.Single().Identity == "nox");
        });
        run("nox-colon-external-format-retains-index", () => Assert(NoxPolicy.Parse("1:Android7:started", []).Instances.Single().Index == 1));
        run("nox-negative-index-cannot-become-named-vm", () => Reject(() => NoxPolicy.Parse("-1,Android7,started", []), "nox_index_invalid"));
        run("nox-only-guest-adb-tcp-loopback-forwarding-counts", () => {
            var ports = NoxPolicy.Ports("<VirtualBox><Forwarding hostport=\"22\" guestport=\"22\"/><Forwarding proto=\"2\" hostport=\"62002\" guestport=\"5555\"/><Forwarding hostip=\"10.0.0.1\" hostport=\"62003\" guestport=\"5555\"/><Forwarding hostport=\"62001\" guestport=\"5555\"/></VirtualBox>");
            Assert(ports.SequenceEqual(new[] { 62001 }));
        });
        run("nox-identity-does-not-use-path-substring", () => {
            var row = NoxPolicy.Parse("nox,NoxPlayer,1,2,3,4", [Config("<VirtualBox><Forwarding hostport=\"62001\" guestport=\"5555\"/></VirtualBox>", "nox2/nox2.vbox")]).Instances.Single(); Assert(row.CandidatePorts.Count == 0);
        });
        foreach (var invalid in new[] { "<!DOCTYPE VirtualBox [<!ENTITY e SYSTEM 'file:///C:/secret'>]><VirtualBox>&e;</VirtualBox>", "<VirtualBox>", "<VirtualBox><Forwarding hostport=\"65536\" guestport=\"5555\"/></VirtualBox>" })
            run("nox-vbox-reject/" + invalid.Length, () => Reject(() => NoxPolicy.Ports(invalid)));
        run("nox-duplicate-vm-mapping-is-ambiguous", () => Reject(() => NoxPolicy.Parse("nox,NoxPlayer,1,2,3,4", [Config("<VirtualBox/>", "nox/nox.vbox", "one"), Config("<VirtualBox/>", "nox/copy.vbox", "two")])));
        run("bluestacks-status-port-precedes-static-port-without-changing-instance-id", () => {
            var rows = BlueStacksPolicy.Parse(Config("bst.instance.Pie64.adb_port=\"5555\"\nbst.instance.Pie64.status.adb_port=\"5557\"\nbst.instance.Pie64.display_name=\"same display\"\nbst.instance.Nougat32.adb_port=\"5559\"")).Instances;
            Assert(rows.Count == 2 && rows.Single(row => row.Identity == "Pie64").CandidatePorts.Single() == 5557);
        });
        foreach (var content in new[] { "{\"instance.Pie64.adb_port\":5555}", "{\"Pie64\":{\"adbPort\":5555}}", "{\"bst\":{\"instance\":{\"Pie64\":{\"adb_port\":5555}}}}" })
            run("bluestacks-external-json-format/" + content.Length, () => Assert(BlueStacksPolicy.Parse(Config(content)).Instances.Single().Identity == "Pie64"));
        run("bluestacks-unrelated-json-arrays-do-not-remove-known-instance-or-original-bytes", () => {
            var config = Config("{\"instance.Pie64.adb_port\":5555,\"unknown\":[1,{\"other\":true}]}"); var original = config.Bytes.ToArray();
            Assert(BlueStacksPolicy.Parse(config).Instances.Single().Identity == "Pie64" && config.Bytes.Span.SequenceEqual(original));
        });
        run("bluestacks-zero-port-is-visible-unready-and-status-zero-keeps-static-candidate", () => {
            var rows = BlueStacksPolicy.Parse(Config("bst.instance.Pie64.adb_port=5555\nbst.instance.Pie64.status.adb_port=0\nbst.instance.Nougat32.adb_port=0")).Instances;
            Assert(rows.Single(row => row.Identity == "Pie64").CandidatePorts.Single() == 5555 && rows.Single(row => row.Identity == "Nougat32").CandidatePorts.Count == 0);
        });
        foreach (var invalid in new[] { "bst.instance.Pie64.adb_port=\"65536\"", "bst.instance.Pie64.adb_port=\"5555\"\nbst.instance.Pie64.adb_port=\"5555\"", "{\"Pie64\":{\"adbPort\":5555,\"adbPort\":5555}}", "garbage output" })
            run("bluestacks-reject/" + invalid.Length, () => Reject(() => BlueStacksPolicy.Parse(Config(invalid))));
        run("vendor-empty-output-has-explicit-empty-state", () => {
            Assert(LdPlayerPolicy.Parse("").State == "empty" && NoxPolicy.Parse("", []).State == "empty" && BlueStacksPolicy.Parse(Config("# comment only")).State == "empty");
        });
    }
}
