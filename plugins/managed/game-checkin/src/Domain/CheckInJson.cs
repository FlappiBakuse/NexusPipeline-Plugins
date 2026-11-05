using System.Text.Json;
using System.Text.Json.Serialization;

namespace NexusPipeline.Extensions.GameCheckIn;

internal static class CheckInJson
{
    internal static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
        { MaxDepth = 32, UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow, PropertyNameCaseInsensitive = false };
    internal static byte[] Bytes<T>(T value) => JsonSerializer.SerializeToUtf8Bytes(value, Options);
    internal static JsonDocument Parse(ReadOnlyMemory<byte> bytes, int limit = 262144)
    {
        if (bytes.Length is < 1 || bytes.Length > limit) throw new CheckInFailure("checkin_json_size_invalid");
        JsonDocument document;
        try { document = JsonDocument.Parse(bytes, new() { MaxDepth = 32 }); }
        catch (JsonException) { throw new CheckInFailure("checkin_json_syntax_invalid"); }
        try { Unique(document.RootElement); return document; }
        catch { document.Dispose(); throw; }
    }
    internal static T Read<T>(ReadOnlyMemory<byte> bytes)
    {
        using var document = Parse(bytes, 1048576);
        return document.RootElement.Deserialize<T>(Options) ?? throw new CheckInFailure("checkin_json_invalid");
    }
    internal static JsonElement Property(JsonElement parent, string name, JsonValueKind kind)
    {
        if (parent.ValueKind != JsonValueKind.Object || !parent.TryGetProperty(name, out var value) || value.ValueKind != kind)
            throw new CheckInFailure("checkin_response_shape_unknown");
        return value;
    }
    internal static string Id(JsonElement parent, string key, int limit = 128)
    {
        if (parent.ValueKind != JsonValueKind.Object || !parent.TryGetProperty(key, out var value)) throw new CheckInFailure("checkin_role_identity_missing");
        var id = value.ValueKind == JsonValueKind.String ? value.GetString() : value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var integer)
            ? integer.ToString(System.Globalization.CultureInfo.InvariantCulture) : null;
        if (string.IsNullOrEmpty(id) || id.Length > limit || id.Any(character => !char.IsAsciiLetterOrDigit(character) && character is not ('_' or '-')))
            throw new CheckInFailure("checkin_role_identity_invalid");
        return id;
    }
    private static void Unique(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Object)
        {
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in value.EnumerateObject())
            { if (!names.Add(property.Name)) throw new CheckInFailure("checkin_json_duplicate"); Unique(property.Value); }
        }
        else if (value.ValueKind == JsonValueKind.Array) foreach (var item in value.EnumerateArray()) Unique(item);
    }
}
