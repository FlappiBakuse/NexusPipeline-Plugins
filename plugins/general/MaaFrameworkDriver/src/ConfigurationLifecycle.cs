using System.Text.Json;
using System.Text.Json.Nodes;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.MaaFrameworkDriver;

public sealed partial class EntryPoint
{
    public ValueTask<PluginProviderConfigurationDiscovery> DiscoverAsync(PluginProviderConfigurationRequest request, CancellationToken token)
    {
        var discovery = SourceDiscovery.Discover(request.PackageRoot, request.InterfaceRelativePath, token);
        return ValueTask.FromResult(new PluginProviderConfigurationDiscovery(
            JsonSerializer.SerializeToNode(discovery, DriverJson.Options)!.AsObject(), []));
    }

    public async ValueTask<PluginProviderConfigurationCandidate> StageAsync(PluginProviderConfigurationRequest request, CancellationToken token)
    {
        var host = _host ?? throw new InvalidOperationException("provider disabled");
        Scope(request.OperationId); Scope(request.ProfileId);
        DriverProfile? userDraft = null, userParent = null, oldUserParent = null;
        if (request.UserId.Length != 0)
        {
            UserScope(request.UserId, request.ScriptInstanceId);
            string sharedRevision = request.Configuration["sharedRevision"]?.GetValue<string>() ?? "";
            userParent = await ReadRevisionAsync(host, request.ProfileId, sharedRevision, token).ConfigureAwait(false)
                ?? throw new InvalidDataException("configuration.user.parent_missing");
            SourceDiscovery.RequireCurrent(userParent, token);
            var saved = request.ExpectedRevision.Length == 0 ? null
                : await ReadUserRevisionAsync(host, request.ProfileId, request.UserId, request.ScriptInstanceId, request.ExpectedRevision, token).ConfigureAwait(false)
                    ?? throw new InvalidDataException("configuration.user.expected_revision_missing");
            userDraft = request.Configuration["profile"]?.Deserialize<DriverProfile>(DriverJson.Options) ?? saved ?? userParent;
            oldUserParent = userDraft.ParentRevision.Length == 0 ? userParent
                : await ReadRevisionAsync(host, request.ProfileId, userDraft.ParentRevision, token).ConfigureAwait(false)
                    ?? throw new InvalidDataException("configuration.user.previous_parent_missing");
        }
        var target = request.Configuration["profile"]?.Deserialize<DriverProfile>(DriverJson.Options)
            ?? (request.ExpectedRevision.Length != 0 ? await ReadRevisionAsync(host, request.ProfileId, request.ExpectedRevision, token).ConfigureAwait(false)
                : await ReadProfileAsync(host, Scope(request.ProfileId), token).ConfigureAwait(false))
            ?? new DriverProfile { SchemaVersion = 3, ProfileId = request.ProfileId, PackageRoot = request.PackageRoot };
        if (userParent is not null) target = userParent;
        if (target.ProfileId != request.ProfileId || !Path.GetFullPath(target.PackageRoot).Equals(Path.GetFullPath(request.PackageRoot), StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("configuration.binding_identity_changed");
        if (request.UserId.Length == 0 && request.ExpectedRevision.Length != 0)
        {
            var current = await ReadRevisionAsync(host, request.ProfileId, request.ExpectedRevision, token).ConfigureAwait(false);
            if (current is null) throw new InvalidDataException("configuration.expected_revision_missing");
        }
        string requestedInterface = request.InterfaceRelativePath;
        if (requestedInterface.Length == 0 && (target.SourceBinding is not null || request.Configuration["profile"]?["interfacePath"] is not null))
            requestedInterface = target.InterfacePath;
        var discovery = SourceDiscovery.Discover(request.PackageRoot, requestedInterface, token);
        if (discovery.InterfacePath.Length == 0) throw new InvalidDataException("source.interface.explicit_selection_required");
        target = target with { InterfacePath = discovery.InterfacePath };
        ConfigurationSourceCandidate? source = null;
        if (target.SourceBinding is { } binding)
            source = discovery.Candidates.SingleOrDefault(item => item.Kind == binding.SourceKind && item.InstanceId == binding.SourceInstanceId
                && item.RelativePath.Equals(binding.SourceFiles[0], StringComparison.OrdinalIgnoreCase))
                ?? throw new InvalidDataException("source.selected_instance_removed");
        else if (request.Configuration["sourceId"]?.GetValue<string>() is { Length: > 0 } id)
            source = discovery.Candidates.SingleOrDefault(item => item.Id == id) ?? throw new InvalidDataException("source.selected_instance_removed");
        else if (discovery.Candidates.Length == 1) source = discovery.Candidates[0];
        else throw new InvalidDataException("source.explicit_selection_required");
        var previousBinding = target.SourceBinding;
        target = SourceDiscovery.Read(target, source, token);
        if (previousBinding is not null && previousBinding.RootIdentity != target.SourceBinding!.RootIdentity)
            throw new InvalidDataException("source.root.explicit_rebind_required");
        var compiler = new ProjectCompiler(target.PackageRoot, target.InterfacePath, target.Language, token);
        var semantic = compiler.CompileSemantics(target, token);
        if (!request.SourceOnly && semantic.Controller["type"]!.GetValue<string>() == "Win32" && target.WindowHandle == 0 && target.WindowExecutable.Length == 0)
        {
            var windows = WindowDiscovery.Find(semantic.Controller).OfType<JsonObject>().ToArray();
            if (windows.Length != 1) throw new InvalidDataException("configuration.window.explicit_constraint_required");
            var window = windows[0];
            target = target with { WindowHandle = window["handle"]!.GetValue<long>(), WindowProcessId = window["pid"]!.GetValue<int>(),
                WindowExecutable = window["executable"]!.GetValue<string>(), WindowStartedAtUtc = window["startedAtUtc"]!.GetValue<DateTime>(),
                WindowSelection = "executable" };
        }
        var sourceSnapshot = target.SourceSnapshot!;
        target = RuntimeInputs.Bind(target, token);
        target = SourceDiscovery.Read(target, source, token);
        if (target.SourceSnapshot!.SourceHash != sourceSnapshot.SourceHash || target.SourceSnapshot.PiHash != sourceSnapshot.PiHash)
            throw new InvalidDataException("source.unstable_writes");
        compiler.VerifyReadSnapshot();
        if (userDraft is not null) target = UserProfileRebase.Apply(oldUserParent!, target, userDraft);
        semantic = new ProjectCompiler(target.PackageRoot, target.InterfacePath, target.Language, token).CompileSemantics(target, token);
        target = target with { ParentRevision = userParent?.Revision ?? request.ExpectedRevision, Revision = Guid.NewGuid().ToString("N"), AuthorizedFingerprint = "" };
        var resources = new List<PluginProviderResource> { new("writable_root", target.PackageRoot) };
        if (semantic.Controller["type"]!.GetValue<string>() == "Win32") resources.Add(new("desktop_input", "current_session"));
        else resources.Add(new("adb_endpoint", target.AdbSerial.Length > 0 ? target.AdbSerial : throw new InvalidDataException("configuration.adb.exact_serial_required")));
        PluginProviderConfigurationLaunch? launch = null;
        if (target.HostLaunchRequired)
        {
            var configuration = target.HostLaunchConfiguration;
            if (configuration["launchGame"]?.GetValue<bool>() != true || configuration["gameMode"]?.GetValue<string>() != "pc"
                || configuration["gameExe"]?.GetValue<string>() != target.WindowExecutable)
                throw new InvalidDataException("configuration.launch.mapping_invalid");
            using var executable = File.OpenRead(target.WindowExecutable);
            launch = new(target.WindowExecutable, configuration["gameArgs"]?.GetValue<string>() ?? "",
                configuration["gameWaitSeconds"]?.GetValue<int>() ?? 30,
                Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(executable)).ToLowerInvariant());
        }
        var dependencies = new JsonObject { ["schemaVersion"] = 1,
            ["lock"] = JsonSerializer.SerializeToNode(target.RuntimeInputs, DriverJson.Options) };
        return new(request.OperationId, request.ProfileId, target.Revision, request.ExpectedRevision, "pending_" + target.RuntimeInputs!.LockHash, resources,
            new() { ["profile"] = JsonSerializer.SerializeToNode(target, DriverJson.Options), ["userId"] = request.UserId, ["scriptId"] = request.ScriptInstanceId },
            dependencies, launch);
    }

    public async ValueTask<PluginProviderConfigurationSourceState> InspectSourceAsync(PluginProviderConfigurationRequest request, CancellationToken token)
    {
        var host = _host ?? throw new InvalidOperationException("provider disabled");
        var profile = await (request.UserId.Length == 0 ? ReadRevisionAsync(host, request.ProfileId, request.ExpectedRevision, token)
            : ReadUserRevisionAsync(host, request.ProfileId, request.UserId, request.ScriptInstanceId, request.ExpectedRevision, token)).ConfigureAwait(false);
        if (request.UserId.Length != 0 && profile is not null && profile.ParentRevision != request.Configuration["sharedRevision"]?.GetValue<string>())
            return new("changed", "parent_" + request.Configuration["sharedRevision"]?.GetValue<string>(), "source.user_rebase_required");
        if (profile?.SourceBinding is not { } binding || profile.SourceSnapshot is null) return new("needs_attention", "", "source.binding.missing");
        if (!Path.GetFullPath(profile.PackageRoot).Equals(Path.GetFullPath(request.PackageRoot), StringComparison.OrdinalIgnoreCase))
            return new("needs_attention", "", "source.root.explicit_rebind_required");
        try
        {
            var source = new ConfigurationSourceCandidate("", binding.SourceKind, binding.SourceFiles[0], binding.SourceInstanceId, "");
            var current = SourceDiscovery.Read(profile, source, token);
            if (current.SourceBinding!.RootIdentity != binding.RootIdentity) return new("needs_attention", "", "source.root.explicit_rebind_required");
            if (current.SourceSnapshot!.SourceRevision != profile.SourceSnapshot.SourceRevision)
                return new("changed", current.SourceSnapshot.SourceRevision, "");
            var compiler = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, token);
            var compiled = compiler.Compile(profile, token); compiler.VerifyReadSnapshot();
            string[] files = binding.SourceFiles.Concat(compiler.ReadFiles.Keys)
                .Concat(compiled.AuthorizationManifest?["inputFiles"]?.AsArray().Select(item => item!.GetValue<string>()) ?? [])
                .Select(file => file.Replace('\\', '/')).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            string[] directories = compiled.ResourcePaths.Select(path => Path.GetRelativePath(profile.PackageRoot, path).Replace('\\', '/')).ToArray();
            return compiled.ExecutionFingerprint == profile.AuthorizedFingerprint ? new("current", profile.SourceSnapshot.SourceRevision, "", files, directories)
                : new("changed", compiled.ExecutionFingerprint, "", files, directories);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception error) when (error is IOException or JsonException or ArgumentException)
        { return new("needs_attention", "", "source.mapping_or_dependency_changed"); }
    }

