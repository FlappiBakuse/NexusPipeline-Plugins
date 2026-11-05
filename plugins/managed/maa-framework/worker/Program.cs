using NexusPipeline.Extensibility.Execution;
using NexusPipeline.Extensions.MaaFramework;

try
{
    if (args.Length != 0) throw new IOException("maa_worker_arguments_rejected");
    using var admission = new CancellationTokenSource(TimeSpan.FromSeconds(10));
    await using var channel = await ExecutionProviderChannel.ConnectAsync(Console.OpenStandardInput(), admission.Token);
    return await MaaWorkerRunner.RunAsync(channel);
}
catch
{
    Console.Error.WriteLine("maa_worker_admission_failed");
    return 1;
}
