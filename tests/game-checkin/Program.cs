using System.Text;
using System.Text.Json;
using NexusPipeline.Extensions.GameCheckIn;

var cases = new List<object>();
var failures = 0;
void Run(string name, Action body)
{
    try { body(); cases.Add(new { name, status = "PASS" }); }
    catch (Exception error) { failures++; cases.Add(new { name, status = "FAIL", error = error.ToString() }); }
}
void Assert(bool condition) { if (!condition) throw new InvalidOperationException("assertion_failed"); }
void Reject(Action action)
{ try { action(); } catch (Exception error) when (error is CheckInFailure or JsonException) { return; } throw new InvalidOperationException("expected_rejection"); }
Run("catalog-all-fourteen-region-game-pairs", () =>
{
    var expected = new[] { "cn/gi", "cn/hsr", "cn/zzz", "cn/bh3", "os/gi", "os/hsr", "os/zzz", "os/bh3",
        "skland/ak", "skland/endfield", "skport/endfield", "kuro/ww", "kuro/pgr", "tajiduo/nte" };
    Assert(CheckInCatalog.Platforms.SelectMany(platform => platform.Games.Select(game => platform.Id + "/" + game.Code))
        .Order(StringComparer.Ordinal).SequenceEqual(expected.Order(StringComparer.Ordinal)));
});
foreach (var platform in CheckInCatalog.Platforms)
foreach (var game in platform.Games)
    Run("task/" + platform.Id + "/" + game.Code, () =>
    {
        var task = new CheckInTask { Id = Guid.NewGuid(), Revision = 1, Name = "task", Games = new() { [platform.Id] = [game.Code] }, Notification = new() };
        Assert(task.Validate().Games[platform.Id].Single() == game.Code);
    });
Run("all-six-platforms-in-one-task", () => Assert(new CheckInTask { Id = Guid.NewGuid(), Revision = 1, Name = "task",
    Games = CheckInCatalog.Platforms.ToDictionary(platform => platform.Id, platform => platform.Games.Select(game => game.Code).ToArray()), Notification = new() }.Validate().Games.Count == 6));
Run("weekly-local-time-and-canonical-plan-identity", () =>
{
    var id = Guid.NewGuid(); var plan = new CheckInSchedule { Id = id.ToString("N"), Days = [6, 0], Enabled = true, Time = "23:59" }.Validate();
    Assert(plan.Id == id.ToString("D") && plan.LocalMinute == 1439 && plan.Days.SequenceEqual(new[] { 0, 6 }));
});
foreach (var time in new[] { "24:00", "9:00", "12:60", "", "09:00:00" })
    Run("schedule-reject/" + time, () => Reject(() => new CheckInSchedule { Id = Guid.NewGuid().ToString("D"), Days = [0], Time = time }.Validate()));
foreach (var body in new[] { "{}", "{\"retcode\":0,\"retcode\":0}", "{\"formatVersion\":2,\"tasks\":[]}",
    "{\"FormatVersion\":1,\"tasks\":[]}", "{\"formatVersion\":1,\"FormatVersion\":1,\"tasks\":[]}" })
    Run("saved-format-reject/" + body, () => Reject(() => CheckInJson.Read<CheckInTaskStore>(Encoding.UTF8.GetBytes(body)).Validate()));
foreach (var (body, expected) in new (string, string?)[] {
    ("{\"retcode\":0,\"data\":{\"risk_code\":0,\"is_risk\":false,\"gt\":\"\",\"challenge\":\"\"}}", null),
    ("{\"retcode\":0,\"data\":{\"gt_result\":{\"risk_code\":1,\"is_risk\":true,\"gt\":\"fixture\",\"challenge\":\"fixture\"}}}", "captcha_required"),
    ("{\"retcode\":0,\"data\":{\"is_risk\":true}}", "challenge_incomplete"),
    ("{\"retcode\":0,\"data\":{\"risk_code\":0,\"is_risk\":true}}", "verification_state_unknown"),
    ("{\"retcode\":0,\"data\":{\"gt\":null}}", "verification_state_unknown"),
    ("{\"retcode\":0,\"data\":{\"gt_result\":[]}}", "verification_state_unknown"),
    ("{\"retcode\":0,\"data\":{\"risk_code\":\"0\"}}", "verification_state_unknown"),
    ("{\"retcode\":0,\"data\":{\"gt\":\"fixture\",\"challenge\":\"fixture\"}}", "verification_state_unknown"),
    ("{\"retcode\":-100,\"message\":\"captcha\"}", "invalid_cookie"), ("{\"retcode\":-500}", "rate_limited"),
    ("{\"retcode\":-5003}", "success_unconfirmed") })
    Run("hoyo-risk/" + body, () => { using var document = CheckInJson.Parse(Encoding.UTF8.GetBytes(body)); Assert(HoyoResponses.Error(document.RootElement) == expected); });
