using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn;

/// <summary>森空岛/终末地 API 使用的数美 dId 提供器；结果只缓存于本次插件进程。</summary>
internal sealed class SklandDeviceFingerprintProvider
{
    private const string Organization = "UWXspnCCJN4sfYlNfqps";
    private const string ApplicationId = "default";
    private const string DeviceUrl = "https://fp-it.portal101.cn/deviceprofile/v4";
    private const string PublicKey = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCmxMNr7n8ZeT0tE1R9j/mPixoinPkeM+k4VGIn/s0k7N5rJAfnZ0eMER+QhwFvshzo0LNmeUkpR8uIlU/GEVr8mN28sKmwd2gpygqj0ePnBmOW4v0ZVwbSYK+izkhVFk2V/doLoMbWy6b+UnA8mkjvg0iYWRByfRsK2gdl7llqCwIDAQAB";
    private const string UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0";

    private static readonly IReadOnlyDictionary<string, (string Key, string Name)> DesRules =
        new Dictionary<string, (string, string)>(StringComparer.Ordinal)
        {
            ["appId"] = ("uy7mzc4h", "xx"),
            ["canvas"] = ("snrn887t", "yk"),
            ["clientSize"] = ("cpmjjgsu", "zx"),
            ["organization"] = ("78moqjfc", "dp"),
            ["os"] = ("je6vk6t4", "pj"),
            ["platform"] = ("pakxhcd2", "gm"),
            ["plugins"] = ("v51m3pzl", "kq"),
            ["pmf"] = ("2mdeslu3", "vw"),
            ["referer"] = ("y7bmrjlc", "ab"),
            ["res"] = ("whxqm2a7", "hf"),
            ["rtype"] = ("x8o2h2bl", "lo"),
            ["sdkver"] = ("9q3dcxp2", "sc"),
            ["status"] = ("2jbrxxw4", "an"),
            ["subVersion"] = ("eo3i2puh", "ns"),
            ["svm"] = ("fzj3kaeh", "qr"),
            ["time"] = ("q2t3odsk", "nb"),
            ["timezone"] = ("1uv05lj5", "as"),
            ["tn"] = ("x9nzj1bp", "py"),
            ["trees"] = ("acfs0xo4", "pi"),
            ["ua"] = ("k92crp1t", "bj"),
            ["url"] = ("y95hjkoo", "cf"),
            ["vpw"] = ("r9924ab5", "ca"),
        };

