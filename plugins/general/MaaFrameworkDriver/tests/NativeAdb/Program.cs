using System.Drawing;
using System.Drawing.Imaging;
using System.Text;
using System.Text.Json;

// A controlled subprocess transport for the real MaaAdbController. It never
// opens sockets or contacts a device; only this test's marker authorizes it.
string? root = Environment.GetEnvironmentVariable("NXP_MAA_FIXTURE_ROOT");
if (Environment.GetEnvironmentVariable("NXP_MAA_FIXTURE") != "owned-native-contract"
    || root is null || !File.Exists(Path.Combine(root, ".nxp-native-fixture"))) return 90;
string command = string.Join(" ", args);
File.AppendAllText(Path.Combine(root, "adb-commands.jsonl"), JsonSerializer.Serialize(args) + "\n", Encoding.UTF8);
if (args.Contains("devices")) { Console.WriteLine("List of devices attached\nnxp-owned-fixture\tdevice\n"); return 0; }
if (args.Contains("version")) { Console.WriteLine("Android Debug Bridge version 1.0.41"); return 0; }
if (args.Contains("get-state")) { Console.WriteLine("device"); return 0; }
if (args.Contains("start-server") || args.Contains("kill-server")) return 0;
if (args.LastOrDefault() == "cat")
{ using var input = Console.OpenStandardInput(); using var output = Console.OpenStandardOutput(); input.CopyTo(output); return 0; }
if (command.Contains("settings get secure android_id")) { Console.WriteLine("abc1234567890000"); return 0; }
if (command.Contains("displayId=")) { Console.WriteLine("0"); return 0; }
if (command.Contains("screencap", StringComparison.Ordinal) && command.Contains("-p", StringComparison.Ordinal))
{
    using var bitmap = new Bitmap(800, 600);
    using (var graphics = Graphics.FromImage(bitmap)) graphics.Clear(Color.DarkSlateBlue);
    using var output = Console.OpenStandardOutput(); bitmap.Save(output, ImageFormat.Png); return 0;
}
if (command.Contains("getprop", StringComparison.Ordinal))
{
    string value = command.Contains("ro.product.cpu.abi") ? "x86_64" : command.Contains("ro.build.version.sdk") ? "34"
        : command.Contains("ro.product.model") ? "NexusOwnedFixture" : command.Contains("ro.product.manufacturer") ? "NexusPipeline"
        : command.Contains("ro.build.version.release") ? "14"
        : command.EndsWith("getprop", StringComparison.Ordinal)
        ? "[ro.product.model]: [NexusOwnedFixture]\n[ro.product.manufacturer]: [NexusPipeline]\n[ro.product.cpu.abi]: [x86_64]\n[ro.build.version.sdk]: [34]"
        : "";
    Console.WriteLine(value); return 0;
}
if (command.Contains("wm size")) { Console.WriteLine("Physical size: 800x600"); return 0; }
if (command.Contains("input keyevent") || command.Contains("input tap") || command.Contains("input swipe")) return 0;
if (command.Contains("echo")) { Console.WriteLine("nxp-owned-fixture"); return 0; }
// Unsupported binary/touch transports fail so native auto detection must use
// the supported lossless PNG and adb-shell input path.
return 1;
