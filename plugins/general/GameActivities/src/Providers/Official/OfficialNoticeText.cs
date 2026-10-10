using AngleSharp.Dom;
using System.Text;
using System.Text.RegularExpressions;

namespace NexusPipeline.Plugin.GameActivities;

internal static class OfficialNoticeText
{
    private static readonly HashSet<string> Blocks = [
        "p", "div", "section", "article", "li", "ul", "ol",
        "h1", "h2", "h3", "h4", "h5", "h6", "tr", "blockquote"
    ];

    public static string Read(IElement content, CancellationToken ct = default)
    {
        var output = new StringBuilder();
        Append(content, output, ct);
        var lines = output.ToString().Split('\n')
            .Select(line => Regex.Replace(line, @"[\t \u00a0]+", " ").Trim())
            .Where(line => line.Length > 0);
        string text = string.Join('\n', lines);
        ct.ThrowIfCancellationRequested();
        return text;
    }

    private static void Append(INode node, StringBuilder output, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        if (node is IText text)
        {
            output.Append(text.Data);
            return;
        }
        if (node is not IElement element) return;
        if (element.LocalName is "script" or "style" or "nav" or "footer") return;
        if (element.LocalName is "del" or "s" or "strike" || Regex.IsMatch(element.GetAttribute("style") ?? "", @"text-decoration(?:-line)?\s*:[^;]*line-through", RegexOptions.IgnoreCase)) return;
        if (element.LocalName == "br")
        {
            output.Append('\n');
            return;
        }

        bool block = Blocks.Contains(element.LocalName);
        if (block) output.Append('\n');
        if (element.LocalName == "li") output.Append("• ");
        foreach (var child in element.ChildNodes) Append(child, output, ct);
        if (block) output.Append('\n');
    }
}
