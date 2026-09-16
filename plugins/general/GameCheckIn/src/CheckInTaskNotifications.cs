using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using MailKit.Security;
using MimeKit;
using NexusPipeline.Plugin.Abstractions;
using MailKitSmtpClient = MailKit.Net.Smtp.SmtpClient;

namespace NexusPipeline.Plugin.GameCheckIn;

internal interface ICheckInSmtpTransport : IDisposable
{
    int Timeout { set; }
    Task ConnectAsync(string host, int port, SecureSocketOptions options, CancellationToken cancellationToken);
    Task AuthenticateAsync(string user, string password, CancellationToken cancellationToken);
    Task SendAsync(MimeMessage message, CancellationToken cancellationToken);
    Task DisconnectAsync(bool quit, CancellationToken cancellationToken);
}

internal interface ICheckInSmtpTransportFactory
{
    ICheckInSmtpTransport Create();
}

internal sealed class MailKitCheckInSmtpTransportFactory : ICheckInSmtpTransportFactory
{
    public ICheckInSmtpTransport Create() => new MailKitCheckInSmtpTransport();
}

internal sealed class MailKitCheckInSmtpTransport : ICheckInSmtpTransport
{
    private readonly MailKitSmtpClient _client = new();

    public int Timeout { set => _client.Timeout = value; }
    public Task ConnectAsync(string host, int port, SecureSocketOptions options, CancellationToken cancellationToken) =>
        _client.ConnectAsync(host, port, options, cancellationToken);
    public Task AuthenticateAsync(string user, string password, CancellationToken cancellationToken) =>
        _client.AuthenticateAsync(user, password, cancellationToken);
    public Task SendAsync(MimeMessage message, CancellationToken cancellationToken) => _client.SendAsync(message, cancellationToken);
    public Task DisconnectAsync(bool quit, CancellationToken cancellationToken) => _client.DisconnectAsync(quit, cancellationToken);
    public void Dispose() => _client.Dispose();
}

