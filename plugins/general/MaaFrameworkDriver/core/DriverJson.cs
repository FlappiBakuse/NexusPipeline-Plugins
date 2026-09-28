using System.Text.Json;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public static class DriverJson
{
    public static readonly JsonSerializerOptions Options = new()
    { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true, MaxDepth = 32 };
}