    private static readonly IReadOnlyDictionary<string, string> PlainObfuscatedNames =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["box"] = "jf",
        };

    private readonly IPluginHttpClientFactory _http;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private string? _cached;

    public SklandDeviceFingerprintProvider(IPluginHttpClientFactory http)
    {
        _http = http;
    }

    public async Task<string> GetDeviceIdAsync(CancellationToken cancellationToken)
    {
        if (_cached is not null)
        {
            return _cached;
        }
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_cached is not null)
            {
                return _cached;
            }
            _cached = await GenerateAsync(cancellationToken).ConfigureAwait(false);
            return _cached;
        }
        finally
        {
            _gate.Release();
        }
    }

    internal static string ComputeTn(IReadOnlyDictionary<string, object?> values)
    {
        var builder = new StringBuilder();
        foreach (string key in values.Keys.OrderBy(key => key, StringComparer.Ordinal))
        {
            object? value = values[key];
            if (value is int number)
            {
                builder.Append(number * 10000);
            }
            else if (value is long longNumber)
            {
                builder.Append(longNumber * 10000);
            }
            else
            {
                builder.Append(value switch
                {
                    null => "",
                    IReadOnlyDictionary<string, object?> nested => ComputeTn(nested),
                    _ => value.ToString(),
                });
            }
        }
        return Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(builder.ToString()))).ToLowerInvariant();
    }

    internal static string EncryptDesField(string value, string key)
    {
        byte[] sourceWithTail = Encoding.UTF8.GetBytes(value).Concat(new byte[8]).ToArray();
        int blockLength = sourceWithTail.Length / 8 * 8;
        byte[] source = sourceWithTail[..blockLength];
        using DES des = DES.Create();
        des.Key = Encoding.ASCII.GetBytes(key);
        des.Mode = CipherMode.ECB;
        des.Padding = PaddingMode.None;
        using ICryptoTransform encryptor = des.CreateEncryptor();
        return Convert.ToBase64String(encryptor.TransformFinalBlock(source, 0, source.Length));
    }

    private async Task<string> GenerateAsync(CancellationToken cancellationToken)
    {
        byte[] uid = Guid.NewGuid().ToByteArray();
        string privateId = Convert.ToHexString(MD5.HashData(uid))[..16].ToLowerInvariant();
        byte[] publicKeyBytes = Convert.FromBase64String(PublicKey);
        using RSA rsa = RSA.Create();
        rsa.ImportSubjectPublicKeyInfo(publicKeyBytes, out _);
        string encryptedEp = Convert.ToBase64String(rsa.Encrypt(uid, RSAEncryptionPadding.Pkcs1));

        long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var values = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["plugins"] = "MicrosoftEdgePDFPluginPortableDocumentFormatinternal-pdf-viewer1,MicrosoftEdgePDFViewermhjfbmdgcfjbbpaeojofohoefgiehjai1",
            ["ua"] = UserAgent,
            ["canvas"] = "259ffe69",
            ["timezone"] = -480,
            ["platform"] = "Win32",
            ["url"] = "https://www.skland.com/",
            ["referer"] = "",
            ["res"] = "1920_1080_24_1.25",
            ["clientSize"] = "0_0_1080_1920_1920_1080_1920_1080",
            ["status"] = "0011",
            ["vpw"] = Guid.NewGuid().ToString(),
            ["svm"] = now,
            ["trees"] = Guid.NewGuid().ToString(),
            ["pmf"] = now,
            ["protocol"] = 102,
            ["organization"] = Organization,
            ["appId"] = ApplicationId,
            ["os"] = "web",
            ["version"] = "3.0.0",
            ["sdkver"] = "3.0.0",
            ["box"] = "",
            ["rtype"] = "all",
            ["smid"] = CreateSmid(),
            ["subVersion"] = "1.0.0",
            ["time"] = 0,
        };
        values["tn"] = ComputeTn(values);
        string encryptedData = EncryptAesGzip(values, Encoding.ASCII.GetBytes(privateId));

        var payload = new
        {
            appId = ApplicationId,
            compress = 2,
            data = encryptedData,
            encode = 5,
            ep = encryptedEp,
            organization = Organization,
            os = "web",
        };
        using HttpClient client = _http.CreateClient(new Uri(DeviceUrl), TimeSpan.FromSeconds(15));
        using var request = new HttpRequestMessage(HttpMethod.Post, DeviceUrl)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
        };
        request.Headers.UserAgent.ParseAdd(UserAgent);
        using HttpResponseMessage response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();
        using JsonDocument document = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false),
            cancellationToken: cancellationToken).ConfigureAwait(false);
        if (!document.RootElement.TryGetProperty("code", out JsonElement code)
            || code.GetInt32() != 1100
            || !document.RootElement.TryGetProperty("detail", out JsonElement detail)
            || !detail.TryGetProperty("deviceId", out JsonElement deviceId)
            || string.IsNullOrWhiteSpace(deviceId.GetString()))
        {
            throw new InvalidOperationException("数美设备指纹接口返回异常");
        }
        return "B" + deviceId.GetString();
    }

    private static string EncryptAesGzip(IReadOnlyDictionary<string, object?> values, byte[] key)
    {
        Dictionary<string, object?> obfuscated = ObfuscateFields(values, encryptValues: true);
        byte[] json = JsonSerializer.SerializeToUtf8Bytes(obfuscated, new JsonSerializerOptions
        {
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        });
        using var compressed = new MemoryStream();
        using (var gzip = new GZipStream(compressed, CompressionLevel.Fastest, leaveOpen: true))
        {
            gzip.Write(json, 0, json.Length);
        }
        byte[] source = Encoding.ASCII.GetBytes(Convert.ToBase64String(compressed.ToArray())).Concat(new byte[1]).ToArray();
        int paddedLength = (source.Length + 15) / 16 * 16;
        Array.Resize(ref source, paddedLength);
        using Aes aes = Aes.Create();
        aes.Key = key;
        aes.IV = Encoding.ASCII.GetBytes("0102030405060708");
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.None;
        using ICryptoTransform encryptor = aes.CreateEncryptor();
        return Convert.ToHexString(encryptor.TransformFinalBlock(source, 0, source.Length)).ToLowerInvariant();
    }

    internal static Dictionary<string, object?> ObfuscateFields(
        IReadOnlyDictionary<string, object?> values,
        bool encryptValues)
    {
        var obfuscated = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach ((string name, object? value) in values)
        {
            if (DesRules.TryGetValue(name, out (string Key, string Name) rule))
            {
                string text = Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) ?? "";
                obfuscated[rule.Name] = encryptValues ? EncryptDesField(text, rule.Key) : text;
            }
            else if (PlainObfuscatedNames.TryGetValue(name, out string? obfuscatedName))
            {
                obfuscated[obfuscatedName] = value;
            }
            else
            {
                obfuscated[name] = value;
            }
        }
        return obfuscated;
    }

    private static string CreateSmid()
    {
        string timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");
        string value = timestamp + Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(Guid.NewGuid().ToString()))).ToLowerInvariant() + "00";
        string suffix = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes("smsk_web_" + value)))[..14].ToLowerInvariant();
        return value + suffix + "0";
    }
}
