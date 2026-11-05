using System.Text.Json;
using System.Text.Json.Serialization;

namespace NexusPipeline.Extensions.GameCheckIn;

internal static class CheckInFrontendInputs
{
    internal sealed record Editor([property: JsonRequired] string EditorSessionId);
    internal sealed record Open([property: JsonRequired] Guid? TaskId, [property: JsonRequired] long ExpectedRevision);
    internal sealed record Save([property: JsonRequired] CheckInTaskDraft Draft, [property: JsonRequired] string EditorSessionId,
        [property: JsonRequired] JsonElement Secrets);
    internal sealed record Delete([property: JsonRequired] Guid TaskId, [property: JsonRequired] long ExpectedRevision);
    internal sealed record Reorder([property: JsonRequired] Guid[] TaskIds, [property: JsonRequired] long ExpectedRevision);
    internal sealed record Run([property: JsonRequired] Guid TaskId);
    internal sealed record Publication([property: JsonRequired] Guid PublicationOperationId);
    internal sealed record Field([property: JsonRequired] string PlatformId, [property: JsonRequired] string EditorSessionId);
    internal sealed record Browser([property: JsonRequired] string PlatformId, [property: JsonRequired] string EditorSessionId,
        [property: JsonRequired] long FieldGeneration);
    internal sealed record PrepareTajiduo([property: JsonRequired] string EditorSessionId, [property: JsonRequired] long FieldGeneration);
    internal sealed record Sms([property: JsonRequired] Guid LoginOperationId, [property: JsonRequired] string Phone);
    internal sealed record CancelTajiduo([property: JsonRequired] Guid LoginOperationId, [property: JsonRequired] string EditorSessionId);
    [JsonConverter(typeof(SensitiveCaptureConverter<LoginTajiduo>))]
    internal sealed record LoginTajiduo(Guid LoginOperationId, string EditorSessionId, string Mode, string Phone, string Value)
    { public override string ToString() => "[native login input]"; }
    internal static Dictionary<string, CredentialAction> Actions(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Object || value.EnumerateObject().Count() > 6) throw new CheckInFailure("credential_action_invalid");
        var actions = new Dictionary<string, CredentialAction>(StringComparer.Ordinal);
        foreach (var property in value.EnumerateObject())
        {
            _ = CheckInCatalog.Platform(property.Name); var action = property.Value;
            if (action.ValueKind != JsonValueKind.Object || action.EnumerateObject().Any(field => field.Name is not ("action" or "fieldGeneration" or "value" or "candidateId")))
                throw new CheckInFailure("credential_action_invalid");
            var intent = CheckInJson.Property(action, "action", JsonValueKind.String).GetString()!;
            if (!CheckInJson.Property(action, "fieldGeneration", JsonValueKind.Number).TryGetInt64(out var generation) || generation is < 0 or > 9007199254740991)
                throw new CheckInFailure("credential_field_stale");
            string? Optional(string name) => !action.TryGetProperty(name, out var field) ? null : field.ValueKind == JsonValueKind.String
                ? field.GetString() : throw new CheckInFailure("credential_action_invalid");
            actions.Add(property.Name, new(intent, generation, Optional("value"), Optional("candidateId")));
        }
        return actions;
    }
    internal static LoginTajiduo NativeLogin(ReadOnlyMemory<byte> bytes)
    {
        using var json = CheckInJson.Parse(bytes, 32768); var root = json.RootElement;
        if (root.ValueKind != JsonValueKind.Object || root.EnumerateObject().Any(property => property.Name is not ("loginOperationId" or "editorSessionId" or "mode" or "phone" or "value")))
            throw new CheckInFailure("tajiduo_login_input_invalid");
        string Text(string name) => CheckInJson.Property(root, name, JsonValueKind.String).GetString()!;
        if (!Guid.TryParse(Text("loginOperationId"), out var id) || id == Guid.Empty) throw new CheckInFailure("tajiduo_login_expired");
        return new(id, Text("editorSessionId"), Text("mode"), Text("phone"), Text("value"));
    }
}
