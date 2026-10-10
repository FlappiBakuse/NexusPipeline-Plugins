using NexusPipeline.Plugin.Abstractions;
using NexusPipeline.Plugin.GameCheckIn.Credentials;

namespace NexusPipeline.Plugin.GameCheckIn;

internal sealed partial class CheckInTaskService
{
    private void RegisterCredentialRoutes()
    {
        foreach (var (method, route) in new[] { ("POST", "credentials/editors"), ("POST", "credentials/editors/state"),
            ("DELETE", "credentials/editors"), ("PUT", "credentials/draft"), ("POST", "credentials/lease"),
            ("POST", "credentials/login/prepare"), ("POST", "tasks/credential/reveal/confirm") })
            _routes.Add(_context.WebApi.Register(new(method, route, PluginOperationAccess.General, CredentialApiAsync)));
    }
    private async ValueTask<PluginWebApiResponse> CredentialApiAsync(PluginWebApiRequest request, CancellationToken cancellationToken)
    {
        if (!TryDeserialize(request.JsonBody, out CredentialRequest? input) || input is null) return Error(400, "credential_request_invalid");
        try
        {
            var client = Client(request);
            if (request.Route == "tasks/credential/reveal/confirm")
            {
                if (!input.Confirm) return Error(400, "reveal_confirmation_required");
                return Json(new { expiresAt = _credentials.Confirm(client) });
            }
            if (request.Route == "credentials/editors" && request.Method == "POST")
            {
                await _storeGate.WaitAsync(cancellationToken).ConfigureAwait(false);
                try
                {
                    if (_stopped) return Error(503, "service_stopping");
                    if (input.TaskId is Guid taskId)
                    {
                        var store = await ReadStoreAsync(cancellationToken).ConfigureAwait(false);
                        if (!store.Tasks.Any(t => t.Id == taskId)) return Error(404, "task_not_found");
                    }
                    var payloads = new Dictionary<string, string?>(StringComparer.Ordinal);
                    foreach (string platform in PlatformOrder)
                        payloads[platform] = input.TaskId is Guid id ? await _context.Secrets.GetAsync(SecretKey(id, SecretName(platform)), cancellationToken).ConfigureAwait(false) : null;
                    return Json(_credentials.Create(client, input.TaskId, payloads), 201);
                }
                finally { _storeGate.Release(); }
            }
            if (input.EditorSessionId is not { Length: > 0 and <= 64 } editor) return Error(400, "credential_editor_required");
            if (request.Route == "credentials/editors" && request.Method == "DELETE")
            {
                _credentials.Release(client, editor);
                await _context.BrowserLogin.CancelEditorAsync(client, editor, cancellationToken).ConfigureAwait(false);
                return PluginWebApiResponse.Empty();
            }
            if (request.Route == "credentials/editors/state") return Json(_credentials.State(client, editor));
            if (request.Route == "credentials/lease") { _credentials.Lease(client, editor); return Json(_credentials.State(client, editor)); }
            if (request.Route == "credentials/draft")
            {
                var state = _credentials.Mutate(client, editor, input.Platform, input.ExpectedFieldGeneration, input.Mutation, input.Value);
                await _context.BrowserLogin.CancelEditorAsync(client, editor, cancellationToken).ConfigureAwait(false);
                return Json(state);
            }
            if (request.Route == "credentials/login/prepare")
            {
                if (!_loginFlows.Ready(input.Platform)) return Error(409, "platform_not_ready");
                return Json(_credentials.Prepare(client, editor, input.Platform, input.ExpectedFieldGeneration));
            }
            return Error(404, "credential_route_invalid");
        }
        catch (CredentialException ex) { return CredentialError(ex); }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch { return Error(500, "credential_request_failed"); }
    }
    private static PluginClientSessionContext Client(PluginWebApiRequest request) => request.ClientSession is { } client && !client.Lifetime.IsCancellationRequested
        ? client : throw new CredentialException("client_session_required");
    private PluginWebApiResponse CredentialError(CredentialException ex) => Error(ex.Code is "reveal_confirmation_required" or "client_not_supported" or "credential_editor_owner_mismatch" ? 403
        : ex.Code == "client_session_required" ? 401 : ex.Code.Contains("stale", StringComparison.Ordinal) || ex.Code.Contains("conflict", StringComparison.Ordinal) ? 409 : 400, ex.Code);
    private sealed class CredentialRequest
    {
        public Guid? TaskId { get; set; }
        public string? EditorSessionId { get; set; }
        public string Platform { get; set; } = "";
        public long ExpectedFieldGeneration { get; set; }
        public string Mutation { get; set; } = "";
        public string? Value { get; set; }
        public bool Confirm { get; set; }
    }
}
