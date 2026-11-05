using System.Text;
using System.Text.Json;
using NexusPipeline.Extensions.GameCheckIn;
using NexusPipeline.Extensibility.Scheduling;
using NexusPipeline.Extensibility.Secrets;

internal static class ProjectionCases
{
    internal static async Task RunAsync(Func<string, Func<Task>, Task> run)
    {
        static void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        await run("actual-manual-handler-projection-is-v1-and-needs-no-host-port", () =>
        {
            IManualWorkHandler handler = new CheckInWorkHandler(null!, null!, null!, null!, null!);
            using var material = new CredentialMaterial("synthetic-Token", "manual"); var bytes = material.Encode(); var characters = Encoding.UTF8.GetChars(bytes);
            try
            {
                using var actual = new SecretDraft(characters); using var projected = handler.ProjectIdentity("kuro", actual);
                Assert(handler.IdentityVersion == "v1" && projected.ToString() == "[secret draft]");
                projected.Use(value => Assert(value.StartsWith("nexus.game-checkin.identity/1\nkuro\nraw\n")));
                actual.Use(value => Assert(value.SequenceEqual(characters)));
                try { JsonSerializer.Serialize(projected); throw new InvalidOperationException("identity_serialized"); } catch (NotSupportedException) { }
                projected.Dispose(); try { projected.Use(_ => { }); throw new InvalidOperationException("identity_not_cleared"); } catch (ObjectDisposedException) { }
            }
            finally { Array.Clear(bytes); Array.Clear(characters); }
            return Task.CompletedTask;
        });
        await run("actual-handler-long-cookie-projection-remains-bounded-without-json-escape-expansion", () =>
        {
            IManualWorkHandler handler = new CheckInWorkHandler(null!, null!, null!, null!, null!);
            using var material = new CredentialMaterial("cookie_token_v2=" + new string('+', 10000) + "; account_id_v2=123456", "manual");
            var bytes = material.Encode(); var text = Encoding.UTF8.GetChars(bytes);
            try { using var actual = new SecretDraft(text); using var projected = handler.ProjectIdentity("cn", actual); projected.Use(value => Assert(value.Length < 17000)); }
            finally { Array.Clear(bytes); Array.Clear(text); }
            return Task.CompletedTask;
        });
    }
}
