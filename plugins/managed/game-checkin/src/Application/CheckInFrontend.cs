namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class CheckInFrontend(CheckInTaskEditing editing, CheckInViews views, CheckInEditors editors,
    CheckInCredentials credentials, CheckInBrowserLogins browser, TajiduoLogins tajiduo)
{
    internal async ValueTask<object> InvokeAsync(string operation, Guid? operationId, CheckInClient client, ReadOnlyMemory<byte> payload,
        CancellationToken cancellationToken)
    {
        client.Require();
        switch (operation)
        {
            case "read-state": return await views.StateAsync(client, cancellationToken);
            case "read-publication":
                var publication = CheckInJson.Read<CheckInFrontendInputs.Publication>(payload);
                return new { committed = await editing.ReadPublicationAsync(client, publication.PublicationOperationId, cancellationToken) };
            case "open-editor":
                var open = CheckInJson.Read<CheckInFrontendInputs.Open>(payload);
                var opened = await editing.OpenAsync(client, open.TaskId, open.ExpectedRevision, cancellationToken);
                try
                {
                    var state = await views.StateAsync(client, cancellationToken);
                    if (state.ConfigurationRevision != open.ExpectedRevision) throw new CheckInFailure("checkin_configuration_conflict");
                    return new CheckInEditorState(opened.Editor.EditorSessionId, opened.Editor.Revision, opened.Editor.Fields,
                        opened.Task is null ? null : state.Tasks.Single(task => task.Id == opened.Task.Id));
                }
                catch { editors.Close(client, opened.Editor.EditorSessionId); throw; }
            case "read-editor":
                var read = CheckInJson.Read<CheckInFrontendInputs.Editor>(payload); return editors.Get(client, read.EditorSessionId).View(client);
            case "lease-editor":
                var lease = CheckInJson.Read<CheckInFrontendInputs.Editor>(payload); editors.Get(client, lease.EditorSessionId).Lease(client); return new { };
            case "close-editor":
                var close = CheckInJson.Read<CheckInFrontendInputs.Editor>(payload);
                try { _ = editors.Get(client, close.EditorSessionId); }
                catch (CheckInFailure error) when (error.Code == "credential_editor_expired")
                { browser.ForgetEditor(client, close.EditorSessionId); tajiduo.ForgetEditor(client, close.EditorSessionId); return new { }; }
                await browser.CloseEditorAsync(client, close.EditorSessionId, cancellationToken);
                tajiduo.CloseEditor(client, close.EditorSessionId); editors.Close(client, close.EditorSessionId); return new { };
            case "confirm-reveal":
                var confirm = CheckInJson.Read<CheckInFrontendInputs.Editor>(payload); credentials.Confirm(client, confirm.EditorSessionId); return new { };
            case "reveal-credential":
                var reveal = CheckInJson.Read<CheckInFrontendInputs.Field>(payload);
                return await credentials.RevealAsync(client, reveal.EditorSessionId, reveal.PlatformId, cancellationToken);
            case "begin-browser-login":
                var login = CheckInJson.Read<CheckInFrontendInputs.Browser>(payload);
                return await browser.BeginAsync(client, login.EditorSessionId, login.PlatformId, login.FieldGeneration, cancellationToken);
            case "cancel-browser-login":
                var cancel = CheckInJson.Read<CheckInFrontendInputs.Field>(payload);
                await browser.CancelAsync(client, cancel.EditorSessionId, cancel.PlatformId, cancellationToken); return new { };
            case "prepare-tajiduo":
                var prepare = CheckInJson.Read<CheckInFrontendInputs.PrepareTajiduo>(payload);
                return new { operationId = await tajiduo.PrepareAsync(client, prepare.EditorSessionId, prepare.FieldGeneration, cancellationToken) };
            case "send-tajiduo-code":
                var sms = CheckInJson.Read<CheckInFrontendInputs.Sms>(payload);
                await tajiduo.SendCodeAsync(client, sms.LoginOperationId, sms.Phone, cancellationToken); return new { };
            case "login-tajiduo":
                var native = CheckInFrontendInputs.NativeLogin(payload); using (var secret = new CredentialMaterial(native.Value, "manual"))
                    return new { candidateId = await tajiduo.LoginAsync(client, native.LoginOperationId, native.EditorSessionId, native.Mode,
                        native.Phone, secret, cancellationToken), platformId = "tajiduo" };
            case "cancel-tajiduo":
                var nativeCancel = CheckInJson.Read<CheckInFrontendInputs.CancelTajiduo>(payload);
                tajiduo.Cancel(client, nativeCancel.LoginOperationId, nativeCancel.EditorSessionId); return new { };
            case "run-task":
                var run = CheckInJson.Read<CheckInFrontendInputs.Run>(payload); RequireOperation(operationId);
                await views.RunNowAsync(client, run.TaskId, cancellationToken); return await views.StateAsync(client, cancellationToken);
            case "save-task": case "delete-task": case "reorder-tasks":
                return await MutateAsync(operation, RequireOperation(operationId), client, payload, cancellationToken);
            default: throw new CheckInFailure("checkin_operation_unknown");
        }
    }
    private async ValueTask<object> MutateAsync(string operation, Guid operationId, CheckInClient client, ReadOnlyMemory<byte> payload,
        CancellationToken cancellationToken)
    {
        switch (operation)
        {
            case "save-task":
                var save = CheckInJson.Read<CheckInFrontendInputs.Save>(payload);
                await editing.SaveAsync(client, operationId, save.EditorSessionId, save.Draft, CheckInFrontendInputs.Actions(save.Secrets), cancellationToken);
                browser.ForgetEditor(client, save.EditorSessionId); tajiduo.ForgetEditor(client, save.EditorSessionId); break;
            case "delete-task":
                var delete = CheckInJson.Read<CheckInFrontendInputs.Delete>(payload);
                await editing.DeleteAsync(client, operationId, delete.TaskId, delete.ExpectedRevision, cancellationToken); break;
            case "reorder-tasks":
                var reorder = CheckInJson.Read<CheckInFrontendInputs.Reorder>(payload);
                await editing.ReorderAsync(client, operationId, reorder.TaskIds, reorder.ExpectedRevision, cancellationToken); break;
            default: throw new CheckInFailure("checkin_operation_unknown");
        }
        try { return await views.StateAsync(client, cancellationToken); }
        catch (Exception error) when (error is not OutOfMemoryException) { throw new CheckInFailure("checkin_publication_unknown"); }
    }
    private static Guid RequireOperation(Guid? operationId) => operationId is { } value && value != Guid.Empty ? value :
        throw new CheckInFailure("checkin_operation_invalid");
}