foreach (var (body, expected) in new (string, bool?)[] {
    ("{\"data\":{\"is_sign\":true}}", true), ("{\"data\":{\"isSign\":false}}", false),
    ("{\"data\":{\"is_sign\":true,\"isSign\":false}}", null), ("{\"data\":{\"is_sign\":\"true\"}}", null), ("{}", null) })
    Run("hoyo-sign-state/" + body, () => { using var document = CheckInJson.Parse(Encoding.UTF8.GetBytes(body)); Assert(HoyoResponses.Signed(document.RootElement) == expected); });
Run("tajiduo-multi-role-never-guesses", () =>
{
    using var document = CheckInJson.Parse("{\"data\":{\"roles\":[{\"roleId\":\"123\"},{\"roleId\":\"456\"}]}}"u8.ToArray());
    Reject(() => CheckInRoles.Tajiduo(document.RootElement, null)); Assert(CheckInRoles.Tajiduo(document.RootElement, "456") == "456");
    Reject(() => CheckInRoles.Tajiduo(document.RootElement, "789"));
});
Run("kuro-roles-filter-game-and-reject-conflicting-account", () =>
{
    using var document = CheckInJson.Parse("{\"data\":[{\"gameId\":\"3\",\"roleId\":\"10\",\"serverId\":\"1\",\"userId\":\"11\"},{\"gameId\":\"2\",\"roleId\":\"20\",\"serverId\":\"1\",\"userId\":\"11\"}]}"u8.ToArray());
    Assert(CheckInRoles.Kuro(document.RootElement, "3").Single().RoleId == "10");
    using var conflict = CheckInJson.Parse("{\"data\":[{\"roleId\":\"10\",\"serverId\":\"1\",\"userId\":\"11\"},{\"roleId\":\"10\",\"serverId\":\"1\",\"userId\":\"12\"}]}"u8.ToArray());
    Reject(() => CheckInRoles.Kuro(conflict.RootElement, "3"));
});
Run("passport-endfield-role-server-header-identities", () =>
{
    using var document = CheckInJson.Parse("{\"data\":{\"list\":[{\"appCode\":\"endfield\",\"bindingList\":[{\"uid\":\"123\",\"roles\":[{\"roleId\":\"456\",\"serverId\":\"1\"}]}]}]}}"u8.ToArray());
    Assert(CheckInRoles.Passport(document.RootElement, true).Single() == new CheckInRole("456", "1", "123"));
    Assert(CheckInRoles.Passport(document.RootElement, false).Length == 0);
});
Run("login-origin-and-field-extraction-scopes", () =>
{
    Assert(LoginPolicies.Browser.Select(policy => policy.Platform).Order(StringComparer.Ordinal).SequenceEqual(new[] { "cn", "kuro", "os", "skland", "skport" }));
    Assert(LoginPolicies.For("skland").Storage.Single().Key == "SK_SHUMEI_DEVICE_ID_KEY");
    Assert(LoginPolicies.For("skport").JsonRequests.Single().Method == "GET" &&
        LoginPolicies.For("kuro").Storage.Select(rule => rule.Key).Order(StringComparer.Ordinal).SequenceEqual(new[] { "auth_token", "distinct_id" }));
    Assert(LoginPolicies.Browser.All(policy => policy.Origins.All(origin => new Uri(origin).Scheme == "https" && !origin.Contains('*'))));
    Reject(() => LoginPolicies.For("tajiduo"));
});
CredentialCases.Run(Run);
CaptureBoundaryCases.Run(Run);
PolicyCases.Run(Run);
HttpCases.Run(Run);
ClientCases.Run(Run);
TaskEditingCases.Run(Run);
DeviceAndLoginCases.Run(Run);
NativeSessionCases.Run(Run);
FrontendCases.Run(Run, Path.Combine(Path.GetDirectoryName(Path.GetFullPath(args[0]))!, "view-model.json"));
RunnerCases.Run(Run);
IdentityCases.Run(Run);
CancellationCases.Run(Run);
CredentialIdentityCases.Run(Run);
CredentialRotationCases.Run(Run);
Run("all-fourteen-notification-lines-preserve-unknown-without-raw-server-message", () =>
{
    var task = new CheckInTask { Id = Guid.NewGuid(), Revision = 1, Name = "task",
        Games = CheckInCatalog.Platforms.ToDictionary(platform => platform.Id, platform => platform.Games.Select(game => game.Code).ToArray()) };
    var results = CheckInCatalog.Platforms.SelectMany(platform => platform.Games.Select(game => new CheckInGameResult(platform.Id, game.Code,
        "success_unconfirmed", "synthetic-sensitive-server-response", false, "unknown"))).ToArray();
    var started = DateTimeOffset.UtcNow; var run = new CheckInRun(Guid.NewGuid().ToString("D"), "manual", "unknown", started, started, results, Guid.NewGuid().ToString("D"), 1);
    var summary = CheckInSummary.Create(task, run);
    Assert(summary.Title.Contains("结果未知", StringComparison.Ordinal) && summary.Body.Length < 4000);
    foreach (var platform in CheckInCatalog.Platforms)
    foreach (var game in platform.Games)
        Assert(summary.Body.Split('\n').Any(line => line.Contains(platform.Name + " / " + game.Name, StringComparison.Ordinal) && line.Contains("结果未知", StringComparison.Ordinal)));
    Assert(!summary.Body.Contains("synthetic-sensitive-server-response", StringComparison.Ordinal));
});
Run("notification-summary-rejects-unfinished-stale-or-incomplete-results", () =>
{
    var task = new CheckInTask { Id = Guid.NewGuid(), Revision = 1, Name = "task", Games = new() { ["kuro"] = ["ww"] } };
    var started = DateTimeOffset.UtcNow; var run = new CheckInRun(Guid.NewGuid().ToString("D"), "manual", "failed", started, started,
        [CheckInResults.Result("kuro", "ww", "credential_not_configured")], Guid.NewGuid().ToString("D"), 1);
    Reject(() => CheckInSummary.Create(task, run with { Status = "running", CompletedAt = null }));
    Reject(() => CheckInSummary.Create(task, run with { TaskRevision = 2 }));
    Reject(() => CheckInSummary.Create(task, run with { Results = [] }));
});
foreach (var id in new[] { "smtp", Guid.Empty.ToString("D"), "abcdef012345456789ababcdef012345", "ABCDEF01-2345-4567-89AB-ABCDEF012345" })
    Run("notification-target-rejects-noncanonical-host-identity/" + id, () => Reject(() => new CheckInNotification { NotificationTaskIds = [id] }.Validate()));
Run("persisted-result-requires-explicit-success-and-effect-state", () =>
{
    foreach (var body in new[] {
        "{\"platform\":\"kuro\",\"gameCode\":\"ww\",\"code\":\"failed\",\"message\":\"fixture\",\"effectState\":\"notSubmitted\"}",
        "{\"platform\":\"kuro\",\"gameCode\":\"ww\",\"code\":\"failed\",\"message\":\"fixture\",\"success\":false}" })
        Reject(() => CheckInJson.Read<CheckInGameResult>(Encoding.UTF8.GetBytes(body)));
});
await File.WriteAllBytesAsync(args[0], JsonSerializer.SerializeToUtf8Bytes(cases, new JsonSerializerOptions { WriteIndented = true }));
Console.WriteLine($"{cases.Count} cases, {failures} failed");
return cases.Count > 0 && failures == 0 ? 0 : 1;
