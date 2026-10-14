using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed partial class EntryPoint : INexusPlugin, IPluginExecutionProvider, IPluginProviderConfigurationLifecycle, IPluginProviderConfigurationPreparation, IPluginProviderConfigurationSynchronization
{
    private IPluginHostContext? _host;
    private readonly List<IDisposable> _registrations = [];
    public string Id => "maa-framework";

    public ValueTask InitializeAsync(IPluginHostContext context, CancellationToken cancellationToken)
    {
        _host = context;
        _registrations.Add(_host.ExecutionProviders.Register(this));
        foreach (string route in new[] { "inspect", "discover", "profile", "preview", "secret", "import", "windows", "preset" })
            _registrations.Add(_host.WebApi.Register(new("POST", route, PluginOperationAccess.General, (request, token) => HandleAsync(route, request, token))));
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
        var schema = new ProjectCompiler(request.PackageRoot, request.InterfaceRelativePath, cancellationToken: cancellationToken).Inspect();
        return ValueTask.FromResult(new PluginProviderInspection(schema["projectName"]!.GetValue<string>(),
            schema["projectVersion"]!.GetValue<string>(), [], schema));
    }

    public async ValueTask<PluginProviderPlan> PrepareAsync(PluginProviderPrepareRequest request, CancellationToken cancellationToken)
    {
        var host = _host ?? throw new InvalidOperationException("provider disabled");
        var shared = await (request.ConfigRevision.Length == 0 ? ReadProfileAsync(host, Scope("", request.ProfileId), cancellationToken)
            : ReadRevisionAsync(host, request.ProfileId, request.ConfigRevision, cancellationToken)).ConfigureAwait(false)
            ?? throw new InvalidDataException("driver.profile_missing");
        var profile = string.IsNullOrWhiteSpace(request.UserId) ? shared
            : request.UserConfigRevision.Length != 0
                ? await ReadUserRevisionAsync(host, request.ProfileId, request.UserId, request.ScriptInstanceId, request.UserConfigRevision, cancellationToken).ConfigureAwait(false)
                    ?? throw new InvalidDataException("driver.user_revision_missing")
                : await ReadProfileAsync(host, UserScope(request.UserId, request.ScriptInstanceId), cancellationToken).ConfigureAwait(false) ?? shared;
        if (profile.ProfileId != shared.ProfileId || !Path.GetFullPath(profile.PackageRoot).Equals(Path.GetFullPath(shared.PackageRoot), StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("driver.binding_identity_changed");
        if (!ReferenceEquals(profile, shared)) ValidateBinding(profile, shared);
        if (!Path.GetFullPath(request.PackageRoot).Equals(Path.GetFullPath(profile.PackageRoot), StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("driver.package_root_changed");
        SourceDiscovery.RequireCurrent(profile, cancellationToken);
        RuntimeInputs.Verify(profile, cancellationToken);
        var compiled = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, cancellationToken).Compile(profile);
        if (compiled.Tasks.Length == 0) throw new InvalidDataException("driver.task_selection_required");
        var resources = new List<PluginProviderResource> { new("writable_root", profile.PackageRoot) };
        if (compiled.Controller["type"]!.GetValue<string>() == "Win32") resources.Add(new("desktop_input", "current_session"));
        else resources.Add(new("adb_endpoint", string.IsNullOrWhiteSpace(profile.AdbSerial)
            ? throw new InvalidDataException("driver.adb_serial_required") : profile.AdbSerial));
        string revision = shared.Revision + ":" + profile.Revision;
        string planId = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(
            request.ProfileId + "\n" + request.UserId + "\n" + revision + "\n" + compiled.ExecutionFingerprint)));
        return new(planId, revision, compiled.ExecutionFingerprint, resources,
            compiled.Tasks.Select((task, i) => new PluginProviderTask(task.Id, task.Label, i)).ToArray(),
            new JsonObject { ["profile"] = JsonSerializer.SerializeToNode(profile, DriverJson.Options),
                ["committedRevision"] = request.ConfigRevision,
                ["committedUserRevision"] = request.UserConfigRevision,
                ["compiled"] = JsonSerializer.SerializeToNode(compiled with { PublicSchema = new() }, DriverJson.Options) })
            { EffectiveConfiguration = EffectiveConfiguration.FromProfile(profile), ResultBasis = "framework-task-v1" };
    }

    public async Task<PluginProviderRunResult> RunAsync(PluginProviderRunContext context, CancellationToken cancellationToken)
    {
        var host = _host ?? throw new InvalidOperationException("provider disabled");
        var profile = context.Plan.PrivatePlan["profile"]!.Deserialize<DriverProfile>(DriverJson.Options)!;
        string committedRevision = context.Plan.PrivatePlan["committedRevision"]?.GetValue<string>() ?? "";
        var shared = await (committedRevision.Length == 0 ? ReadProfileAsync(host, Scope("", profile.ProfileId), cancellationToken)
            : ReadRevisionAsync(host, profile.ProfileId, committedRevision, cancellationToken)).ConfigureAwait(false);
        var saved = string.IsNullOrWhiteSpace(context.UserId) ? shared
            : context.Plan.PrivatePlan["committedUserRevision"]?.GetValue<string>() is { Length: > 0 } userRevision
                ? await ReadUserRevisionAsync(host, profile.ProfileId, context.UserId, context.ScriptInstanceId, userRevision, cancellationToken).ConfigureAwait(false)
                : await ReadProfileAsync(host, UserScope(context.UserId, context.ScriptInstanceId), cancellationToken).ConfigureAwait(false) ?? shared;
        if (shared is null || saved is null || shared.Revision + ":" + saved.Revision != context.Plan.ConfigRevision)
            throw new InvalidDataException("driver.profile_revision_changed");
        SourceDiscovery.RequireCurrent(profile, cancellationToken);
        RuntimeInputs.Verify(profile, cancellationToken);
        var fresh = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, cancellationToken).Compile(profile);
        if (fresh.ExecutionFingerprint != context.Plan.AuthorizationFingerprint
            || profile.AuthorizedFingerprint != fresh.ExecutionFingerprint) throw new InvalidDataException("driver.source_changed");
        var input = context.Plan.PrivatePlan.DeepClone().AsObject();
        input["profile"] = JsonSerializer.SerializeToNode(profile, DriverJson.Options);
        var frozen = context.Plan.PrivatePlan["compiled"]!.Deserialize<CompiledProject>(DriverJson.Options)!;
        string[] selected = context.SelectedTaskIds?.ToArray() ?? context.Plan.Tasks.Select(task => task.Id).ToArray();
        if (!frozen.Tasks.Select(task => task.Id).SequenceEqual(context.Plan.Tasks.Select(task => task.Id)))
            throw new InvalidDataException("driver.plan_task_mismatch");
        var selection = TaskSelection.Apply(frozen, selected);
        if (selection.Tasks.Length == 0) return new("succeeded", "MaaFramework: no selected tasks", true);
        input["selectedTaskIds"] = JsonSerializer.SerializeToNode(selected, DriverJson.Options);
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
                input["hostLaunchTarget"] = JsonSerializer.SerializeToNode(target, DriverJson.Options);
            }
            else if (type != "Adb" || target.Kind != "adb" || profile.AdbSerial != target.Identity)
                throw new InvalidDataException("driver.host_launch_target_mismatch");
        }
        var secrets = new JsonObject();
        foreach (string reference in fresh.Tasks.SelectMany(task => SecretReferences(task.Override))
            .Concat(fresh.Pretasks.SelectMany(program => SecretReferences(program.GeneratedOptionPayload))).Distinct(StringComparer.Ordinal))
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
            profile.PackageRoot, input) { UseSessionArtifacts = true }, context.PublishEvent, cancellationToken).ConfigureAwait(false);
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
            if (route == "discover")
            {
                var discovery = SourceDiscovery.Discover(body["packageRoot"]!.GetValue<string>(), body["interfacePath"]?.GetValue<string>() ?? "", token);
                return new(200, JsonSerializer.SerializeToNode(discovery, DriverJson.Options));
            }
            if (route == "inspect")
            {
                var inspection = new ProjectCompiler(body["packageRoot"]!.GetValue<string>(), body["interfacePath"]?.GetValue<string>() ?? "interface.json", body["language"]?.GetValue<string>() ?? "zh_cn", token);
                return new(200, inspection.Inspect());
            }
            string script = body["scriptId"]!.GetValue<string>();
            string profileId = body["profileId"]!.GetValue<string>();
            string user = body["userId"]?.GetValue<string>() ?? "";
            string scope = string.IsNullOrWhiteSpace(user) ? Scope(script, profileId) : UserScope(user, script);
            string sharedRevision = body["revision"]?.GetValue<string>() ?? "";
            async ValueTask<DriverProfile?> Parent() => sharedRevision.Length == 0
                ? await ReadProfileAsync(host, Scope("", profileId), token).ConfigureAwait(false)
                : await ReadRevisionAsync(host, profileId, sharedRevision, token).ConfigureAwait(false);
            if (route == "profile")
            {
                string userRevision = body["userRevision"]?.GetValue<string>() ?? "";
                var current = user.Length != 0 && userRevision.Length != 0
                    ? await ReadUserRevisionAsync(host, profileId, user, script, userRevision, token).ConfigureAwait(false)
                    : user.Length != 0 || sharedRevision.Length == 0 ? await ReadProfileAsync(host, scope, token).ConfigureAwait(false)
                    : await Parent().ConfigureAwait(false);
                if (!string.IsNullOrWhiteSpace(user))
                {
                    var parent = await Parent().ConfigureAwait(false);
                    if (parent is not null)
                        current = current is null || current.ProfileId != profileId
                            ? parent with { Revision = current?.Revision ?? "", ParentRevision = parent.Revision, AuthorizedFingerprint = "" }
                            : current.ParentRevision == parent.Revision ? current
                            : UserProfileRebase.Apply(await ReadRevisionAsync(host, profileId, current.ParentRevision, token).ConfigureAwait(false)
                                ?? throw new InvalidDataException("driver.binding_previous_parent_missing"), parent, current);
                }
                return new(200, JsonSerializer.SerializeToNode(current, DriverJson.Options));
            }
            var profile = body["profile"]?.Deserialize<DriverProfile>(DriverJson.Options)
                ?? await ReadProfileAsync(host, scope, token).ConfigureAwait(false)
                ?? (string.IsNullOrWhiteSpace(user) ? null : await Parent().ConfigureAwait(false))
                ?? throw new InvalidDataException("profile required");
            RequireCurrentProfile(profile);
            if (profile.ProfileId != profileId) throw new InvalidDataException("profile identity mismatch");
            var compiler = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, token);
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
                string sourcePath = body["sourcePath"]!.GetValue<string>();
                string kind = body["sourceKind"]!.GetValue<string>();
                string instanceId = body["instanceId"]?.GetValue<string>() ?? "";
                if (kind == "mfa")
                {
                    var mapped = ConfigurationSources.ReadMfa(compiler, profile, sourcePath, instanceId);
                    return new(200, new JsonObject { ["profile"] = JsonSerializer.SerializeToNode(mapped, DriverJson.Options), ["sourceModified"] = false });
                }
                var source = compiler.ReadScopedFile(sourcePath);
                if (kind == "mxu" && instanceId.Length == 0) return new(200, ConfigurationImporter.Instances(source));
                var imported = ConfigurationSources.Bind(compiler,
                    ConfigurationImporter.Map(kind, source, compiler.Inspect(), profile, instanceId), kind,
                    source["version"]?.GetValue<string>() ?? "5.14.0", instanceId, [sourcePath.Replace('\\', '/')]);
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
                var old = await ReadProfileAsync(host, scope, token).ConfigureAwait(false);
                if ((old?.Revision ?? "") != (body["expectedRevision"]?.GetValue<string>() ?? ""))
                    return new(409, new JsonObject { ["error"] = "revision changed; preview again" });
                if (!string.IsNullOrWhiteSpace(user))
                {
                    var parent = await Parent().ConfigureAwait(false);
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
                return new(404, new JsonObject { ["error"] = "driver.route_not_found" });
            }
            finally { _writes.Release(); }
        }
        catch (Exception ex) when (ex is InvalidDataException or JsonException or ArgumentException or IOException)
        {
            return new(400, new JsonObject { ["error"] = ex.Message });
        }
    }

    private static void RequireCurrentProfile(DriverProfile profile)
    {
        if (profile.SchemaVersion != 3) throw new InvalidDataException("driver.unsupported_profile_schema");
        ProfileMigration.Validate(profile.TaskOccurrences);
    }

    private static async ValueTask<DriverProfile?> ReadProfileAsync(IPluginHostContext host, string scope, CancellationToken token)
    {
        var source = await host.ScopedData.ReadJsonAsync("schema-3/" + scope, token).ConfigureAwait(false)
            ?? await host.ScopedData.ReadJsonAsync(scope, token).ConfigureAwait(false);
        var profile = source?.Deserialize<DriverProfile>(DriverJson.Options);
        return profile is null ? null : ProfileMigration.Upgrade(profile);
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
