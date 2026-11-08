using System.Security.Cryptography;
using System.Text;
using NexusPipeline.Extensions.EmulatorSupport;

internal static class Fixtures
{
    internal static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
    internal static void Reject(Action action, string? code = null)
    {
        try { action(); } catch (EmulatorFailure error) when (code is null || error.Code == code) { return; }
        throw new InvalidOperationException("rejection_expected_" + code);
    }
    internal static EmulatorConfig Config(string content, string path = "bluestacks.conf", string id = "config")
    { var bytes = Encoding.UTF8.GetBytes(content); return new(id, path, "physical:" + id, Convert.ToHexStringLower(SHA256.HashData(bytes)), 1, bytes); }
    internal static EmulatorInstallation Install(string vendor, string id = "installation", EmulatorConfig[]? configs = null)
    {
        var names = vendor switch { EmulatorVendors.LdPlayer => ("ldconsole.exe", "adb.exe"), EmulatorVendors.Nox => ("NoxConsole.exe", "nox_adb.exe"), _ => ("HD-Player.exe", "HD-Adb.exe") };
        var root = "C:\\Tools\\" + id; var sha = new string('a', 64);
        return new(id, vendor, root, "physical:" + id, new(id + ":control", root + "\\" + names.Item1, id + ":image", sha, 1),
            new(id + ":adb", root + "\\" + names.Item2, id + ":adb-image", sha, 1), configs ?? []);
    }
    internal static EmulatorTarget Target(string vendor)
    {
        var install = Install(vendor); var row = new EmulatorInstance(vendor == EmulatorVendors.LdPlayer ? "0" : vendor == EmulatorVendors.Nox ? "nox" : "Pie64",
            "same display", vendor == EmulatorVendors.Nox ? "NoxPlayer" : null, vendor == EmulatorVendors.LdPlayer ? 0 : null, 1234, [5555], []);
        return EmulatorSelection.Select([(install, new("enumerated", [row]))], EmulatorSelection.Identity(install, row), "127.0.0.1:5555", true);
    }
    internal static EmulatorProcess Process(EmulatorTarget target) => new("host-process", target.Installation.Id, 1234,
        target.Installation.Control.PhysicalId, target.Installation.Control.Sha256, new(2026, 10, 25, 0, 0, 0, TimeSpan.Zero),
        target.Installation.Vendor == EmulatorVendors.BlueStacks ? ["--instance", target.Instance.Identity] : []);
}
