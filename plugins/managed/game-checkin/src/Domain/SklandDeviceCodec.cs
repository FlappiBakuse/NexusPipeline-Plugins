using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace NexusPipeline.Extensions.GameCheckIn;

internal static class SklandDeviceCodec
{
    internal const string Organization = "UWXspnCCJN4sfYlNfqps";
    internal const string PublicKey = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCmxMNr7n8ZeT0tE1R9j/mPixoinPkeM+k4VGIn/s0k7N5rJAfnZ0eMER+QhwFvshzo0LNmeUkpR8uIlU/GEVr8mN28sKmwd2gpygqj0ePnBmOW4v0ZVwbSYK+izkhVFk2V/doLoMbWy6b+UnA8mkjvg0iYWRByfRsK2gdl7llqCwIDAQAB";
    internal const string UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0";
    private static readonly (string Field, string Key, string Alias)[] Fields = [
        ("appId", "uy7mzc4h", "xx"), ("canvas", "snrn887t", "yk"), ("clientSize", "cpmjjgsu", "zx"),
        ("organization", "78moqjfc", "dp"), ("os", "je6vk6t4", "pj"), ("platform", "pakxhcd2", "gm"),
        ("plugins", "v51m3pzl", "kq"), ("pmf", "2mdeslu3", "vw"), ("referer", "y7bmrjlc", "ab"),
        ("res", "whxqm2a7", "hf"), ("rtype", "x8o2h2bl", "lo"), ("sdkver", "9q3dcxp2", "sc"),
        ("status", "2jbrxxw4", "an"), ("subVersion", "eo3i2puh", "ns"), ("svm", "fzj3kaeh", "qr"),
        ("time", "q2t3odsk", "nb"), ("timezone", "1uv05lj5", "as"), ("tn", "x9nzj1bp", "py"),
        ("trees", "acfs0xo4", "pi"), ("ua", "k92crp1t", "bj"), ("url", "y95hjkoo", "cf"), ("vpw", "r9924ab5", "ca") ];
    internal static Dictionary<string, object?> Profile(DateTimeOffset now, Guid view, Guid tree, Guid identity)
    {
        var prefix = now.ToOffset(TimeSpan.FromHours(8)).ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture) + Digest(identity.ToByteArray()) + "00";
        var values = new Dictionary<string, object?>(StringComparer.Ordinal) {
            ["appId"] = "default", ["organization"] = Organization, ["os"] = "web", ["protocol"] = 102,
            ["version"] = "3.0.0", ["sdkver"] = "3.0.0", ["subVersion"] = "1.0.0", ["rtype"] = "all", ["box"] = "",
            ["smid"] = prefix + Digest(Encoding.UTF8.GetBytes("smsk_web_" + prefix))[..14] + "0", ["time"] = 0,
            ["ua"] = UserAgent, ["platform"] = "Win32", ["url"] = "https://www.skland.com/", ["referer"] = "",
            ["plugins"] = "MicrosoftEdgePDFPluginPortableDocumentFormatinternal-pdf-viewer1,MicrosoftEdgePDFViewermhjfbmdgcfjbbpaeojofohoefgiehjai1",
            ["canvas"] = "259ffe69", ["timezone"] = -480, ["res"] = "1920_1080_24_1.25", ["clientSize"] = "0_0_1080_1920_1920_1080_1920_1080",
            ["status"] = "0011", ["vpw"] = view.ToString("D"), ["trees"] = tree.ToString("D"), ["svm"] = now.ToUnixTimeMilliseconds(), ["pmf"] = now.ToUnixTimeMilliseconds() };
        values["tn"] = Tn(values); return values;
    }
    internal static string Tn(IReadOnlyDictionary<string, object?> values)
    {
        var text = new StringBuilder();
        foreach (var pair in values.OrderBy(pair => pair.Key, StringComparer.Ordinal))
            text.Append(pair.Value switch {
                int number => checked((long)number * 10000).ToString(CultureInfo.InvariantCulture),
                long number => checked(number * 10000).ToString(CultureInfo.InvariantCulture),
                IReadOnlyDictionary<string, object?> nested => Tn(nested), null => "", string value => value,
                _ => throw new CheckInFailure("checkin_device_profile_invalid") });
        return Digest(Encoding.UTF8.GetBytes(text.ToString()));
    }
    internal static byte[] Request(IReadOnlyDictionary<string, object?> values, ReadOnlySpan<byte> identity, RSA publicKey)
    {
        if (identity.Length != 16) throw new CheckInFailure("checkin_device_profile_invalid");
        var mapped = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var pair in values)
        {
            var rule = Fields.SingleOrDefault(rule => rule.Field == pair.Key);
            var value = pair.Value switch { null => "", string item => item, int item => item.ToString(CultureInfo.InvariantCulture),
                long item => item.ToString(CultureInfo.InvariantCulture), _ => throw new CheckInFailure("checkin_device_profile_invalid") };
            if (rule.Field is null) mapped.Add(pair.Key == "box" ? "jf" : pair.Key, pair.Value);
            else
            {
                using var des = DES.Create(); des.Key = Encoding.ASCII.GetBytes(rule.Key);
                mapped.Add(rule.Alias, Convert.ToBase64String(des.EncryptEcb(Pad(Encoding.UTF8.GetBytes(value), 8), PaddingMode.None)));
            }
        }
        var json = JsonSerializer.SerializeToUtf8Bytes(mapped, new JsonSerializerOptions { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
        using var compressed = new MemoryStream();
        using (var gzip = new GZipStream(compressed, CompressionLevel.Optimal, leaveOpen: true)) gzip.Write(json);
        var input = Pad(Encoding.ASCII.GetBytes(Convert.ToBase64String(compressed.ToArray())), 16);
        using var aes = Aes.Create(); aes.Key = Encoding.ASCII.GetBytes(Digest(identity)[..16]);
        var encrypted = aes.EncryptCbc(input, Encoding.ASCII.GetBytes("0102030405060708"), PaddingMode.None);
        return JsonSerializer.SerializeToUtf8Bytes(new { appId = "default", compress = 2, data = Convert.ToHexStringLower(encrypted), encode = 5,
            ep = Convert.ToBase64String(publicKey.Encrypt(identity, RSAEncryptionPadding.Pkcs1)), organization = Organization, os = "web" });
    }
    private static byte[] Pad(byte[] input, int block)
    { var padded = new byte[checked((input.Length / block + 1) * block)]; input.CopyTo(padded, 0); return padded; }
    internal static string Digest(ReadOnlySpan<byte> value) => Convert.ToHexStringLower(MD5.HashData(value));
}