    public ValueTask<PluginProviderConfigurationCandidate> PrepareDependenciesAsync(PluginProviderConfigurationCandidate candidate, CancellationToken token)
    {
        var profile = candidate.PrivateCandidate["profile"]!.Deserialize<DriverProfile>(DriverJson.Options)!;
        SourceDiscovery.RequireCurrent(profile, token);
        RuntimeInputs.Verify(profile, token);
        var compiler = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, token);
        var compiled = compiler.Compile(profile, token);
        compiler.VerifyReadSnapshot();
        profile = profile with { AuthorizedFingerprint = compiled.ExecutionFingerprint };
        return ValueTask.FromResult(candidate with { AuthorizationFingerprint = compiled.ExecutionFingerprint,
            PrivateCandidate = new() { ["profile"] = JsonSerializer.SerializeToNode(profile, DriverJson.Options),
                ["userId"] = candidate.PrivateCandidate["userId"]?.DeepClone(), ["scriptId"] = candidate.PrivateCandidate["scriptId"]?.DeepClone(),
                ["compiled"] = JsonSerializer.SerializeToNode(compiled with { PublicSchema = new() }, DriverJson.Options) } });
    }

    public async Task<PluginProviderConfigurationInitialization> InitializeAsync(PluginProviderConfigurationContext context, CancellationToken token)
    {
        var candidate = context.Candidate;
        var profile = candidate.PrivateCandidate["profile"]!.Deserialize<DriverProfile>(DriverJson.Options)!;
        SourceDiscovery.RequireCurrent(profile, token);
        RuntimeInputs.Verify(profile, token);
        var compiled = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, token).Compile(profile);
        if (compiled.ExecutionFingerprint != candidate.AuthorizationFingerprint) throw new InvalidDataException("configuration.inputs_changed");
        var input = candidate.PrivateCandidate.DeepClone().AsObject();
        input["mode"] = "initialize_only"; input["operationId"] = candidate.OperationId; input["revision"] = candidate.Revision;
        if (context.LaunchTarget is { } launch) input["hostLaunchTarget"] = JsonSerializer.SerializeToNode(launch, DriverJson.Options);
        var host = _host ?? throw new InvalidOperationException("provider disabled");
        var secrets = new JsonObject();
        foreach (string reference in compiled.Tasks.SelectMany(task => SecretReferences(task.Override))
            .Concat(compiled.Pretasks.SelectMany(program => SecretReferences(program.GeneratedOptionPayload))).Distinct(StringComparer.Ordinal))
        {
            string user = candidate.PrivateCandidate["userId"]?.GetValue<string>() ?? "";
            string script = candidate.PrivateCandidate["scriptId"]?.GetValue<string>() ?? "";
            if (!reference.StartsWith("secret:" + SecretPrefix(profile.ProfileId, "", ""), StringComparison.Ordinal)
                && (user.Length == 0 || !reference.StartsWith("secret:" + SecretPrefix(profile.ProfileId, user, script), StringComparison.Ordinal)))
                throw new InvalidDataException("driver.secret_scope_mismatch");
            secrets[reference] = await host.Secrets.GetAsync(reference[7..], token).ConfigureAwait(false)
                ?? throw new InvalidDataException("driver.secret_missing");
        }
        input["secrets"] = secrets;
        JsonObject facts = new();
        async ValueTask Publish(PluginProviderEvent item)
        {
            if (item.Kind == "progress" && item.Evidence["code"]?.GetValue<string>() == "initialization.completed") facts = item.Evidence.DeepClone().AsObject();
            await context.PublishEvent(item).ConfigureAwait(false);
        }
        var result = await context.Worker.RunAsync(new("worker/NexusPipeline.MaaWorker.exe", [], profile.PackageRoot, input) { UseSessionArtifacts = true }, Publish, token).ConfigureAwait(false);
        bool ready = result.ExitKind == "completed" && result.ExitCode == 0 && result.CleanupConfirmed
            && facts["operationId"]?.GetValue<string>() == candidate.OperationId && facts["revision"]?.GetValue<string>() == candidate.Revision
            && facts["fingerprint"]?.GetValue<string>() == candidate.AuthorizationFingerprint && facts["formalTasksSubmitted"]?.GetValue<int>() == 0;
        return new(ready, result.CleanupConfirmed, facts, ready ? [] : [new("configuration.initialization_failed", "Initialization did not finish with confirmed cleanup", "error")]);
    }

    public async ValueTask CommitAsync(PluginProviderConfigurationCandidate candidate, PluginProviderConfigurationInitialization initialization, CancellationToken token)
    {
        if ((!initialization.Ready && !initialization.SourceOnly) || !initialization.CleanupConfirmed
            || initialization.SourceOnly && candidate.ExpectedRevision.Length == 0) throw new InvalidDataException("configuration.initialization_required");
        var host = _host ?? throw new InvalidOperationException("provider disabled");
        var profile = candidate.PrivateCandidate["profile"]!.Deserialize<DriverProfile>(DriverJson.Options)!;
        if (profile.Revision != candidate.Revision || profile.ProfileId != candidate.ProfileId) throw new InvalidDataException("configuration.candidate_identity_changed");
        SourceDiscovery.RequireCurrent(profile, token);
        RuntimeInputs.Verify(profile, token);
        var current = new ProjectCompiler(profile.PackageRoot, profile.InterfacePath, profile.Language, token).Compile(profile);
        if (current.ExecutionFingerprint != candidate.AuthorizationFingerprint) throw new InvalidDataException("configuration.inputs_changed");
        await _writes.WaitAsync(token).ConfigureAwait(false);
        try
        {
            string user = candidate.PrivateCandidate["userId"]?.GetValue<string>() ?? "";
            string script = candidate.PrivateCandidate["scriptId"]?.GetValue<string>() ?? "";
            string scope = user.Length == 0 ? RevisionScope(candidate.ProfileId, candidate.Revision) : UserRevisionScope(candidate.ProfileId, user, script, candidate.Revision);
            var existing = (await host.ScopedData.ReadJsonAsync(scope, token).ConfigureAwait(false))?.Deserialize<DriverProfile>(DriverJson.Options);
            if (existing is not null)
            {
                if (JsonSerializer.Serialize(existing, DriverJson.Options) != JsonSerializer.Serialize(profile, DriverJson.Options))
                    throw new InvalidDataException("configuration.revision_collision");
                return;
            }
            await host.ScopedData.WriteAsync(scope, profile, token).ConfigureAwait(false);
        }
        finally { _writes.Release(); }
    }

    public ValueTask AbortAsync(PluginProviderConfigurationCandidate candidate, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        // Immutable revisions may already be referenced by the Host's visible pointer.
        return ValueTask.CompletedTask;
    }

    private static string RevisionScope(string profile, string revision)
    {
        Scope(profile); Scope(revision);
        return "schema-3/profile-revisions/" + profile + "/" + revision;
    }

    private static async ValueTask<DriverProfile?> ReadRevisionAsync(IPluginHostContext host, string profile, string revision, CancellationToken token)
        => (await host.ScopedData.ReadJsonAsync(RevisionScope(profile, revision), token).ConfigureAwait(false))?.Deserialize<DriverProfile>(DriverJson.Options);

    private static string UserRevisionScope(string profile, string user, string script, string revision)
    {
        Scope(profile); Scope(revision);
        return UserScope(user, script) + "/revisions/" + profile + "/" + revision;
    }
    private static async ValueTask<DriverProfile?> ReadUserRevisionAsync(IPluginHostContext host, string profile, string user, string script, string revision, CancellationToken token)
        => (await host.ScopedData.ReadJsonAsync(UserRevisionScope(profile, user, script, revision), token).ConfigureAwait(false))?.Deserialize<DriverProfile>(DriverJson.Options);
}
