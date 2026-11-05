namespace NexusPipeline.Extensions.MaaFramework;

internal sealed class MaaBusinessFailure(string code) : MaaInputFailure(code);
internal sealed record MaaCompilationDiagnostic(string Code, string Stage, string? Detail);
internal sealed class MaaCompilationPolicy(bool readOnly = false)
{
    private readonly List<MaaCompilationDiagnostic> blocking = [];
    internal MaaCompilationDiagnostic[] Diagnostics => blocking.ToArray();
    internal void RevalidateProfile() => blocking.RemoveAll(issue => issue.Code is "maa_enabled_task_unmapped" or "maa_controller_not_supported");
    internal void Block(string code, string stage = "import")
    {
        if (!readOnly) throw new MaaBusinessFailure(code);
        var split = code.IndexOf(':');
        var issue = new MaaCompilationDiagnostic(split < 0 ? code : code[..split], stage, split < 0 ? null : code[(split + 1)..]);
        if (issue.Code.Length is < 1 or > 120 || issue.Detail?.Length > 4096) throw new MaaInputFailure("maa_diagnostic_invalid");
        if (!blocking.Contains(issue)) blocking.Add(issue);
        if (blocking.Count > 256) throw new MaaInputFailure("maa_diagnostic_budget");
    }
}
internal sealed record MaaCompilationState(MaaPiProject Project, MaaImportedProfile Profile, MaaSemanticPlan? Semantic,
    MaaCompilationDiagnostic[] Diagnostics);
