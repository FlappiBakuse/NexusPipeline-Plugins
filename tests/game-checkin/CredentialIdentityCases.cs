using System.Text;
using NexusPipeline.Extensions.GameCheckIn;

internal static class CredentialIdentityCases
{
    internal static char[] Project(string field, CredentialMaterial material)
    {
        var bytes = material.Encode(); var characters = Encoding.UTF8.GetChars(bytes);
        try { return CredentialIdentity.Project(field, characters); }
        finally { Array.Clear(bytes); Array.Clear(characters); }
    }
    internal static void Run(Action<string, Action> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        static void Reject(Action action) { try { action(); } catch (CheckInFailure) { return; } throw new InvalidOperationException("rejection_expected"); }
        foreach (var field in new[] { "cn", "os" })
            run("credential-family-cookie-order-metadata-and-unused-keys-do-not-change-identity/" + field, () => {
                var token = field == "cn" ? "cookie_token" : "ltoken"; var uid = field == "cn" ? "account_id" : "ltuid";
                using var first = new CredentialMaterial(token + "_v2=synthetic%2BToken; " + uid + "_v2=123456; unused=one", "manual", "display-one");
                using var second = new CredentialMaterial("unused=two;  " + uid + "_v2=123456 ; " + token + "_v2=synthetic%2BToken;", "browser", "display-two");
                var a = Project(field, first); var b = Project(field, second);
                try { Assert(a.AsSpan().SequenceEqual(b)); } finally { Array.Clear(a); Array.Clear(b); }
            });
        run("credential-family-prefers-complete-v2-and-preserves-token-case-and-url-encoding", () => {
            using var first = new CredentialMaterial("cookie_token=old; account_id=123456; cookie_token_v2=Token%2B; account_id_v2=123456", "manual");
            using var otherLegacy = new CredentialMaterial("cookie_token=changed-old; account_id=123456; cookie_token_v2=Token%2B; account_id_v2=123456", "manual");
            using var lower = new CredentialMaterial("cookie_token_v2=token%2B; account_id_v2=123456", "manual");
            using var decoded = new CredentialMaterial("cookie_token_v2=Token+; account_id_v2=123456", "manual");
            var identities = new[] { Project("cn", first), Project("cn", otherLegacy), Project("cn", lower), Project("cn", decoded) };
            try { Assert(identities[0].AsSpan().SequenceEqual(identities[1]) && !identities[0].AsSpan().SequenceEqual(identities[2]) && !identities[0].AsSpan().SequenceEqual(identities[3])); }
            finally { foreach (var value in identities) Array.Clear(value); }
        });
        run("credential-family-cookie-duplicate-ambiguous-or-incomplete-material-is-rejected", () => {
            foreach (var cookie in new[] { "cookie_token_v2=one; cookie_token_v2=one; account_id_v2=123456", "cookie_token_v2=one; account_id_v2=123456; x=one; x=two",
                "cookie_token_v2=one; account_id_v2=123456; account_id=654321", "cookie_token_v2=one", "cookie_token=one; account_id=not-numeric" })
            { using var material = new CredentialMaterial(cookie, "manual"); Reject(() => Project("cn", material)); }
        });
        foreach (var field in new[] { "skland", "skport", "kuro" })
            run("credential-family-raw-token-excludes-source-mask-and-web-context/" + field, () => {
                using var first = new CredentialMaterial("synthetic-Token", "manual", "first");
                using var second = new CredentialMaterial("synthetic-Token", "browser", "other", field == "skland" ? new("skland", "Bsynthetic-dId") : field == "kuro" ? new("kuro", DistinctId: "synthetic-distinct") : null);
                using var changed = new CredentialMaterial("synthetic-token", "manual");
                var a = Project(field, first); var b = Project(field, second); var c = Project(field, changed);
                try { Assert(a.AsSpan().SequenceEqual(b) && !a.AsSpan().SequenceEqual(c)); } finally { Array.Clear(a); Array.Clear(b); Array.Clear(c); }
            });
        run("credential-family-tajiduo-is-sdk-pair-stable-across-access-refresh-role-and-device-metadata", () => {
            using var first = new CredentialMaterial(ClientFixtures.Native, "manual");
            using var rotated = new CredentialMaterial(ClientFixtures.Native.Replace("synthetic-access", "new-access", StringComparison.Ordinal).Replace("synthetic-refresh", "new-refresh", StringComparison.Ordinal).Replace("synthetic-device", "new-device", StringComparison.Ordinal), "browser", "other-mask");
            using var changed = new CredentialMaterial(ClientFixtures.Native.Replace("synthetic-sdk-token", "new-sdk-token", StringComparison.Ordinal), "manual");
            var a = Project("tajiduo", first); var b = Project("tajiduo", rotated); var c = Project("tajiduo", changed);
            try { Assert(a.AsSpan().SequenceEqual(b) && !a.AsSpan().SequenceEqual(c)); } finally { Array.Clear(a); Array.Clear(b); Array.Clear(c); }
        });
        run("credential-family-legacy-native-and-unknown-outer-format-are-unavailable", () => {
            using var old = new CredentialMaterial("{\"accessToken\":\"a\",\"refreshToken\":\"b\",\"uid\":\"12345\",\"deviceId\":\"d\"}", "manual");
            Reject(() => Project("tajiduo", old)); Reject(() => CredentialIdentity.Project("kuro", "{\"formatVersion\":9,\"value\":\"synthetic\"}"));
        });
        run("tajiduo-distinct-explicit-role-selection-shares-credential-family", () => {
            using var first = new CredentialMaterial(ClientFixtures.Native[..^1] + ",\"roleId\":\"111\"}", "manual");
            using var second = new CredentialMaterial(ClientFixtures.Native[..^1] + ",\"roleId\":\"222\"}", "manual");
            var a = Project("tajiduo", first); var b = Project("tajiduo", second);
            try { Assert(a.AsSpan().SequenceEqual(b)); } finally { Array.Clear(a); Array.Clear(b); }
        });
    }
}
