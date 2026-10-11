using NexusPipeline.Plugin.Abstractions;

namespace NexusPipeline.Plugin.GameCheckIn.BrowserLogin;

internal static class LoginPageBootstrap
{
    internal static PluginBrowserPageBootstrap For(string platform, string startUri)
    {
        var uri = new Uri(startUri);
        string resource = platform == "cn" ? "miyoushe" : platform;
        using var stream = typeof(LoginPageBootstrap).Assembly.GetManifestResourceStream(
            $"NexusPipeline.Plugin.GameCheckIn.BrowserLogin.PageScripts.{resource}.js")
            ?? throw new InvalidOperationException("browser_bootstrap_missing");
        using var reader = new StreamReader(stream);
        return new(uri.GetLeftPart(UriPartial.Authority), uri.AbsolutePath, reader.ReadToEnd());
    }
}
