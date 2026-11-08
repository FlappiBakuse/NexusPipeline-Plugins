using System.Security.Cryptography;
using NexusPipeline.Extensibility.State;

internal sealed class TestImages(TestDocuments documents) : IExtensionImages
{
    internal readonly Dictionary<string, ExtensionImageContent> Assets = [];
    private readonly Dictionary<string, string[]> references = [];
    public ValueTask<IReadOnlyList<ExtensionImageInfo>> ListAsync(string name, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return ValueTask.FromResult<IReadOnlyList<ExtensionImageInfo>>((references.GetValueOrDefault(name) ?? []).Select(id => Assets[id].Info).ToArray());
    }
    public ValueTask<ExtensionImageContent> ReadAsync(string id, CancellationToken cancellationToken)
    { cancellationToken.ThrowIfCancellationRequested(); return ValueTask.FromResult(Assets[id]); }
    public async ValueTask<DocumentCommit> WriteAsync(Guid operation, string name, long expected, ReadOnlyMemory<byte> json,
        IReadOnlyList<string> ids, ExtensionImageInput? addition, CancellationToken cancellationToken)
    {
        Check.That(ids.Count <= 32 && ids.Distinct().Count() == ids.Count);
        var image = addition is null ? null : new ExtensionImageContent(new(Convert.ToHexStringLower(SHA256.HashData(addition.Content.Span)),
            addition.ContentType, addition.Content.Length, 1, 1), addition.Content.ToArray());
        Check.That(image is null || ids.Contains(image.Info.Id));
        Check.That(ids.All(id => Assets.ContainsKey(id) || id == image?.Info.Id));
        var commit = await ((IExtensionDocuments)documents).WriteAsync(operation, name, expected, json, cancellationToken);
        if (image is not null) Assets[image.Info.Id] = image;
        references[name] = ids.ToArray();
        foreach (var id in Assets.Keys.Where(id => !references.Values.Any(values => values.Contains(id))).ToArray()) Assets.Remove(id);
        return commit;
    }
}