internal sealed class CheckInTaskNotifications
{
    private static readonly HashSet<string> WebhookTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "generic", "feishu", "dingtalk", "wecom", "discord", "slack",
    };

    private readonly IPluginHostContextV1_4 _context;
    private readonly ICheckInSmtpTransportFactory _smtpFactory;

    public CheckInTaskNotifications(
        IPluginHostContextV1_4 context,
        ICheckInSmtpTransportFactory? smtpFactory = null)
    {
        _context = context;
        _smtpFactory = smtpFactory ?? new MailKitCheckInSmtpTransportFactory();
    }

    internal static IReadOnlySet<string> SupportedWebhookTypes => WebhookTypes;

    public async Task SendAsync(
        Guid taskId,
        string title,
        string body,
        CheckInNotificationSettings settings,
        CancellationToken cancellationToken)
    {
        if (settings.Webhook.Enabled)
        {
            try
            {
                string? url = await GetSecretAsync(taskId, "webhook-url", cancellationToken).ConfigureAwait(false);
                string? secret = await GetSecretAsync(taskId, "webhook-signing-secret", cancellationToken).ConfigureAwait(false);
                await SendWebhookAsync(settings.Webhook, url, secret, $"{title}\n{body}", cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch
            {
                _context.Logger.Warn("签到任务 Webhook 通知发送失败；签到结果已保留。");
            }
        }

        if (settings.Smtp.Enabled)
        {
            try
            {
                string? user = await GetSecretAsync(taskId, "smtp-user", cancellationToken).ConfigureAwait(false);
                string? password = await GetSecretAsync(taskId, "smtp-password", cancellationToken).ConfigureAwait(false);
                await SendSmtpAsync(settings.Smtp, user, password, $"{title}\n{body}", cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch
            {
                _context.Logger.Warn("签到任务 SMTP 通知发送失败；签到结果已保留。");
            }
        }
    }

    private ValueTask<string?> GetSecretAsync(Guid taskId, string name, CancellationToken cancellationToken) =>
        _context.Secrets.GetAsync(SecretKey(taskId, name), cancellationToken);

    internal static string SecretKey(Guid taskId, string name) => $"tasks-v1/{taskId:N}/{name}";

    private async Task SendWebhookAsync(
        CheckInWebhookSettings settings,
        string? url,
        string? signingSecret,
        string text,
        CancellationToken cancellationToken)
    {
        string type = settings.Type.ToLowerInvariant();
        if (!WebhookTypes.Contains(type)
            || !Uri.TryCreate(url, UriKind.Absolute, out Uri? destination)
            || destination.Scheme is not ("http" or "https"))
        {
            throw new InvalidOperationException("Webhook target is unavailable");
        }

        string body = BuildWebhookBody(type, text, settings.Template);
        if (type == "feishu" && !string.IsNullOrWhiteSpace(signingSecret))
        {
            body = BuildSignedFeishuBody(body, signingSecret);
        }
        if (type == "dingtalk" && !string.IsNullOrWhiteSpace(signingSecret))
        {
            destination = AddDingTalkSignature(destination, signingSecret);
        }

        using HttpClient client = _context.Http.CreateClient(destination, TimeSpan.FromSeconds(15));
        using var request = new HttpRequestMessage(HttpMethod.Post, destination)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        using HttpResponseMessage response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
        string responseText = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode || !IsWebhookResponseSuccessful(type, responseText))
        {
            throw new InvalidOperationException("Webhook provider returned a failure");
        }
    }

    internal static string BuildWebhookBody(string type, string text, string template)
    {
        string literal = JsonSerializer.Serialize(text);
        return type switch
        {
            "dingtalk" or "wecom" => $"{{\"msgtype\":\"text\",\"text\":{{\"content\":{literal}}}}}",
            "slack" => $"{{\"text\":{literal}}}",
            "discord" => $"{{\"content\":{literal}}}",
            "generic" => template.Replace("{text}", literal, StringComparison.Ordinal),
            _ => $"{{\"msg_type\":\"text\",\"content\":{{\"text\":{literal}}}}}",
        };
    }

    internal static bool IsWebhookResponseSuccessful(string type, string responseText)
    {
        if (string.IsNullOrWhiteSpace(responseText)) return true;
        if (type == "generic") return true;
        if (type == "slack") return string.Equals(responseText.Trim(), "ok", StringComparison.Ordinal);
        try
        {
            JsonNode? response = JsonNode.Parse(responseText);
            if (type == "feishu")
            {
                JsonNode? code = response?["code"];
                JsonNode? statusCode = response?["StatusCode"];
                return (code is null || ReadInt(code, -1) == 0)
                    && (statusCode is null || ReadInt(statusCode, -1) == 0);
            }
            if (type == "dingtalk")
            {
                JsonNode? code = response?["code"];
                JsonNode? errorCode = response?["errcode"];
                JsonNode? success = response?["success"];
                return (code is null || ReadInt(code, 0) == 0)
                    && (errorCode is null || ReadInt(errorCode, 0) == 0)
                    && (success is null || ReadBool(success));
            }
            if (type == "wecom") return ReadInt(response?["errcode"], 0) == 0;
            return true;
        }
        catch
        {
            return false;
        }
    }

    internal static Uri AddDingTalkSignature(Uri destination, string secret)
    {
        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture);
        string sign = Uri.EscapeDataString(SignDingTalk(timestamp, secret));
        string query = destination.Query.TrimStart('?');
        string next = string.IsNullOrWhiteSpace(query)
            ? $"timestamp={timestamp}&sign={sign}"
            : $"{query}&timestamp={timestamp}&sign={sign}";
        var builder = new UriBuilder(destination) { Query = next };
        return builder.Uri;
    }

    internal static string BuildSignedFeishuBody(string body, string secret)
    {
        if (JsonNode.Parse(body) is not JsonObject root) return body;
        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        root["timestamp"] = timestamp;
        root["sign"] = SignFeishu(timestamp, secret);
        return root.ToJsonString();
    }

    internal static string SignDingTalk(string timestamp, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        byte[] digest = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{timestamp}\n{secret}"));
        return Convert.ToBase64String(digest);
    }

    internal static string SignFeishu(string timestamp, string secret)
    {
        byte[] key = Encoding.UTF8.GetBytes($"{timestamp}\n{secret}");
        using var hmac = new HMACSHA256(key);
        return Convert.ToBase64String(hmac.ComputeHash(Array.Empty<byte>()));
    }

    private async Task SendSmtpAsync(
        CheckInSmtpSettings settings,
        string? user,
        string? password,
        string text,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(settings.Host)
            || string.IsNullOrWhiteSpace(user)
            || string.IsNullOrWhiteSpace(password)
            || string.IsNullOrWhiteSpace(settings.To))
        {
            throw new InvalidOperationException("SMTP settings are incomplete");
        }

        string[] recipients = SplitRecipients(settings.To);
        if (recipients.Length == 0) throw new InvalidOperationException("SMTP recipients are empty");
        string from = string.IsNullOrWhiteSpace(settings.From) ? user : settings.From;
        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(from));
        foreach (string recipient in recipients) message.To.Add(MailboxAddress.Parse(recipient));
        string firstLine = text.Split('\n').FirstOrDefault()?.Trim('\r') ?? "";
        message.Subject = $"{settings.SubjectPrefix} {(string.IsNullOrWhiteSpace(firstLine) ? "NexusPipeline Check-in" : firstLine)}";
        message.Body = new TextPart("plain") { Text = text };

        int port = settings.Port is >= 1 and <= 65535 ? settings.Port : 465;
        int timeout = 15000;
        using ICheckInSmtpTransport client = _smtpFactory.Create();
        client.Timeout = timeout;
        await client.ConnectAsync(settings.Host, port, ResolveSecure(port, settings.Secure), cancellationToken).ConfigureAwait(false);
        await client.AuthenticateAsync(user, password, cancellationToken).ConfigureAwait(false);
        await client.SendAsync(message, cancellationToken).ConfigureAwait(false);
        await client.DisconnectAsync(true, cancellationToken).ConfigureAwait(false);
    }

    internal static string[] SplitRecipients(string value) => value
        .Split(new[] { ',', '，', ';', '；', ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    internal static SecureSocketOptions ResolveSecure(int port, string mode) => mode switch
    {
        "none" => SecureSocketOptions.None,
        "ssl" => SecureSocketOptions.SslOnConnect,
        "starttls" => SecureSocketOptions.StartTlsWhenAvailable,
        _ => port switch
        {
            465 => SecureSocketOptions.SslOnConnect,
            587 => SecureSocketOptions.StartTlsWhenAvailable,
            _ => SecureSocketOptions.Auto,
        },
    };

    private static int ReadInt(JsonNode? node, int fallback)
    {
        if (node is null) return fallback;
        try { return node.GetValue<int>(); }
        catch { return int.TryParse(node.ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out int value) ? value : fallback; }
    }

    private static bool ReadBool(JsonNode node)
    {
        try { return node.GetValue<bool>(); }
        catch { return bool.TryParse(node.ToString(), out bool value) && value; }
    }
}
