using System.Text.RegularExpressions;

namespace NexusPipeline.Extensions.MaaFramework;

internal static class MaaInputPattern
{
    internal static void Declare(string expression) => _ = Create(expression);

    internal static void Verify(string text, string expression)
    {
        if (text.Length > 4096) throw new MaaInputFailure("maa_input_too_large");
        var pattern = Create(expression);
        if (pattern is null) return;
        try
        {
            if (!pattern.IsMatch(text)) throw new MaaInputFailure("maa_input_verify_failed");
        }
        catch (RegexMatchTimeoutException) { throw new MaaInputFailure("maa_input_verify_timeout"); }
    }

    private static Regex? Create(string expression)
    {
        if (expression.Length == 0) return null;
        if (expression.Length > 1024) throw new MaaInputFailure("maa_input_verify_too_large");
        // Boost's POSIX classes and unscoped free-spacing comments do not share this engine's grammar.
        if (expression.Contains("[:", StringComparison.Ordinal) || Regex.IsMatch(expression, @"\(\?[a-zA-Z-]*x",
            RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100))) throw new MaaInputFailure("maa_input_verify_unsupported");
        try { return new Regex(@"\A(?:" + expression + @")\z", RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100)); }
        catch (ArgumentException) { throw new MaaInputFailure("maa_input_verify_invalid"); }
    }
}
