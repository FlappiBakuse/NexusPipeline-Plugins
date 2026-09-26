using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed class EntryPoint : INexusPlugin, IPluginExecutionProvider
{
    private IPluginHostContextV1_9? _host;
    private readonly List<IDisposable> _registrations = [];
    public string Id => "maa-framework";

    public ValueTask InitializeAsync(IPluginHostContext context, CancellationToken cancellationToken)
    {
        _host = context as IPluginHostContextV1_9 ?? throw new InvalidOperationException("Plugin API 1.9 required");
        _registrations.Add(_host.ExecutionProviders.Register(this));
        foreach (string route in new[] { "inspect", "profile", "preview", "save", "authorize", "secret", "import", "windows", "preset" })
            _registrations.Add(_host.WebApi.Register(new("POST", route, (request, token) => HandleAsync(route, request, token))));
        return ValueTask.CompletedTask;
    }

    public ValueTask StartAsync(CancellationToken cancellationToken) => ValueTask.CompletedTask;
    public ValueTask StopAsync(CancellationToken cancellationToken)
    {
        foreach (var registration in _registrations) registration.Dispose();
        _registrations.Clear(); _host = null; return ValueTask.CompletedTask;
    }

    public ValueTask<PluginProviderInspection> InspectAsync(PluginProviderInspectRequest request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var schema = new ProjectCompiler(request.PackageRoot, request.InterfaceRelativePath).Inspect();
        return ValueTask.FromResult(new PluginProviderInspection(schema["projectName"]!.GetValue<string>(),
            schema["projectVersion"]!.GetValue<string>(), [], schema));
    }

    public async ValueTask<PluginProviderPlan> PrepareAsync(PluginProviderPrepareRequest request, CancellationToken cancellationToken)
    {
        var host = _host ?? throw new InvalidOperationException("provider disabled");
        var shared = await host.ScopedData.ReadAsync<DriverProfile>(Scope("", request.ProfileId), cancellationToken).ConfigureAwait(false)
            ?? throw new InvalidDataException("driver.profile_missing");
        var profile = string.IsNullOrWhiteSpace(request.UserId) ? shared
            : await host.ScopedData.ReadAsync<DriverProfile>(UserScope(request.UserId, request.ScriptInstanceId), cancellationToken).ConfigureAwait(false) ?? shared;
        if (profile.ProfileId != shared.ProfileId || !Path.GetFullPath(profile.PackageRoot).Equals(Path.GetFullPath(shared.PackageRoot), StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("driver.binding_identity_changed");
        if (!ReferenceEquals(profile, shared)) ValidateBinding(profile, shared);
        if (!Path.GetFullPath(request.PackageRoot).Equals(Path.GetFullPath(profile.PackageRoot), StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("driver.package_root_changed");
        var compiled = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language).Compile(profile);
        if (compiled.Tasks.Length == 0) throw new InvalidDataException("driver.task_selection_required");
        var resources = new List<PluginProviderResource> { new("writable_root", profile.PackageRoot) };
        if (compiled.Controller["type"]!.GetValue<string>() == "Win32") resources.Add(new("desktop_input", "current_session"));
        else resources.Add(new("adb_endpoint", string.IsNullOrWhiteSpace(profile.AdbSerial)
            ? throw new InvalidDataException("driver.adb_serial_required") : profile.AdbSerial));
        string revision = shared.Revision + ":" + profile.Revision;
        string planId = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(
            request.ProfileId + "\n" + request.UserId + "\n" + revision + "\n" + compiled.ExecutionFingerprint)));
        return new(planId, revision, compiled.ExecutionFingerprint, resources,
            compiled.Tasks.Select((task, i) => new PluginProviderTask(task.Name, task.Label, i)).ToArray(),
            new JsonObject { ["profile"] = JsonSerializer.SerializeToNode(profile, DriverJson.Options),
                ["compiled"] = JsonSerializer.SerializeToNode(compiled with { PublicSchema = new() }, DriverJson.Options) });
    }

    public async Task<PluginProviderRunResult> RunAsync(PluginProviderRunContext context, CancellationToken cancellationToken)
    {
        var host = _host ?? throw new InvalidOperationException("provider disabled");
        var profile = context.Plan.PrivatePlan["profile"]!.Deserialize<DriverProfile>(DriverJson.Options)!;
        var shared = await host.ScopedData.ReadAsync<DriverProfile>(Scope("", profile.ProfileId), cancellationToken).ConfigureAwait(false);
        var saved = string.IsNullOrWhiteSpace(context.UserId) ? shared
            : await host.ScopedData.ReadAsync<DriverProfile>(UserScope(context.UserId, context.ScriptInstanceId), cancellationToken).ConfigureAwait(false) ?? shared;
        if (shared is null || saved is null || shared.Revision + ":" + saved.Revision != context.Plan.ConfigRevision)
            throw new InvalidDataException("driver.profile_revision_changed");
        var fresh = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language).Compile(profile);
        if (fresh.ExecutionFingerprint != context.Plan.AuthorizationFingerprint
            || profile.AuthorizedFingerprint != fresh.ExecutionFingerprint) throw new InvalidDataException("driver.authorization_required");
        var input = context.Plan.PrivatePlan.DeepClone().AsObject();
        if (profile.HostLaunchRequired && context.LaunchTarget is null)
            throw new InvalidDataException("driver.host_launch_required: explicitly apply the reviewed Host launch settings");
        if (context.LaunchTarget is { } target)
        {
            string type = fresh.Controller["type"]!.GetValue<string>();
            if (type == "Win32" && target.Kind == "win32" && target.ProcessId > 0 && target.WindowHandle != 0 && target.StartedAtUtc is not null
                && !string.IsNullOrWhiteSpace(profile.WindowExecutable)
                && Path.GetFullPath(profile.WindowExecutable).Equals(Path.GetFullPath(target.Identity), StringComparison.OrdinalIgnoreCase))
            {
                // Host readiness can see another visible window of the same process.
                // Resolve PI title/class within that exact process lifetime, never by
                // basename or by a window from another installation.
                var matching = WindowDiscovery.Find(fresh.Controller).OfType<JsonObject>().Where(window =>
                    window["pid"]!.GetValue<int>() == target.ProcessId
                    && window["executable"]!.GetValue<string>().Equals(target.Identity, StringComparison.OrdinalIgnoreCase)
                    && DateTime.Parse(window["startedAtUtc"]!.GetValue<string>(), System.Globalization.CultureInfo.InvariantCulture,
                        System.Globalization.DateTimeStyles.RoundtripKind) == target.StartedAtUtc).ToArray();
                var selected = matching.SingleOrDefault(window => window["handle"]!.GetValue<long>() == target.WindowHandle)
                    ?? (matching.Length == 1 ? matching[0] : null)
                    ?? throw new InvalidDataException("driver.host_launch_window_ambiguous");
                input["profile"] = JsonSerializer.SerializeToNode(profile with { WindowHandle = selected["handle"]!.GetValue<long>(),
                    WindowProcessId = target.ProcessId, WindowStartedAtUtc = target.StartedAtUtc }, DriverJson.Options);
            }
            else if (type != "Adb" || target.Kind != "adb" || profile.AdbSerial != target.Identity)
                throw new InvalidDataException("driver.host_launch_target_mismatch");
        }
        var secrets = new JsonObject();
        foreach (string reference in SecretReferences(input).Distinct(StringComparer.Ordinal))
        {
            string sharedPrefix = "secret:" + SecretPrefix(profile.ProfileId, "", "");
            string userPrefix = "secret:" + SecretPrefix(profile.ProfileId, context.UserId, context.ScriptInstanceId);
            if (!reference.StartsWith(sharedPrefix, StringComparison.Ordinal)
                && (string.IsNullOrWhiteSpace(context.UserId) || !reference.StartsWith(userPrefix, StringComparison.Ordinal)))
                throw new InvalidDataException("driver.secret_scope_mismatch");
            string? value = await host.Secrets.GetAsync(reference[7..], cancellationToken).ConfigureAwait(false);
            if (string.IsNullOrEmpty(value)) throw new InvalidDataException("driver.secret_missing");
            secrets[reference] = value;
        }
        input["secrets"] = secrets;
        var result = await context.Worker.RunAsync(new("worker/NexusPipeline.MaaWorker.exe", [],
            profile.PackageRoot, input), context.PublishEvent, cancellationToken).ConfigureAwait(false);
        return new(result.ExitKind == "completed" && result.ExitCode == 0 ? "succeeded"
            : result.ExitKind == "cancelled" ? "cancelled" : "failed", "MaaFramework worker: " + result.ExitKind, result.CleanupConfirmed);
    }

    private readonly SemaphoreSlim _writes = new(1, 1);
    private async ValueTask<PluginWebApiResponse> HandleAsync(string route, PluginWebApiRequest request, CancellationToken token)
    {
        var host = _host ?? throw new InvalidOperationException("provider disabled");
        if (request.ContentLength > 1024 * 1024) return new(413, new JsonObject { ["error"] = "request too large" });
        try
        {
            var body = JsonNode.Parse(request.JsonBody ?? "{}")!.AsObject();
            if (route == "inspect")
            {
                var inspection = new ProjectCompiler(body["packageRoot"]!.GetValue<string>(), body["interfacePath"]?.GetValue<string>() ?? "interface.json", body["language"]?.GetValue<string>() ?? "zh_cn");
                return new(200, inspection.Inspect());
            }
            string script = body["scriptId"]!.GetValue<string>();
            string profileId = body["profileId"]!.GetValue<string>();
            string user = body["userId"]?.GetValue<string>() ?? "";
            string scope = string.IsNullOrWhiteSpace(user) ? Scope(script, profileId) : UserScope(user, script);
            if (route == "profile")
            {
                var current = await host.ScopedData.ReadAsync<DriverProfile>(scope, token).ConfigureAwait(false);
                if (!string.IsNullOrWhiteSpace(user))
                {
                    var parent = await host.ScopedData.ReadAsync<DriverProfile>(Scope("", profileId), token).ConfigureAwait(false);
                    if (parent is not null)
                        current = current is null || current.ProfileId != profileId
                            ? parent with { Revision = current?.Revision ?? "", ParentRevision = parent.Revision, AuthorizedFingerprint = "" }
                            : current with { ParentRevision = parent.Revision,
                                AuthorizedFingerprint = current.ParentRevision == parent.Revision ? current.AuthorizedFingerprint : "" };
                }
                return new(200, JsonSerializer.SerializeToNode(current, DriverJson.Options));
            }
            var profile = body["profile"]?.Deserialize<DriverProfile>(DriverJson.Options)
                ?? await host.ScopedData.ReadAsync<DriverProfile>(scope, token).ConfigureAwait(false)
                ?? (string.IsNullOrWhiteSpace(user) ? null : await host.ScopedData.ReadAsync<DriverProfile>(Scope("", profileId), token).ConfigureAwait(false))
                ?? throw new InvalidDataException("profile required");
            if (profile.ProfileId != profileId) throw new InvalidDataException("profile identity mismatch");
            var compiler = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language);
            if (route == "preset")
                return new(200, JsonSerializer.SerializeToNode(compiler.ApplyPreset(profile,
                    body["presetName"]!.GetValue<string>()) with { AuthorizedFingerprint = "" }, DriverJson.Options));
            if (route == "windows")
            {
                var selected = compiler.Inspect()["controller"]!.AsArray().OfType<JsonObject>()
                    .SingleOrDefault(item => item["name"]?.GetValue<string>() == profile.Controller)
                    ?? throw new InvalidDataException("controller required");
                return new(200, new JsonObject { ["windows"] = WindowDiscovery.Find(selected) });
            }
            if (route == "import")
            {
                var source = compiler.ReadScopedFile(body["sourcePath"]!.GetValue<string>());
                string kind = body["sourceKind"]!.GetValue<string>();
                string instanceId = body["instanceId"]?.GetValue<string>() ?? "";
                if (kind == "mxu" && instanceId.Length == 0) return new(200, ConfigurationImporter.Instances(source));
                var imported = ConfigurationImporter.Map(kind, source, compiler.Inspect(), profile, instanceId);
                return new(200, new JsonObject { ["profile"] = JsonSerializer.SerializeToNode(imported, DriverJson.Options),
                    ["sourceModified"] = false, ["authorizationRequired"] = true });
            }
            var project = route == "secret" ? null : compiler.Compile(profile);
            if (route == "preview") return new(200, new JsonObject { ["project"] = JsonSerializer.SerializeToNode(project! with { PublicSchema = new() }, DriverJson.Options),
                ["authorized"] = profile.AuthorizedFingerprint == project!.ExecutionFingerprint,
                ["warning"] = "Project processes are isolated, not sandboxed; they may write the shared project root or access the network." });
            await _writes.WaitAsync(token).ConfigureAwait(false);
            try
            {
                var old = await host.ScopedData.ReadAsync<DriverProfile>(scope, token).ConfigureAwait(false);
                if ((old?.Revision ?? "") != (body["expectedRevision"]?.GetValue<string>() ?? ""))
                    return new(409, new JsonObject { ["error"] = "revision changed; preview again" });
                if (!string.IsNullOrWhiteSpace(user))
                {
                    var parent = await host.ScopedData.ReadAsync<DriverProfile>(Scope("", profileId), token).ConfigureAwait(false);
                    if (parent is null || !Path.GetFullPath(parent.PackageRoot).Equals(Path.GetFullPath(profile.PackageRoot), StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("driver.binding_root_mismatch");
                    ValidateBinding(profile, parent);
                }
                using var lease = host.ExecutionProviders.TryAcquireConfiguration(string.IsNullOrWhiteSpace(script) ? profileId : script, user, profile.PackageRoot);
                if (lease is null) return new(409, new JsonObject { ["error"] = "driver.configuration_in_use_or_quarantined" });
                using var previousRootLease = old is not null && !Path.GetFullPath(old.PackageRoot).Equals(Path.GetFullPath(profile.PackageRoot), StringComparison.OrdinalIgnoreCase)
                    ? host.ExecutionProviders.TryAcquireConfiguration((string.IsNullOrWhiteSpace(script) ? profileId : script) + "_previous", user, old.PackageRoot) : null;
                if (old is not null && !Path.GetFullPath(old.PackageRoot).Equals(Path.GetFullPath(profile.PackageRoot), StringComparison.OrdinalIgnoreCase) && previousRootLease is null)
                    return new(409, new JsonObject { ["error"] = "driver.previous_root_in_use_or_quarantined" });
                if (route == "secret")
                {
                    string name = body["name"]!.GetValue<string>();
                    if (name.Length is < 1 or > 64 || !name.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_')) throw new InvalidDataException("invalid secret name");
                    string nameHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(
                        System.Text.Encoding.UTF8.GetBytes(name))).ToLowerInvariant()[..48];
                    string key = SecretPrefix(profileId, user, string.IsNullOrWhiteSpace(user) ? "" : script) + nameHash;
                    await host.Secrets.SetAsync(key, body["value"]!.GetValue<string>(), token).ConfigureAwait(false);
                    return new(200, new JsonObject { ["reference"] = "secret:" + key, ["configured"] = true });
                }
                if (route == "authorize" && body["confirmedFingerprint"]?.GetValue<string>() != project!.ExecutionFingerprint)
                    return new(409, new JsonObject { ["error"] = "execution declarations changed; preview again" });
                profile = profile with { Revision = Guid.NewGuid().ToString("N"), AuthorizedFingerprint = route == "authorize"
                    ? project!.ExecutionFingerprint : old?.AuthorizedFingerprint == project!.ExecutionFingerprint ? project.ExecutionFingerprint : "" };
                await host.ScopedData.WriteAsync(scope, profile, token).ConfigureAwait(false);
                return new(200, JsonSerializer.SerializeToNode(profile, DriverJson.Options));
            }
            finally { _writes.Release(); }
        }
        catch (Exception ex) when (ex is InvalidDataException or JsonException or ArgumentException or IOException)
        {
            return new(400, new JsonObject { ["error"] = ex.Message });
        }
    }

    private static void ValidateBinding(DriverProfile profile, DriverProfile parent)
    {
        if (profile.ParentRevision != parent.Revision || profile.InterfacePath != parent.InterfacePath
            || profile.NativeDirectory != parent.NativeDirectory || profile.NativeVersion != parent.NativeVersion)
            throw new InvalidDataException("driver.binding_parent_changed: reload and explicitly review the binding");
    }

    private static string SecretPrefix(string profile, string user, string script)
    {
        // Framed identities cannot collide when user/profile IDs contain hyphens.
        byte[] identity = System.Text.Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new[] { profile, user, script }));
        return "driver-v1-" + Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(identity)).ToLowerInvariant() + "-";
    }

    internal static string Scope(string script, string profile)
    {
        static bool Safe(string value) => value.Length is >= 1 and <= 128 && value.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');
        if (!Safe(profile)) throw new InvalidDataException("invalid configuration identity");
        // Profile identity exists before Host assigns its script ID. Instances retain only this reference.
        return "profile/" + profile;
    }

    private static string UserScope(string user, string script)
    {
        Scope("", user); Scope("", script);
        return "user-script/" + user + "/" + script;
    }

    private static IEnumerable<string> SecretReferences(JsonNode? node)
    {
        if (node is JsonObject obj) foreach (var item in obj) foreach (string value in SecretReferences(item.Value)) yield return value;
        else if (node is JsonArray array) foreach (var item in array) foreach (string value in SecretReferences(item)) yield return value;
        else if (node is JsonValue scalar && scalar.TryGetValue<string>(out string? text) && text.StartsWith("secret:", StringComparison.Ordinal)) yield return text;
    }
}
