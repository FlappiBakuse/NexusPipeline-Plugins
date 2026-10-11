using NexusPipeline.Plugin.Abstractions;
using System.Net;

namespace NexusPipeline.Plugin.GameActivities;

internal sealed class ActivityHttp(IPluginHttpClientFactory factory)
{
    private readonly SemaphoreSlim _requests = new(4, 4);
    public async Task<(byte[] Bytes, string? ETag, bool NotModified, string Mime, DateTimeOffset? LastModified)> ReadAsync(Uri uri, string? etag, int limit, CancellationToken ct,
        DateTimeOffset? lastModified = null)
    {
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct);
        await _requests.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            budget.CancelAfter(TimeSpan.FromSeconds(15));
            ct = budget.Token;
            using var client = factory.CreateClient(uri, TimeSpan.FromSeconds(15), false);
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.UserAgent.ParseAdd("NexusPipeline-GameActivities/0.1.0");
            if (etag is not null) request.Headers.TryAddWithoutValidation("If-None-Match", etag);
            else if (lastModified is not null) request.Headers.IfModifiedSince = lastModified;
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct).ConfigureAwait(false);
            if (response.StatusCode == HttpStatusCode.NotModified)
            {
                if (etag is null && lastModified is null) throw new ActivityException("unexpected_not_modified", 502);
                return ([], response.Headers.ETag?.ToString() ?? etag, true, "", response.Content.Headers.LastModified ?? lastModified);
            }
            if ((int)response.StatusCode == 429) throw new ActivityException("source_rate_limited", 429, response.Headers.RetryAfter?.Date ?? (response.Headers.RetryAfter?.Delta is { } delay ? DateTimeOffset.UtcNow + delay : null));
            response.EnsureSuccessStatusCode();
            if (response.Content.Headers.ContentLength > limit) throw new ActivityException("response_too_large", 502);
            using var stream = await response.Content.ReadAsStreamAsync(ct).ConfigureAwait(false);
            using var output = new MemoryStream();
            byte[] buffer = new byte[16384];
            while (true)
            {
                int count = await stream.ReadAsync(buffer, ct).ConfigureAwait(false);
                if (count == 0) break;
                if (output.Length + count > limit) throw new ActivityException("response_too_large", 502);
                output.Write(buffer, 0, count);
            }
            return (output.ToArray(), response.Headers.ETag?.ToString(), false, response.Content.Headers.ContentType?.MediaType ?? "", response.Content.Headers.LastModified);
        }
        finally { _requests.Release(); }
    }
}
