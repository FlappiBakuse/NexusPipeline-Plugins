using System.Text.Json;

namespace NexusPipeline.Extensions.GameCheckIn;

internal static class ReadOnlyIdentity
{
    internal static CredentialMaterial Verify(string platform, JsonElement response, CredentialMaterial captured)
    {
        CheckInCatalog.Platform(platform);
        if (captured.Web is not null && captured.Web.Platform != platform) throw new CheckInFailure("credential_web_context_invalid");
        var codeName = platform is "cn" or "os" ? "retcode" : "code";
        var success = platform == "kuro" ? 200 : 0;
        var code = CheckInJson.Property(response, codeName, JsonValueKind.Number);
        if (!code.TryGetInt32(out var number) || number != success) throw new CheckInFailure("credential_not_authenticated");
        if (platform is "cn" or "os" && HoyoResponses.Error(response) is not null) throw new CheckInFailure("credential_rejected");
        var data = CheckInJson.Property(response, "data", JsonValueKind.Object);
        var account = platform switch {
            "cn" or "os" => CheckInJson.Property(data, "user_info", JsonValueKind.Object),
            "skland" => CheckInJson.Property(data, "user", JsonValueKind.Object),
            "skport" => CheckInJson.Property(CheckInJson.Property(data, "user", JsonValueKind.Object), "basicUser", JsonValueKind.Object),
            "kuro" => CheckInJson.Property(data, "mine", JsonValueKind.Object),
            _ => throw new CheckInFailure("credential_native_login_proof_required") };
        var id = CheckInJson.Id(account, platform is "cn" or "os" ? "uid" : platform == "kuro" ? "userId" : "id");
        if (platform is "cn" or "os")
        {
            if (id.Length > 32 || !id.All(char.IsAsciiDigit)) throw new CheckInFailure("credential_identity_invalid");
            captured.Use(value => {
                var prefix = platform == "cn" ? "account_id" : "ltuid";
                var ids = value.ToString().Split(';').Select(item => item.Trim().Split('=', 2))
                    .Where(parts => parts.Length == 2 && (parts[0] == prefix || parts[0] == prefix + "_v2")).Select(parts => parts[1]).Distinct(StringComparer.Ordinal).ToArray();
                if (ids.Length != 1 || ids[0] != id) throw new CheckInFailure("credential_capture_ambiguous");
            });
        }
        else if (platform == "kuro" && !id.All(char.IsAsciiDigit)) throw new CheckInFailure("credential_identity_invalid");
        if (id.Length < 4) throw new CheckInFailure("credential_identity_invalid");
        var visible = id.Length >= 6 ? 2 : 1;
        var masked = platform + " · " + id[..visible] + new string('*', Math.Min(12, id.Length - visible * 2)) + id[^visible..];
        CredentialMaterial? verified = null;
        captured.Use(value => verified = new(value, "browser", masked, captured.Web));
        return verified!;
    }
}
