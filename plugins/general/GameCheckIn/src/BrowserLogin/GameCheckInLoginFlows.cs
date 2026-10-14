using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.Credentials;

namespace NexusPipeline.Plugin.GameCheckIn.BrowserLogin;

internal sealed record LoginProviderReadiness(string Platform, string Status, string FlowVersion, string ExtractorVersion);
internal sealed class GameCheckInLoginFlows : IDisposable
{
    internal static readonly LoginProviderReadiness[] Readiness =
    [ new("cn", "passed", "3", "2"), new("os", "passed", "1", "1"), new("skland", "passed", "5", "3"),
      new("skport", "passed", "7", "3"), new("kuro", "passed", "3", "2"), new("tajiduo", "passed", "2", "2") ];
    internal static bool IsReady(string platform) => Readiness.Any(p => p.Platform == platform && p.Status == "passed");
    private readonly List<IDisposable> _registrations = [];
    private readonly Func<string, bool> _ready;
    internal bool Ready(string platform) => IsReady(platform) && _ready(platform);
    internal GameCheckInLoginFlows(IPluginHostContext context, CredentialDraftService drafts, Func<string, bool>? ready = null)
    {
        _ready = ready ?? IsReady;
        try
        {
            Register(HoyoLabLoginProvider.Flow(Ready("os")), (capture, _, token) => new HoyoLabLoginProvider(context.Http).ValidateAsync(capture, token));
            Register(MiyousheLoginProvider.Flow(Ready("cn")), (capture, trace, token) => new MiyousheLoginProvider(context.Http, trace).ValidateAsync(capture, token));
            Register(KuroLoginProvider.Flow(Ready("kuro")), (capture, trace, token) => new KuroLoginProvider(context.Http, trace).ValidateAsync(capture, token));
            Register(PassportLoginProvider.Flow("skland", Ready("skland")), (capture, trace, token) => new PassportLoginProvider(context.Http, "skland", trace).ValidateAsync(capture, token));
            Register(PassportLoginProvider.Flow("skport", Ready("skport")), (capture, trace, token) => new PassportLoginProvider(context.Http, "skport", trace).ValidateAsync(capture, token));
        }
        catch { Dispose(); throw; }

        void Register(PluginBrowserLoginFlow flow, Func<PluginBrowserCapture, LoginValidationTrace, CancellationToken, Task<CredentialRecord>> validate)
        {
            _registrations.Add(context.BrowserLogin.Register(flow,
            async (capture, invocation, token) =>
            {
                var trace = new LoginValidationTrace(flow.Id, invocation.OperationId, context.Logger);
                try
                {
                    drafts.ValidateInvocation(invocation, flow.Id);
                    var record = await validate(capture, trace, token).ConfigureAwait(false);
                    token.ThrowIfCancellationRequested();
                    var result = drafts.Provisional(invocation, flow.Id, record);
                    trace.Finish("ok");
                    return result;
                }
                catch (CredentialException ex) { trace.Finish(ex.Code); return new(false, Error: ex.Code); }
                catch (OperationCanceledException) { trace.Finish(token.IsCancellationRequested ? "cancelled" : "timeout"); throw; }
                catch { trace.Finish("readonly_validation_failed"); return new(false, Error: "readonly_validation_failed"); }
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
