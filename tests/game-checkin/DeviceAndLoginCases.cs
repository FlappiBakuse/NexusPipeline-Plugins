using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using NexusPipeline.Extensions.GameCheckIn;

internal static class DeviceAndLoginCases
{
    internal static void Run(Action<string, Action> run)
    {
        void Assert(bool condition) { if (!condition) throw new InvalidOperationException("assertion_failed"); }
        void Reject(Action action)
        { try { action(); } catch (CheckInFailure) { return; } throw new InvalidOperationException("expected_rejection"); }
        run("official-shumei-rsa-aes-gzip-des-payload-roundtrip", () =>
        {
            var now = DateTimeOffset.FromUnixTimeMilliseconds(1720000000000); var identity = Guid.NewGuid().ToByteArray();
            using var rsa = RSA.Create(1024); var values = SklandDeviceCodec.Profile(now, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
            var withoutTn = values.Where(pair => pair.Key != "tn").ToDictionary();
            Assert((string)values["tn"]! == SklandDeviceCodec.Tn(withoutTn));
            using var body = JsonDocument.Parse(SklandDeviceCodec.Request(values, identity, rsa)); var root = body.RootElement;
            Assert(root.GetProperty("compress").GetInt32() == 2 && root.GetProperty("encode").GetInt32() == 5 && root.GetProperty("organization").GetString() == SklandDeviceCodec.Organization);
            Assert(rsa.Decrypt(Convert.FromBase64String(root.GetProperty("ep").GetString()!), RSAEncryptionPadding.Pkcs1).SequenceEqual(identity));
            using var aes = Aes.Create(); aes.Key = Encoding.ASCII.GetBytes(SklandDeviceCodec.Digest(identity)[..16]);
            var base64 = Encoding.ASCII.GetString(aes.DecryptCbc(Convert.FromHexString(root.GetProperty("data").GetString()!), Encoding.ASCII.GetBytes("0102030405060708"), PaddingMode.None)).TrimEnd('\0');
            using var input = new MemoryStream(Convert.FromBase64String(base64)); using var gzip = new GZipStream(input, CompressionMode.Decompress);
            using var decoded = JsonDocument.Parse(gzip); var mapped = decoded.RootElement;
            Assert(mapped.GetProperty("protocol").GetInt32() == 102 && mapped.GetProperty("version").GetString() == "3.0.0" && mapped.GetProperty("jf").GetString() == "");
            using var des = DES.Create(); des.Key = Encoding.ASCII.GetBytes("uy7mzc4h");
            Assert(Encoding.UTF8.GetString(des.DecryptEcb(Convert.FromBase64String(mapped.GetProperty("xx").GetString()!), PaddingMode.None)).TrimEnd('\0') == "default");
            Assert(!mapped.TryGetProperty("appId", out _) && !mapped.TryGetProperty("ua", out _));
        });
        run("tn-order-culture-numbers-and-nested-values", () =>
        {
            var a = new Dictionary<string, object?> { ["b"] = "x", ["a"] = 3, ["c"] = null };
            var b = new Dictionary<string, object?> { ["c"] = null, ["a"] = 3L, ["b"] = "x" };
            Assert(SklandDeviceCodec.Tn(a) == SklandDeviceCodec.Digest("30000x"u8) && SklandDeviceCodec.Tn(a) == SklandDeviceCodec.Tn(b));
            Assert(SklandDeviceCodec.Tn(new Dictionary<string, object?> { ["nested"] = a }) == SklandDeviceCodec.Digest(Encoding.ASCII.GetBytes(SklandDeviceCodec.Tn(a))));
        });
        run("device-provider-caches-only-success-for-activation", () =>
        {
            var network = new ClientNetwork(new TestEffects(), "{\"code\":1100,\"detail\":{\"deviceId\":\"synthetic-only\"}}") { RequireGameGate = false };
            var provider = new SklandDeviceProvider(network, TimeProvider.System);
            Assert(provider.GetAsync(default).Result == "Bsynthetic-only" && provider.GetAsync(default).Result == "Bsynthetic-only");
            Assert(network.Requests.Count == 1 && network.Requests.Single().Address == "https://fp-it.portal101.cn/deviceprofile/v4");
            provider.DisposeAsync().GetAwaiter().GetResult();
        });
        foreach (var body in new[] { "{\"code\":0,\"detail\":{\"deviceId\":\"synthetic\"}}", "{\"code\":1100,\"detail\":{\"deviceId\":\"injected\\r\\nheader\"}}", "{\"code\":1100,\"detail\":{}}" })
            run("device-provider-rejects-malformed-response/" + body.Length, () =>
            {
                var network = new ClientNetwork(new TestEffects(), body) { RequireGameGate = false };
                var provider = new SklandDeviceProvider(network, TimeProvider.System);
                Reject(() => provider.GetAsync(default).AsTask().GetAwaiter().GetResult()); Assert(network.Requests.Count == 1);
                provider.DisposeAsync().GetAwaiter().GetResult();
            });
        run("native-login-input-rejects-send-as-login-before-any-request", () =>
        {
            var network = new ClientNetwork(new TestEffects()) { RequireGameGate = false };
            using var secret = new CredentialMaterial("synthetic-password", "manual");
            Reject(() => new TajiduoAuthentication(network, TimeProvider.System).LoginAsync("send", "13800000000", secret, "synthetic-device", default).GetAwaiter().GetResult());
            Assert(network.Requests.Count == 0);
        });
        foreach (var mode in new[] { "sms", "password" })
            run("native-login-synthetic-sdk-contract/" + mode, () =>
            {
                var replies = new List<string>(); if (mode == "sms") replies.Add("{\"code\":0}");
                replies.Add("{\"code\":0,\"result\":{\"token\":\"synthetic-sdk-token\",\"userId\":\"123456\"}}");
                replies.Add("{\"code\":0,\"data\":{\"accessToken\":\"synthetic-access\",\"refreshToken\":\"synthetic-refresh\",\"uid\":\"123456\"}}");
                var network = new ClientNetwork(new TestEffects(), replies.ToArray()) { RequireGameGate = false };
                using var secret = new CredentialMaterial(mode == "sms" ? "123456" : "synthetic-password", "manual");
                using var material = new TajiduoAuthentication(network, TimeProvider.System).LoginAsync(mode, "13800000000", secret, "synthetic-device", default).GetAwaiter().GetResult();
                Assert(material.Source == "browser" && material.MaskedAccount == "tajiduo · 12**56" && network.Requests.Count == (mode == "sms" ? 3 : 2));
                Assert(!network.Requests[mode == "sms" ? 1 : 0].Body.Contains("synthetic-password", StringComparison.Ordinal));
                Assert(network.Requests.All(request => request.Method == "POST") && network.Posts == 0);
            });
        run("native-sdk-rejection-never-exchanges-community-token", () =>
        {
            var network = new ClientNetwork(new TestEffects(), "{\"code\":1001}") { RequireGameGate = false };
            using var secret = new CredentialMaterial("synthetic-password", "manual");
            Reject(() => new TajiduoAuthentication(network, TimeProvider.System).LoginAsync("password", "13800000000", secret, "synthetic-device", default).GetAwaiter().GetResult());
            Assert(network.Requests.Count == 1);
        });
    }
}
