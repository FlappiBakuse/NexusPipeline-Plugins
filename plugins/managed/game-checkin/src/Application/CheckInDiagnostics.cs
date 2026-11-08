using System.Text.Json;

namespace NexusPipeline.Extensions.GameCheckIn;

internal static class CheckInDiagnostics
{
    internal static string Failure(Exception error, string phase)
    {
        var reason = error switch {
            CheckInFailure failure => failure.Code,
            HttpRequestException or System.Net.Sockets.SocketException or TaskCanceledException => "transport_error",
            JsonException => "response_invalid",
            _ => "internal_error"
        };
        Console.Error.WriteLine(JsonSerializer.Serialize(new { kind = "checkin.failure", phase, reason,
            exceptionType = error.GetType().Name }));
        return reason;
    }
}
