using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.HoyoLabCheckIn;

internal sealed class HoyoLabClient
{
    private const string Origin = "https://act.hoyolab.com";
    private const string UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    private readonly IPluginHttpClientFactory _http;

    public HoyoLabClient(IPluginHttpClientFactory http)
    {
        _http = http;
    }

    public async Task<CheckInResult> SignAsync(
        GameDefinition game,
        string cookie,
        CancellationToken cancellationToken)
    {
        try
        {
            using HttpClient client = _http.CreateClient(game.Endpoint, TimeSpan.FromSeconds(30));
            using var request = new HttpRequestMessage(HttpMethod.Post, game.Endpoint)
            {
                Content = new StringContent(
                    JsonSerializer.Serialize(new { lang = "en-us", act_id = game.ActId }),
                    Encoding.UTF8,
                    "application/json"),
            };
            request.Headers.Accept.Clear();
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            request.Headers.TryAddWithoutValidation("Origin", Origin);
            request.Headers.TryAddWithoutValidation("Referer", Origin + "/");
            request.Headers.TryAddWithoutValidation("Cookie", cookie);
            request.Headers.TryAddWithoutValidation("x-rpc-signgame", game.SignGame);
            request.Headers.UserAgent.ParseAdd(UserAgent);

            using HttpResponseMessage response = await client.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                return TransportError(game.Code);
            }

            await using Stream stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
            using JsonDocument document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken).ConfigureAwait(false);
            if (!document.RootElement.TryGetProperty("retcode", out JsonElement retcodeElement)
                || !retcodeElement.TryGetInt32(out int retcode))
            {
                return TransportError(game.Code);
            }
            return retcode switch
            {
                0 => new CheckInResult(game.Code, "success", "签到成功", true),
                -5003 => new CheckInResult(game.Code, "already", "今日已签到", true),
                -100 => new CheckInResult(game.Code, "invalid_cookie", "Cookie 无效或未登录", false),
                -10002 => new CheckInResult(game.Code, "game_not_available", "当前游戏暂不可签到", false),
                _ => new CheckInResult(game.Code, "api_error", "接口返回未知错误", false),
            };
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return TransportError(game.Code);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (HttpRequestException)
        {
            return TransportError(game.Code);
        }
        catch (JsonException)
        {
            return TransportError(game.Code);
        }
        catch (InvalidOperationException)
        {
            return TransportError(game.Code);
        }
        catch (Exception)
        {
            return TransportError(game.Code);
        }
    }

    private static CheckInResult TransportError(string gameCode) =>
        new(gameCode, "transport_error", "请求失败或响应格式无效", false);
}
