using System.Text;
using NexusPipeline.Extensions.GameCheckIn;

internal static class CredentialRotationCases
{
    internal static void Run(Action<string, Action> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        bool Allowed(string field, CredentialMaterial before, CredentialMaterial after)
        {
            var a = before.Encode(); var b = after.Encode(); var x = Encoding.UTF8.GetChars(a); var y = Encoding.UTF8.GetChars(b);
            try { return CredentialRotation.CanRotate(field, x, y); }
            finally { Array.Clear(a); Array.Clear(b); Array.Clear(x); Array.Clear(y); }
        }
        run("tajiduo-rotation-allows-only-valid-access-refresh-changes-with-stable-sdk-pair", () => {
            using var before = new CredentialMaterial(ClientFixtures.Native, "browser", "same-mask");
            using var after = new CredentialMaterial(ClientFixtures.Native.Replace("synthetic-access", "new-access", StringComparison.Ordinal).Replace("synthetic-refresh", "new-refresh", StringComparison.Ordinal), "browser", "same-mask");
            Assert(Allowed("tajiduo", before, after) && Allowed("tajiduo", before, before));
        });
        foreach (var field in new[] { "uid", "deviceId", "roleId", "sdkToken", "sdkUid", "source", "mask" })
            run("tajiduo-rotation-denies-changed-invariant/" + field, () => {
                var value = ClientFixtures.Native[..^1] + ",\"roleId\":\"789123\"}";
                using var before = new CredentialMaterial(value, "browser", "same-mask");
                var changed = field switch { "uid" => value.Replace("123456", "123457", StringComparison.Ordinal), "deviceId" => value.Replace("synthetic-device", "new-device", StringComparison.Ordinal),
                    "roleId" => value.Replace("789123", "789124", StringComparison.Ordinal), "sdkToken" => value.Replace("synthetic-sdk-token", "new-sdk-token", StringComparison.Ordinal),
                    "sdkUid" => value.Replace("456789", "456788", StringComparison.Ordinal), _ => value };
                using var after = new CredentialMaterial(changed, field == "source" ? "manual" : "browser", field == "mask" ? "changed-mask" : "same-mask");
                Assert(!Allowed("tajiduo", before, after));
            });
        run("rotation-is-unavailable-for-other-platforms-or-malformed-format", () => {
            using var before = new CredentialMaterial("synthetic", "manual");
            foreach (var field in new[] { "cn", "os", "skland", "skport", "kuro" }) Assert(!Allowed(field, before, before));
            Assert(!CredentialRotation.CanRotate("tajiduo", "{\"formatVersion\":9}", "{}"));
        });
    }
}
