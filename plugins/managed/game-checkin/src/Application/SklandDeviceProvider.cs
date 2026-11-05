using System.Security.Cryptography;
using System.Text.Json;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class SklandDeviceProvider(ICheckInNetwork network, TimeProvider clock) : ICheckInPassportDevice, IAsyncDisposable
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private string? cached;
    private bool disposed;
    public async ValueTask<string> GetAsync(CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            if (cached is not null) return cached;
            using var rsa = RSA.Create(); rsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(SklandDeviceCodec.PublicKey), out _);
            var profile = SklandDeviceCodec.Profile(clock.GetUtcNow(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
            var body = SklandDeviceCodec.Request(profile, Guid.NewGuid().ToByteArray(), rsa);
            var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) { ["User-Agent"] = SklandDeviceCodec.UserAgent,
                ["Origin"] = "https://www.skland.com", ["Referer"] = "https://www.skland.com/" };
            using var response = await CheckInHttp.ReadAsync(network, new(new("https://fp-it.portal101.cn/deviceprofile/v4"), "POST", headers, body, "application/json"), cancellationToken);
            var code = CheckInJson.Property(response.RootElement, "code", JsonValueKind.Number);
            if (!code.TryGetInt32(out var value) || value != 1100) throw new CheckInFailure("checkin_device_unavailable");
            var device = CheckInJson.Property(CheckInJson.Property(response.RootElement, "detail", JsonValueKind.Object), "deviceId", JsonValueKind.String).GetString();
            if (!CredentialWebSession.Header(device, 16383)) throw new CheckInFailure("checkin_device_unavailable");
            cancellationToken.ThrowIfCancellationRequested(); cached = "B" + device; return cached;
        }
        finally { gate.Release(); }
    }
    public async ValueTask DisposeAsync()
    {
        await gate.WaitAsync();
        try { disposed = true; cached = null; }
        finally { gate.Release(); }
    }
}
