using System.Text;
using NexusPipeline.Extensions.GameCheckIn;

internal static class HttpCases
{
    internal static void Run(Action<string, Action> run)
    {
        void Assert(bool value) { if (!value) throw new InvalidOperationException("assertion_failed"); }
        void Reject(Action action)
        { try { action(); } catch (CheckInFailure) { return; } throw new InvalidOperationException("expected_rejection"); }
        foreach (var (status, mime, body) in new[] { (403, "application/json", "{\"retcode\":0}"),
            (200, "text/html", "{\"retcode\":0}"), (200, "application/json", "{\"code\":0,\"code\":0}"),
            (200, "application/json", "not-json"), (200, "application/json", new string(' ', 262145)) })
            run($"bounded-http-reject/{status}/{mime}/{body.Length}", () =>
            {
                var bytes = "synthetic-body"u8.ToArray(); var headers = new Dictionary<string, string> { ["Cookie"] = "synthetic-sensitive-canary" };
                var request = new CheckInRequest(new("https://bbs-api-os.hoyolab.com/community/painter/wapi/user/full"), "GET", headers, bytes, null);
                var network = new FakeNetwork(new(status, mime, Encoding.UTF8.GetBytes(body)));
                Reject(() => CheckInHttp.ReadAsync(network, request, default).GetAwaiter().GetResult());
                Assert(headers.Count == 0 && bytes.All(value => value == 0));
            });
        foreach (var url in new[] { "http://bbs-api-os.hoyolab.com/a", "https://evil.test/a", "https://bbs-api-os.hoyolab.com:444/a", "https://user@bbs-api-os.hoyolab.com/a", "https://bbs-api-os.hoyolab.com/a#x" })
            run("exact-http-origin/" + url, () =>
            {
                var network = new FakeNetwork(new(200, "application/json", "{}"u8.ToArray()));
                Reject(() => CheckInHttp.ReadAsync(network, new(new(url), "GET", [], [], null), default).GetAwaiter().GetResult());
                Assert(network.Calls == 0);
            });
        run("valid-json-http-and-request-secret-release", () =>
        {
            var headers = new Dictionary<string, string> { ["Authorization"] = "synthetic-sensitive-canary" }; var bytes = "synthetic-body"u8.ToArray();
            var request = new CheckInRequest(new("https://bbs-api-os.hoyolab.com/community/painter/wapi/user/full"), "GET", headers, bytes, null);
            var network = new FakeNetwork(new(200, "Application/JSON; charset=utf-8", "{\"retcode\":-100}"u8.ToArray()));
            using var json = CheckInHttp.ReadAsync(network, request, default).GetAwaiter().GetResult();
            Assert(json.RootElement.GetProperty("retcode").GetInt32() == -100 && headers.Count == 0 && bytes.All(value => value == 0));
            Assert(!request.ToString().Contains("synthetic", StringComparison.Ordinal));
        });
        run("multi-role-partial-failure-never-becomes-whole-game-success", () =>
        {
            var result = CheckInResults.Aggregate("cn", "gi", [CheckInResults.Result("cn", "gi", "success", true, "confirmed"),
                CheckInResults.Result("cn", "gi", "success_unconfirmed", effectState: "unknown")]);
            Assert(!result.Success && result.EffectState == "unknown");
        });
    }
    private sealed class FakeNetwork(CheckInResponse response) : ICheckInNetwork
    {
        internal int Calls;
        public ValueTask<CheckInResponse> SendAsync(CheckInRequest request, CancellationToken cancellationToken)
        { Calls++; return ValueTask.FromResult(response); }
    }
}
