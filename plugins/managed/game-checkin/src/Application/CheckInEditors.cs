namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed class CheckInEditors : IDisposable
{
    private readonly Dictionary<string, CredentialEditor> editors = new(StringComparer.Ordinal);
    private bool disposed;
    internal CredentialEditor Add(CheckInClient client, Guid? taskId, long revision, IReadOnlyDictionary<string, SavedCredentialField> saved)
    {
        lock (editors)
        {
            ObjectDisposedException.ThrowIf(disposed, this); client.Require();
            RemoveExpired();
            if (editors.Count >= 256) throw new CheckInFailure("credential_editor_limit");
            var editor = new CredentialEditor(client, taskId, revision, saved);
            editors.Add(editor.Id, editor); return editor;
        }
    }
    internal CredentialEditor Get(CheckInClient client, string id)
    {
        lock (editors)
        {
            ObjectDisposedException.ThrowIf(disposed, this);
            if (!editors.TryGetValue(id, out var editor)) throw new CheckInFailure("credential_editor_expired");
            _ = editor.View(client); return editor;
        }
    }
    internal void Close(CheckInClient client, string id)
    {
        lock (editors)
        {
            if (!editors.TryGetValue(id, out var editor)) return;
            _ = editor.View(client); editors.Remove(id); editor.Dispose();
        }
    }
    internal void RemoveCommitted(string id)
    { lock (editors) { if (editors.Remove(id, out var editor)) editor.Dispose(); } }
    private void RemoveExpired()
    {
        foreach (var (id, editor) in editors.ToArray())
        {
            if (editor.CanPrune) { editors.Remove(id); editor.Dispose(); }
        }
    }
    public void Dispose()
    {
        lock (editors)
        { if (disposed) return; disposed = true; foreach (var editor in editors.Values) editor.Dispose(); editors.Clear(); }
    }
}
