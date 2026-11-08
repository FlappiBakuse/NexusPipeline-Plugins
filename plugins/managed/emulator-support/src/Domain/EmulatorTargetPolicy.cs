namespace NexusPipeline.Extensions.EmulatorSupport;

internal static class EmulatorTargetPolicy
{
    internal static EmulatorTargetDescription Describe(EmulatorTarget target)
    {
        var installation = target.Installation;
        var instance = target.Instance;
        var locations = new List<EmulatorInstanceLocation>();
        if (installation.Vendor == EmulatorVendors.LdPlayer && instance.Index is { } index)
            locations.Add(new(null, "vms/leidian" + index));
        foreach (var config in installation.Configurations.Where(item => instance.ConfigIds.Contains(item.Id)))
        {
            var directory = Path.GetDirectoryName(config.RelativePath)?.Replace('\\', '/');
            if (installation.Vendor == EmulatorVendors.Nox && directory?.Split('/').Last() == instance.Identity)
                locations.Add(new(config.Id, "."));
            if (installation.Vendor == EmulatorVendors.BlueStacks)
                locations.Add(new(config.Id, "Engine/" + instance.Identity));
        }
        return new(locations, Command(false), installation.Vendor == EmulatorVendors.BlueStacks ? null : Command(true));

        EmulatorCommand Command(bool quit)
        {
            if (installation.Vendor == EmulatorVendors.LdPlayer && instance.Index is >= 0)
                return new(installation.Control.Id, [quit ? "quit" : "launch", "--index", instance.Index.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)]);
            if (installation.Vendor == EmulatorVendors.Nox && (instance.Index is >= 0 || instance.ControlName is { } name && Selector(name)))
                return new(installation.Control.Id, [quit ? "quit" : "launch", instance.Index is { } number ? "-index:" + number.ToString(System.Globalization.CultureInfo.InvariantCulture) : "-name:" + instance.ControlName]);
            if (installation.Vendor == EmulatorVendors.BlueStacks && !quit && Selector(instance.Identity))
                return new(installation.Control.Id, ["--instance", instance.Identity], true);
            throw new EmulatorException("emulator_target_source_unbound");
        }
    }
    private static bool Selector(string value) => value.Length is > 0 and <= 128 &&
        value.All(character => char.IsLetterOrDigit(character) || character is ' ' or '_' or '-' or '.');
}
