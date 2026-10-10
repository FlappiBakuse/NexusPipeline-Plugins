using NexusPipeline.Plugin.Abstractions;
using System.Net;

namespace NexusPipeline.Plugin.GameActivities;

internal sealed class ActivityHttp(IPluginHttpClientFactory factory)
{
    private readonly SemaphoreSlim _requests = new(4, 4);
    public async Task<(byte[] Bytes, string? ETag, bool NotModified, string Mime, DateTimeOffset? LastModified)> ReadAsync(Uri uri, string? etag, int limit, CancellationToken ct,
        HttpMethod? method = null, IReadOnlyDictionary<string, string>? headers = null, DateTimeOffset? lastModified = null)
    {
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct);
        budget.CancelAfter(TimeSpan.FromSeconds(15));
        ct = budget.Token;
        await _requests.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            using var client = factory.CreateClient(uri, TimeSpan.FromSeconds(15), false);
            using var request = new HttpRequestMessage(method ?? HttpMethod.Get, uri);
            if (method == HttpMethod.Post) request.Content = new FormUrlEncodedContent([]);
            request.Headers.UserAgent.ParseAdd("NexusPipeline-GameActivities/0.1.0");
            if (headers is not null) foreach (var header in headers) request.Headers.TryAddWithoutValidation(header.Key, header.Value);
            if (etag is not null) request.Headers.TryAddWithoutValidation("If-None-Match", etag);
            else if (lastModified is not null) request.Headers.IfModifiedSince = lastModified;
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct).ConfigureAwait(false);
            if (response.StatusCode == HttpStatusCode.NotModified)
                return ([], response.Headers.ETag?.ToString() ?? etag, true, "", response.Content.Headers.LastModified ?? lastModified);
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
