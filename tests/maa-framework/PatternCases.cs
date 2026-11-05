using System.Diagnostics;
using System.Text.Json.Nodes;
using NexusPipeline.Extensions.MaaFramework;

internal static class PatternCases
{
    internal static void Run(Action<string, Action> run)
    {
        static void Check(bool value) { if (!value) throw new InvalidOperationException("pattern_assertion_failed"); }
        static void Reject(Action action, string code)
        { try { action(); } catch (MaaInputFailure error) when (error.Code == code) { return; } throw new InvalidOperationException("pattern_rejection_expected"); }
        run("pi-official-normal-hard-pattern-uses-full-input-matching", () =>
        {
            MaaInputPattern.Declare("^(Normal|Hard)$");
            MaaInputValues.Verify("Normal", "^(Normal|Hard)$"); MaaInputValues.Verify("Hard", "^(Normal|Hard)$");
            Reject(() => MaaInputValues.Verify("prefix-Hard", "^(Normal|Hard)$"), "maa_input_verify_failed");
            MaaInputValues.Verify("ab", "a|ab");
            Reject(() => MaaInputValues.Verify("abc", "a|ab"), "maa_input_verify_failed");
        });
        run("protected-declaration-does-not-test-a-fictional-value-before-runtime-secret-resolution", () =>
        {
            const string expression = "^(?=.{8,64}$)(?=.*[A-Z])(?=.*\\d)[A-Za-z\\d]+$";
            var input = new JsonObject { ["name"] = "token", ["password"] = true, ["verify"] = expression };
            var key = MaaProtectedInput.Key("scope", "Credentials", "token");
            var fields = MaaInputValues.Read(new JsonObject { ["type"] = "input", ["inputs"] = new JsonArray(input) },
                new JsonObject { ["token"] = MaaProtectedInput.Binding(key) }, "Win32");
            var pipeline = new JsonObject { ["Node"] = new JsonObject { ["text"] = fields["token"]!.DeepClone() } };
            Check(MaaProtectedPipeline.Resolve(pipeline, _ => "Hard1234")["Node"]!["text"]!.GetValue<string>() == "Hard1234");
            Reject(() => MaaProtectedPipeline.Resolve(pipeline, _ => "1"), "maa_input_verify_failed");
        });
        run("regex-declaration-errors-and-unmapped-grammar-never-fall-back-to-accepting-input", () =>
        {
            Reject(() => MaaInputPattern.Declare("["), "maa_input_verify_invalid");
            Reject(() => MaaInputPattern.Declare(new string('a', 1025)), "maa_input_verify_too_large");
            Reject(() => MaaInputPattern.Declare("[[:alpha:]]"), "maa_input_verify_unsupported");
            Reject(() => MaaInputPattern.Declare("(?x)a # comment"), "maa_input_verify_unsupported");
            Reject(() => MaaInputValues.Verify(new string('a', 4097), ".*"), "maa_input_too_large");
        });
        run("regex-backtracking-budget-fails-without-returning-the-secret-or-engine-exception", () =>
        {
            var timer = Stopwatch.StartNew();
            Reject(() => MaaInputValues.Verify(new string('a', 4095) + "!", "^(a|aa)+$"), "maa_input_verify_timeout");
            Check(timer.Elapsed < TimeSpan.FromSeconds(2));
        });
    }
}
