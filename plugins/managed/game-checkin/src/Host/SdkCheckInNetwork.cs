using NexusPipeline.Extensibility.Networking;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class SdkCheckInNetwork(IExtensionHttp http) : ICheckInNetwork
{
    public async ValueTask<CheckInResponse> SendAsync(CheckInRequest request, CancellationToken cancellationToken)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(30));
        var response = await http.SendAsync(new(request.Address, request.Method, request.Headers,
            request.Content, request.ContentType, 262144), deadline.Token);
        var mime = response.Headers.FirstOrDefault(pair => pair.Key.Equals("Content-Type", StringComparison.OrdinalIgnoreCase)).Value?.FirstOrDefault() ?? "";
        return new(response.StatusCode, mime, response.Content);
    }
}
