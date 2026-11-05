using System.Text.Json;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class CheckInRequest(Uri address, string method, Dictionary<string, string> headers,
    byte[] content, string? contentType) : IDisposable
{
    internal Uri Address { get; } = address;
    internal string Method { get; } = method;
    internal Dictionary<string, string> Headers { get; } = headers;
    internal byte[] Content { get; } = content;
    internal string? ContentType { get; } = contentType;
    public void Dispose() { Array.Clear(Content); Headers.Clear(); }
    public override string ToString() => "[check-in HTTP request]";
}
internal sealed record CheckInResponse(int StatusCode, string ContentType, ReadOnlyMemory<byte> Content)
{ public override string ToString() => "[check-in HTTP response]"; }
internal interface ICheckInNetwork
{
    ValueTask<CheckInResponse> SendAsync(CheckInRequest request, CancellationToken cancellationToken);
}
internal static class CheckInHttp
{
    internal static readonly string[] Origins = ["https://api-takumi.mihoyo.com", "https://bbs-api.miyoushe.com", "https://act-nap-api.mihoyo.com",
        "https://bbs-api-os.hoyolab.com", "https://sg-hk4e-api.hoyolab.com", "https://sg-public-api.hoyolab.com", "https://sg-act-nap-api.hoyolab.com",
        "https://as.hypergryph.com", "https://zonai.skland.com", "https://as.gryphline.com", "https://zonai.skport.com",
        "https://api.kurobbs.com", "https://bbs-api.tajiduo.com", "https://user.laohu.com", "https://fp-it.portal101.cn"];
    internal static async Task<JsonDocument> ReadAsync(ICheckInNetwork network, CheckInRequest request, CancellationToken cancellationToken)
    {
        using (request)
        {
            if (!Origins.Contains(request.Address.GetLeftPart(UriPartial.Authority), StringComparer.Ordinal) ||
                request.Address.Scheme != "https" || !request.Address.IsDefaultPort || request.Address.UserInfo.Length != 0 ||
                request.Address.Fragment.Length != 0 || request.Method is not ("GET" or "POST") || request.Content.Length > 65536 ||
                request.Headers.Any(pair => pair.Key.Any(char.IsControl) || pair.Value.Any(character => character is '\r' or '\n' or '\0')))
                throw new CheckInFailure("checkin_http_request_invalid");
            var result = await network.SendAsync(request, cancellationToken);
            if (result.StatusCode is < 200 or > 299) throw new CheckInFailure(result.StatusCode is 401 or 403 ? "credential_not_authenticated" : "checkin_http_error");
            var mime = result.ContentType.Split(';')[0].Trim();
            if (!mime.Equals("application/json", StringComparison.OrdinalIgnoreCase) && !(mime.StartsWith("application/", StringComparison.OrdinalIgnoreCase) && mime.EndsWith("+json", StringComparison.OrdinalIgnoreCase)))
                throw new CheckInFailure("checkin_response_content_type");
            return CheckInJson.Parse(result.Content);
        }
    }
}
