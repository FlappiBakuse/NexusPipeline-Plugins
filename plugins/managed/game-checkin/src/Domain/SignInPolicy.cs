namespace NexusPipeline.Extensions.GameCheckIn;

internal sealed record SignInDecision(string Action, string Code, bool IsSuccess = false, string EffectState = "notSubmitted");
internal static class SignInPolicy
{
    internal static SignInDecision BeforeSubmission(string effectState, bool? todaySigned, string? responseError, bool firstBind = false)
    {
        if (effectState == "confirmed") return new("finish", "already", true, "confirmed");
        if (effectState is not ("new" or "unknown")) return new("finish", "effect_unavailable");
        if (responseError is not null) return new("finish", responseError, EffectState: effectState == "unknown" ? "unknown" : "notSubmitted");
        if (todaySigned == true) return new("recordReadonlyConfirmation", "already", true, "confirmed");
        if (effectState == "unknown") return new("finish", "effect_unknown", EffectState: "unknown");
        if (firstBind) return new("finish", "first_bind");
        return todaySigned == false ? new("requestHostSubmissionPermit", "not_signed") : new("finish", "verification_state_unknown");
    }
    internal static SignInDecision AfterSubmission(bool? verifiedSigned, string? confirmationError) =>
        verifiedSigned == true && confirmationError is null ? new("recordConfirmation", "success", true, "confirmed") :
            new("finish", "success_unconfirmed", EffectState: "unknown");
    internal static SignInDecision TajiduoNext(string phase, bool refreshPersisted, int roleCount, bool roleSelected, bool? todaySigned)
    {
        if (phase == "refreshReceived") return new("requestAtomicRefreshPersistence", "refresh_pending");
        if (!refreshPersisted) return new("finish", "credential_refresh_not_persisted");
        if (phase == "refreshPersisted") return new("readRoles", "roles_pending");
        if (roleCount == 0) return new("finish", "no_role");
        if (roleCount > 1 && !roleSelected) return new("finish", "role_selection_required");
        return phase switch {
            "rolesResolved" => new("readTodayState", "state_pending"),
            "stateRead" => BeforeSubmission("new", todaySigned, null),
            "submitted" => AfterSubmission(todaySigned, null),
            _ => new("finish", "verification_state_unknown") };
    }
}
