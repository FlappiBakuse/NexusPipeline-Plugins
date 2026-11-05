using System.Text.Json;

namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record CheckInRole(string RoleId, string ServerId, string UserId);
internal static class CheckInRoles
{
    internal static CheckInRole[] Hoyo(JsonElement root)
    {
        var list = CheckInJson.Property(CheckInJson.Property(root, "data", JsonValueKind.Object), "list", JsonValueKind.Array);
        if (list.GetArrayLength() > 256) throw new CheckInFailure("checkin_roles_too_many");
        var roles = Distinct(list.EnumerateArray().Select(item => new CheckInRole(CheckInJson.Id(item, "game_uid", 32),
            CheckInJson.Id(item, "region"), CheckInJson.Id(item, "game_uid", 32))));
        if (roles.Any(role => !role.RoleId.All(char.IsAsciiDigit))) throw new CheckInFailure("checkin_role_identity_invalid");
        return roles;
    }
    internal static CheckInRole[] Kuro(JsonElement root, string gameId)
    {
        var list = CheckInJson.Property(root, "data", JsonValueKind.Array);
        if (list.GetArrayLength() > 256) throw new CheckInFailure("checkin_roles_too_many");
        return Distinct(list.EnumerateArray().Where(item => !item.TryGetProperty("gameId", out _) || CheckInJson.Id(item, "gameId") == gameId)
            .Select(item => new CheckInRole(CheckInJson.Id(item, "roleId"), CheckInJson.Id(item, "serverId"), CheckInJson.Id(item, "userId"))));
    }
    internal static string Tajiduo(JsonElement root, string? selected)
    {
        var list = CheckInJson.Property(CheckInJson.Property(root, "data", JsonValueKind.Object), "roles", JsonValueKind.Array);
        if (list.GetArrayLength() > 256) throw new CheckInFailure("checkin_roles_too_many");
        var ids = list.EnumerateArray().Select(item => CheckInJson.Id(item, "roleId", 40)).Distinct(StringComparer.Ordinal).ToArray();
        if (ids.Any(id => !TajiduoCredential.Numeric(id))) throw new CheckInFailure("checkin_role_identity_invalid");
        if (ids.Length == 0 || selected is not null && !ids.Contains(selected)) throw new CheckInFailure("no_role");
        if (selected is null && ids.Length != 1) throw new CheckInFailure("role_selection_required");
        return selected ?? ids[0];
    }
    internal static CheckInRole[] Passport(JsonElement root, bool endfield)
    {
        var list = CheckInJson.Property(CheckInJson.Property(root, "data", JsonValueKind.Object), "list", JsonValueKind.Array);
        if (list.GetArrayLength() > 64) throw new CheckInFailure("checkin_roles_too_many");
        var result = new List<CheckInRole>(); var expected = endfield ? "endfield" : "arknights";
        foreach (var game in list.EnumerateArray())
        {
            var appCode = CheckInJson.Property(game, "appCode", JsonValueKind.String).GetString();
            if (appCode != expected && appCode != (endfield ? "3" : "1")) continue;
            var bindings = CheckInJson.Property(game, "bindingList", JsonValueKind.Array);
            if (bindings.GetArrayLength() > 256) throw new CheckInFailure("checkin_roles_too_many");
            foreach (var binding in bindings.EnumerateArray())
            {
                var uid = CheckInJson.Id(binding, "uid");
                if (!endfield) { result.Add(new(uid, CheckInJson.Id(binding, "channelMasterId"), uid)); continue; }
                if (binding.TryGetProperty("roles", out var roles))
                {
                    if (roles.ValueKind != JsonValueKind.Array || roles.GetArrayLength() > 256) throw new CheckInFailure("checkin_response_shape_unknown");
                    foreach (var role in roles.EnumerateArray()) result.Add(new(CheckInJson.Id(role, "roleId"), CheckInJson.Id(role, "serverId"), uid));
                }
                else if (binding.TryGetProperty("defaultRole", out var role) && role.ValueKind == JsonValueKind.Object)
                    result.Add(new(CheckInJson.Id(role, "roleId"), CheckInJson.Id(role, "serverId"), uid));
                else throw new CheckInFailure("checkin_response_shape_unknown");
            }
        }
        return Distinct(result);
    }
    private static CheckInRole[] Distinct(IEnumerable<CheckInRole> roles)
    {
        var values = roles.Distinct().ToArray();
        if (values.Length > 256 || values.GroupBy(role => (role.RoleId, role.ServerId)).Any(group => group.Select(role => role.UserId).Distinct().Count() > 1))
            throw new CheckInFailure("checkin_role_identity_ambiguous");
        return values;
    }
}
