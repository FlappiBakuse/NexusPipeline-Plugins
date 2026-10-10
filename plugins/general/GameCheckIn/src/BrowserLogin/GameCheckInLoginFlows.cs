using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.Credentials;

namespace NexusPipeline.Plugin.GameCheckIn.BrowserLogin;

internal sealed record LoginProviderReadiness(string Platform, string Status, string FlowVersion, string ExtractorVersion);
internal sealed class GameCheckInLoginFlows : IDisposable
{
    internal static readonly LoginProviderReadiness[] Readiness =
    [ new("cn", "not_run", "1", "1"), new("os", "passed", "1", "1"), new("skland", "not_run", "1", "1"),
      new("skport", "not_run", "1", "1"), new("kuro", "not_run", "1", "1") ];
    internal static bool IsReady(string platform) => Readiness.Any(p => p.Platform == platform && p.Status == "passed");
    private readonly List<IDisposable> _registrations = [];
    private readonly Func<string, bool> _ready;
    internal bool Ready(string platform) => platform is "os" or "cn" or "kuro" && _ready(platform);
    internal GameCheckInLoginFlows(IPluginHostContext context, CredentialDraftService drafts, Func<string, bool>? ready = null)
    {
        _ready = ready ?? IsReady;
        try
        {
            Register(HoyoLabLoginProvider.Flow(Ready("os")), new HoyoLabLoginProvider(context.Http).ValidateAsync);
            Register(MiyousheLoginProvider.Flow(Ready("cn")), new MiyousheLoginProvider(context.Http).ValidateAsync);
            Register(KuroLoginProvider.Flow(Ready("kuro")), new KuroLoginProvider(context.Http).ValidateAsync);
        }
        catch { Dispose(); throw; }

        void Register(PluginBrowserLoginFlow flow, Func<PluginBrowserCapture, CancellationToken, Task<CredentialRecord>> validate)
        {
            _registrations.Add(context.BrowserLogin.Register(flow,
            async (capture, invocation, token) =>
            {
                try
                {
                    drafts.ValidateInvocation(invocation, flow.Id);
                    var record = await validate(capture, token).ConfigureAwait(false);
                    token.ThrowIfCancellationRequested();
                    return drafts.Provisional(invocation, flow.Id, record);
                }
                catch (CredentialException ex) { return new(false, Error: ex.Code); }
                catch (OperationCanceledException) { throw; }
                catch { return new(false, Error: "readonly_validation_failed"); }
            },
            (invocation, terminal, _) => { drafts.Terminal(invocation, flow.Id, terminal); return ValueTask.CompletedTask; },
            invocation => drafts.ValidateInvocation(invocation, flow.Id)));
        }
    }
    public void Dispose()
    {
        foreach (var registration in _registrations.AsEnumerable().Reverse()) registration.Dispose();
        _registrations.Clear();
    }
}
