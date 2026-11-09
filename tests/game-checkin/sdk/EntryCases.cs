using System.Runtime.Loader;
using System.Text.Json;
using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Assets;
using NexusPipeline.Extensibility.Frontend;
using NexusPipeline.Extensibility.Lifecycle;
using NexusPipeline.Extensibility.Media;
using NexusPipeline.Extensibility.Networking;
using NexusPipeline.Extensibility.Notifications;
using NexusPipeline.Extensibility.Protocol;
using NexusPipeline.Extensibility.Scheduling;

internal static class EntryCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run, string packagePath, string expectedAssemblySha256)
    {
        using var package = System.IO.Compression.ZipFile.OpenRead(Path.GetFullPath(packagePath));
        using var entry = package.GetEntry("NexusPipeline.Extensions.GameCheckIn.dll")!.Open(); using var stream = new MemoryStream();
        await entry.CopyToAsync(stream); var bytes = stream.ToArray();
        if (Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(bytes)) != expectedAssemblySha256) throw new InvalidOperationException("original_assembly_changed");
        stream.Position = 0; var assembly = AssemblyLoadContext.Default.LoadFromStream(stream);
        var type = assembly.GetType("NexusPipeline.Extensions.GameCheckIn.CheckInExtension", true)!;
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        IExtension Create(Fixture fixture) => (IExtension)Activator.CreateInstance(type, fixture.Context)!;
        await run("original-zip-entry-registers-business-provider-and-waits-for-ready-before-frontend-read", async () => {
            await using var fixture = new Fixture(); var extension = Create(fixture); var frontend = (IExtensionFrontend)extension;
            Assert(fixture.Ports.DocumentReads == 0);
            await extension.ActivateAsync(fixture.Scope, default); await fixture.Ready.Entered.Task;
            Assert(fixture.Schedules.Id == "checkin" && fixture.Schedules.Handler is IManualWorkHandler && fixture.Schedules.Handler is IScheduledWorkPlanningHandler);
            var pending = frontend.InvokeAsync(fixture.Call("read-state"), default).AsTask(); Assert(!pending.IsCompleted && fixture.Ports.DocumentReads == 0);
            fixture.Ready.Signal.SetResult(); using var response = JsonDocument.Parse((await pending).Content); var state = response.RootElement.GetProperty("value");
            Assert(response.RootElement.GetProperty("ok").GetBoolean() && state.GetProperty("tasks").GetArrayLength() == 0 &&
                state.GetProperty("platforms").EnumerateArray().All(platform => !platform.GetProperty("browserLogin").GetProperty("ready").GetBoolean()));
        });
        await run("original-zip-entry-manual-secret-save-plans-and-delete-use-real-sdk-boundaries", async () => {
            await using var fixture = new Fixture(); var extension = Create(fixture); await extension.ActivateAsync(fixture.Scope, default); fixture.Ready.Signal.SetResult();
            var frontend = (IExtensionFrontend)extension;
            using var opened = await InvokeAsync(frontend, fixture.Call("open-editor", new { taskId = (string?)null, expectedRevision = 0 }));
            var editor = opened.RootElement.GetProperty("value").GetProperty("editorSessionId").GetString(); var schedule = Guid.NewGuid().ToString("D");
            var secrets = CheckInCatalog.Platforms.ToDictionary(platform => platform.Id, platform => platform.Id == "kuro" ?
                (object)new { action = "set", fieldGeneration = 0, value = "synthetic-private-token" } : new { action = "keep", fieldGeneration = 0 });
            using var saved = await InvokeAsync(frontend, fixture.Call("save-task", new { editorSessionId = editor, secrets,
                draft = new { id = (string?)null, name = "original-module-task", remark = "", enabled = true, games = new { kuro = new[] { "ww" } },
                    schedules = new[] { new { id = schedule, days = new[] { 1 }, enabled = true, time = "09:00" } }, notification = new { enabled = false, notificationTaskIds = Array.Empty<string>() } } }));
            Assert(saved.RootElement.GetProperty("ok").GetBoolean()); var taskId = Guid.Parse(saved.RootElement.GetProperty("value").GetProperty("tasks")[0].GetProperty("id").GetString()!);
            Assert(!fixture.Work.Held && fixture.Work.HeldTask == taskId && fixture.Ports.AtomicWrites == 1 && fixture.Ports.Applies == 0 && fixture.Ports.SingleWrites == 0);
            Assert(!System.Text.Encoding.UTF8.GetString(fixture.Ports.Document!.Json.Span).Contains("synthetic-private-token", StringComparison.Ordinal));
            var plans = await ((IScheduledWorkPlanningHandler)fixture.Schedules.Handler!).ReadPlansAsync(default);
            Assert(plans.Tasks.Single().OwnerTaskId == taskId.ToString("D") && plans.Tasks.Single().LocalMinute == 540 && plans.Tasks.Single().Weekdays.Single() == 1);
            var manual = await ((IManualWorkHandler)fixture.Schedules.Handler!).ReadTaskAsync(taskId, default); Assert(manual!.ScheduledTaskIds.Single() == plans.Tasks.Single().TaskId);
            using var deleted = await InvokeAsync(frontend, fixture.Call("delete-task", new { taskId, expectedRevision = 1 }));
            Assert(deleted.RootElement.GetProperty("ok").GetBoolean() && deleted.RootElement.GetProperty("value").GetProperty("tasks").GetArrayLength() == 0 &&
                !fixture.Work.Held && fixture.Work.HeldTask == taskId && fixture.Ports.AtomicWrites == 2 && await ((IManualWorkHandler)fixture.Schedules.Handler!).ReadTaskAsync(taskId, default) is null);
        });
        await run("original-zip-entry-scope-stop-retires-private-frontend-client", async () => {
            await using var fixture = new Fixture(); var extension = Create(fixture); await extension.ActivateAsync(fixture.Scope, default); fixture.Ready.Signal.SetResult();
            var frontend = (IExtensionFrontend)extension; using var state = await InvokeAsync(frontend, fixture.Call("read-state")); await fixture.Scope.DisposeAsync();
            try { await frontend.InvokeAsync(fixture.Call("read-state"), default); }
            catch (OperationCanceledException) { return; }
            throw new InvalidOperationException("stopped_original_entry_returned_private_state");
        });
    }
    private static async Task<JsonDocument> InvokeAsync(IExtensionFrontend frontend, FrontendCall call) => JsonDocument.Parse((await frontend.InvokeAsync(call, default)).Content);
    private sealed class Fixture : IAsyncDisposable
    {
        internal readonly PersistencePorts Ports = new();
        internal readonly Scope Scope = new();
        internal readonly Ready Ready = new();
        internal readonly Schedules Schedules = new();
        internal readonly Work Work;
        internal readonly ExtensionActivationContext Context;
        private readonly CancellationTokenSource client = new();
        private readonly Guid clientId = Guid.NewGuid();
        internal Fixture()
        {
            Work = new(Ports);
            Ports.BeforeAtomic = () => { if (!Work.Held) throw new InvalidOperationException("publication_without_quiescence"); };
            Context = new(Schedules, Ports, Fake<INotificationSubmissionPort>(), Fake<IMediaPreviewRegistrationPort>(), Fake<IRunScreenshotPort>(),
                Fake<IExtensionPackageAssets>(), Fake<IExtensionRuntimeOutputs>(), documents: Ports, http: Fake<IExtensionHttp>(), activation: Ready,
                secretDocuments: Ports, notificationTargets: new Targets(), workTasks: Work, workEffects: Fake<IWorkEffects>());
        }
        internal FrontendCall Call(string operation, object? input = null) => new(operation,
            operation is "read-state" or "read-editor" or "read-publication" ? null : Guid.NewGuid(), "original-module-fixture", true,
            JsonSerializer.SerializeToUtf8Bytes(input ?? new { })) { ClientId = clientId, ClientLifetime = client.Token };
        public async ValueTask DisposeAsync() { await Scope.DisposeAsync(); client.Dispose(); Ports.Dispose(); }
    }
    private sealed class Scope : IExtensionScope
    {
        private readonly CancellationTokenSource lifetime = new();
        private readonly List<IAsyncDisposable> resources = [];
        private bool stopped;
        public CancellationToken Cancellation { get; } 
        internal Scope() => Cancellation = lifetime.Token;
        public async ValueTask OwnAsync(IAsyncDisposable resource) { if (stopped) await resource.DisposeAsync(); else resources.Add(resource); }
        public async ValueTask DisposeAsync()
        { if (stopped) return; stopped = true; lifetime.Cancel(); foreach (var resource in resources.AsEnumerable().Reverse()) await resource.DisposeAsync(); lifetime.Dispose(); }
    }
    private sealed class Ready : IExtensionActivation
    {
        internal readonly TaskCompletionSource Entered = new(TaskCreationOptions.RunContinuationsAsynchronously), Signal = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public async ValueTask WaitReadyAsync(CancellationToken cancellationToken) { Entered.TrySetResult(); await Signal.Task.WaitAsync(cancellationToken); }
    }
    private sealed class Schedules : IScheduleRegistrationPort
    {
        internal string? Id;
        internal IScheduledWorkHandler? Handler;
        public ValueTask RegisterAsync(string providerId, IScheduledWorkHandler handler, CancellationToken cancellationToken) { Id = providerId; Handler = handler; return ValueTask.CompletedTask; }
    }
    private sealed class Targets : INotificationTargets
    { public ValueTask<NotificationTargets> ReadAsync(CancellationToken cancellationToken) => ValueTask.FromResult(new NotificationTargets(1, [])); }
    private sealed class Work(PersistencePorts ports) : IWorkTasks
    {
        internal bool Held;
        internal Guid HeldTask;
        public ValueTask<WorkClock> ReadClockAsync(CancellationToken cancellationToken) => ValueTask.FromResult(new WorkClock(DateTimeOffset.UtcNow, "UTC"));
        public ValueTask<WorkTaskSnapshot> ReadAsync(string providerId, IReadOnlyList<Guid> ids, CancellationToken cancellationToken)
        {
            var store = CheckInJson.Read<CheckInTaskStore>(ports.Document!.Json);
            return ValueTask.FromResult(new WorkTaskSnapshot(new(DateTimeOffset.UtcNow, "UTC"), ids.Select(id => new WorkTaskInfo(id, store.Tasks.Single(task => task.Id == id).Revision, false, null, [])).ToArray()));
        }
        public ValueTask<IAsyncDisposable> QuiesceAsync(string providerId, Guid taskId, long revision, CancellationToken cancellationToken)
        { Held = true; HeldTask = taskId; return ValueTask.FromResult<IAsyncDisposable>(new Lease(this)); }
        public ValueTask<WorkInvocation> ReadCurrentAsync(CancellationToken cancellationToken) => throw new InvalidOperationException("unexpected_real_run");
        public ValueTask<ManualRunReceipt> RunAsync(string providerId, Guid taskId, long revision, CancellationToken cancellationToken) => throw new InvalidOperationException("unexpected_real_run");
        public ValueTask<bool> HasStoppedAsync(string providerId, Guid taskId, Guid runId, Guid attemptId, CancellationToken cancellationToken) => throw new InvalidOperationException("unexpected_real_recovery");
        private sealed class Lease(Work owner) : IAsyncDisposable
        { public ValueTask DisposeAsync() { owner.Held = false; return ValueTask.CompletedTask; } }
    }
    private static T Fake<T>() where T : class => System.Reflection.DispatchProxy.Create<T, UnexpectedSdkCall>();
}
