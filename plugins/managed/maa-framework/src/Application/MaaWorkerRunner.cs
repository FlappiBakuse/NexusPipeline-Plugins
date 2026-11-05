using System.Text.Json;
using NexusPipeline.Extensibility.Execution;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaWorkerRunner
{
    internal static async Task<int> RunAsync(ExecutionProviderChannel channel)
    {
        ExecutionWorkDirectory? workspace = null;
        MaaFrozenResources? resources = null;
        MaaTaskSession? session = null;
        MaaWorkerInputs? inputs = null;
        MaaWorkerOutput? output = null;
        MaaDeviceController? controller = null;
        MaaWorkerProject? project = null;
        MaaProgramInputs? programs = null;
        var outcome = "failed"; var reason = "maa_worker_failed"; var exit = 1;
        var phase = "project";
        try
        {
            var token = channel.Stopping;
            await using var reader = await ExecutionProjectReader.ConnectAsync(channel.Bootstrap, token).ConfigureAwait(false);
            if (channel.Bootstrap.Purpose is not (null or "initialization")) throw new MaaInputFailure("maa_runtime_purpose_invalid");
            project = await MaaProjectInputs.ReadAsync(new MaaProjectSource(reader), token,
                channel.Bootstrap.Purpose == "initialization").ConfigureAwait(false);
            MaaWorkerPolicy.Require(project, channel.Bootstrap.Device?.Kind ?? "");
            phase = "workspace";
            workspace = channel.OpenWorkspace();
            phase = "resources";
            resources = await MaaFrozenResources.CreateAsync(new MaaResourceSource(reader), channel.Bootstrap.Project!.Fingerprint,
                project.Plan.ResourcePaths, workspace.InputDirectory, workspace.RequireHeld, token,
                programInputs: project.Plan.Programs.Length > 0 || project.Plan.Runtime?.NativeDirectory is not null).ConfigureAwait(false);
            var package = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, ".."));
            phase = "native_inputs";
            inputs = new(package, workspace, resources, project.Plan);
            phase = "output_scope"; output = new(workspace);
            phase = "output_cwd"; Environment.CurrentDirectory = workspace.OutputDirectory;
            var protectedInputs = new MaaWorkerSecrets(reader);
            if (project.Plan.Programs.Length > 0) programs = new(project.Plan, resources, inputs, protectedInputs, project.IsInitialization);
            if (project.IsInitialization)
            {
                phase = "initialization";
                await (programs ?? throw new MaaInputFailure("maa_initialization_selection_unbound"))
                    .RunPretasksAsync(project.InitializationOccurrences, token).ConfigureAwait(false);
                outcome = "succeeded"; reason = "maa_initialization_completed"; exit = 0;
            }
            else
            {
                if (project.PreparationOccurrences.Count > 0)
                {
                    phase = "preparation";
                    var preparationFacts = new MaaProgramFacts(channel.Bootstrap, project);
                    await (programs ?? throw new MaaInputFailure("maa_runtime_preparation_unbound"))
                        .RunPretasksAsync(project.PreparationOccurrences, token, preparationFacts.WriteAsync, retainChildren: true).ConfigureAwait(false);
                }
                phase = "device";
                controller = new(await ExecutionDeviceClient.ConnectAsync(channel.Bootstrap, token).ConfigureAwait(false));
                await controller.ConfigureAsync(project.Plan.Controller, token).ConfigureAwait(false);
                session = new(inputs, controller, TimeSpan.FromDays(1), TimeSpan.FromSeconds(8), output,
                    payloadFactory: protectedInputs.PayloadAsync, agents: programs?.Agents());
                phase = "native_init";
                await session.InitializeAsync(token).ConfigureAwait(false);
                var rows = project.Tasks.Select(task => new MaaSessionTask(task.OccurrenceId, task.SourceId, task.Entry,
                    JsonSerializer.SerializeToUtf8Bytes(task.Pipeline), task.RepeatCount)
                    { CompletedRepetitions = project.CompletedRepetitions(task.OccurrenceId) }).ToArray();
                phase = "native_tasks";
                var facts = await session.RunAsync(rows, token).ConfigureAwait(false);
                if (facts.Count == rows.Sum(task => task.RepeatCount - task.CompletedRepetitions) && facts.All(fact => fact.Status == 3000))
                { outcome = "succeeded"; reason = "maa_tasks_completed"; exit = 0; }
                else reason = "maa_task_failed";
            }
        }
        catch (OperationCanceledException) { outcome = "cancelled"; reason = "maa_worker_cancelled"; exit = 2; }
        catch (MaaInputFailure) { reason = "maa_worker_input_rejected"; }
        catch (IOException error) when (error.Message.StartsWith("maa_", StringComparison.Ordinal) &&
            error.Message.Length <= 80 && error.Message.All(character => character is >= 'a' and <= 'z' or >= '0' and <= '9' or '_'))
        { reason = error.Message; }
        catch (Exception error) { reason = "maa_" + phase + "_" + unchecked((uint)error.HResult).ToString("x8", System.Globalization.CultureInfo.InvariantCulture); }
        try
        {
            if (session is not null) await session.StopAsync().ConfigureAwait(false);
            else
            {
                if (controller is not null) await controller.DisposeAsync().ConfigureAwait(false);
                if (inputs is not null) await inputs.DisposeAsync().ConfigureAwait(false);
            }
            if (programs is not null) await programs.DisposeAsync().ConfigureAwait(false);
        }
        catch
        {
            await TerminalAsync(channel, "failed", "maa_native_drain_unverified").ConfigureAwait(false);
            // Retain native callback and file owners until the Host stops this entire process family.
            await Task.Delay(Timeout.InfiniteTimeSpan).ConfigureAwait(false);
        }
        try
        {
            if (session is not null && project is not null)
                await MaaWorkerFacts.WriteAsync(channel.Bootstrap, project, session.Facts).ConfigureAwait(false);
        }
        catch { outcome = "failed"; reason = "maa_native_facts_unavailable"; exit = 1; }
        if (output is not null) await output.DisposeAsync().ConfigureAwait(false);
        resources?.Dispose(); workspace?.Dispose();
        await TerminalAsync(channel, outcome, reason).ConfigureAwait(false);
        return exit;
    }
    private static async Task TerminalAsync(ExecutionProviderChannel channel, string outcome, string reason)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
        try { await channel.PublishTerminalAsync(outcome, reason, timeout.Token).ConfigureAwait(false); }
        catch (Exception error) when (error is IOException or OperationCanceledException or ObjectDisposedException) { }
    }
}
