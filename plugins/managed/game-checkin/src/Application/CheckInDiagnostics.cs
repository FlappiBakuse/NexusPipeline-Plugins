using System.Text.Json;
using System.Text.Json.Serialization;

namespace NexusPipeline.Extensions.GameCheckIn;

internal static class CheckInDiagnostics
{
    private static readonly JsonSerializerOptions Options = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    internal static string Failure(Exception error, string phase, Guid? operationId = null, Exception? secondary = null)
    {
        var reason = error switch {
            CheckInFailure failure => failure.Code,
            HttpRequestException or System.Net.Sockets.SocketException or TaskCanceledException => "transport_error",
            JsonException => "response_invalid",
            _ => "internal_error"
        };
        try
        {
            Console.Error.WriteLine(JsonSerializer.Serialize(new { kind = "checkin.failure", phase, reason, operationId,
                exceptionType = error.GetType().Name, secondaryType = secondary?.GetType().Name }, Options));
        }
        catch (Exception outputFailure) when (outputFailure is IOException or ObjectDisposedException) { }
        return reason;
    }
}
