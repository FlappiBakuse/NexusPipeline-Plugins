using System.Globalization;
using System.Text;

namespace NexusPipeline.Extensions.GameCheckIn;

internal static class CredentialIdentity
{
    internal static char[] Project(string field, ReadOnlySpan<char> stored)
    {
        _ = CheckInCatalog.Platform(field);
        var bytes = new byte[Encoding.UTF8.GetByteCount(stored)]; Encoding.UTF8.GetBytes(stored, bytes);
        try
        {
            using var material = CredentialMaterial.Decode(bytes);
            if (material.Web is not null && material.Web.Platform != field) throw new CheckInFailure("credential_web_context_invalid");
            char[]? result = null;
            material.Use(value => {
                if (field is "cn" or "os") result = Cookie(field, value);
                else if (field == "tajiduo") result = Tajiduo(value);
                else
                {
                    _ = LoginCapture.RawToken(value.ToString()); result = Canonical(field, "raw", value, []);
                }
            });
            return result!;
        }
        finally { Array.Clear(bytes); }
    }
    private static char[] Cookie(string field, ReadOnlySpan<char> cookie)
    {
        foreach (var character in cookie) if (character is < ' ' or > '~') throw new CheckInFailure("credential_identity_invalid");
        var fields = new Dictionary<string, (int Start, int Length)>(StringComparer.Ordinal);
        for (var start = 0; start <= cookie.Length;)
        {
            var separator = cookie[start..].IndexOf(';'); var end = separator < 0 ? cookie.Length : start + separator;
            var left = start; var right = end;
            while (left < right && cookie[left] == ' ') left++;
            while (right > left && cookie[right - 1] == ' ') right--;
            if (left < right)
            {
                var equals = cookie[left..right].IndexOf('=');
                if (equals <= 0) throw new CheckInFailure("credential_identity_invalid");
                var key = cookie.Slice(left, equals);
                foreach (var character in key)
                    if (!char.IsAsciiLetterOrDigit(character) && "!#$%&'*+-.^_`|~".IndexOf(character) < 0) throw new CheckInFailure("credential_identity_invalid");
                if (!fields.TryAdd(key.ToString(), (left + equals + 1, right - left - equals - 1))) throw new CheckInFailure("credential_identity_duplicate");
            }
            if (separator < 0) break; start = end + 1;
        }
        var token = field == "cn" ? "cookie_token" : "ltoken"; var account = field == "cn" ? "account_id" : "ltuid";
        fields.TryGetValue(account, out var legacyId); fields.TryGetValue(account + "_v2", out var modernId);
        foreach (var id in new[] { legacyId, modernId })
            if (id.Length > 0)
            {
                var text = cookie.Slice(id.Start, id.Length);
                if (text.Length > 32) throw new CheckInFailure("credential_identity_invalid");
                foreach (var character in text) if (!char.IsAsciiDigit(character)) throw new CheckInFailure("credential_identity_invalid");
            }
        if (legacyId.Length > 0 && modernId.Length > 0 && !cookie.Slice(legacyId.Start, legacyId.Length).SequenceEqual(cookie.Slice(modernId.Start, modernId.Length)))
            throw new CheckInFailure("credential_capture_ambiguous");
        fields.TryGetValue(token + "_v2", out var modernToken); fields.TryGetValue(token, out var legacyToken);
        var modern = modernToken.Length > 0 && modernId.Length > 0;
        var selectedToken = modern ? modernToken : legacyToken; var selectedId = modern ? modernId : legacyId;
        if (selectedToken.Length == 0 || selectedId.Length == 0) throw new CheckInFailure("credential_fields_missing");
        var authentication = cookie.Slice(selectedToken.Start, selectedToken.Length);
        if (!CredentialCharacters.Cookie(authentication)) throw new CheckInFailure("credential_identity_invalid");
        return Canonical(field, modern ? "v2" : "legacy", authentication, cookie.Slice(selectedId.Start, selectedId.Length));
    }
    private static char[] Tajiduo(ReadOnlySpan<char> value)
    {
        var bytes = new byte[Encoding.UTF8.GetByteCount(value)]; Encoding.UTF8.GetBytes(value, bytes);
        try
        {
            var credential = TajiduoCredential.Parse(bytes);
            if (credential.SdkToken is null || credential.SdkUid is null) throw new CheckInFailure("tajiduo_sdk_credential_required");
            return Canonical("tajiduo", "sdk", credential.SdkToken, credential.SdkUid);
        }
        finally { Array.Clear(bytes); }
    }
    private static char[] Canonical(string field, string kind, ReadOnlySpan<char> token, ReadOnlySpan<char> account)
    {
        var prefix = "nexus.game-checkin.identity/1\n" + field + "\n" + kind + "\n" + token.Length.ToString(CultureInfo.InvariantCulture) + ":";
        var middle = account.Length.ToString(CultureInfo.InvariantCulture) + ":";
        var result = new char[prefix.Length + token.Length + middle.Length + account.Length]; var offset = 0;
        prefix.AsSpan().CopyTo(result); offset += prefix.Length; token.CopyTo(result.AsSpan(offset)); offset += token.Length;
        middle.AsSpan().CopyTo(result.AsSpan(offset)); account.CopyTo(result.AsSpan(offset + middle.Length)); return result;
    }
}
