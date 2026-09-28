# MaaFramework C# bindings

The worker redistributes MaaFramework.Binding.dll and MaaFramework.Binding.Native.dll
from the official NuGet packages at version 5.10.0. Their LGPL-3.0 license is included
as MaaFramework.Binding.LGPL-3.0.md together with the referenced GPL-3.0.txt.

Corresponding source:
https://github.com/MaaXYZ/MaaFramework.Binding.CSharp/tree/27c69a5b8ff41b6002ead71f403a16f442a7168e

These assemblies are separate files in worker/. They are not embedded into a single
executable. You may replace them with compatible builds, including builds you modify,
and debug such modifications subject to the licenses of the other components. Build
the worker from worker/NexusPipeline.MaaWorker.csproj with an explicit NexusHostRoot.
The SDK input is separately pinned by the repository verification/candidate runner.

Project native engines are supplied by the explicitly selected project; the plugin
package does not redistribute a project or its native engine. Native test assets are
downloaded only by the repository verification runner according to native-tests.lock.json.
