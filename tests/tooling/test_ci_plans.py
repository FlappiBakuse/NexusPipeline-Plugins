"""Select Plugins CI inputs through its actual production policy."""
from unittest.mock import patch
import importlib
import json

from ci_fixture import GitFixture, PLUGINS, production_tools


class PluginCiPlanTests(GitFixture):
    def test_rejects_host_role(self):
        with production_tools(PLUGINS) as owner, self.assertRaisesRegex(ValueError, "only the plugins"):
            owner.ci_plan.make_plan(self.repo, "host", None, None, None, local=True)

    def test_declared_native_package(self):
        output = self.scope / "assembly"
        (output / "sdk").mkdir(parents=True)
        (output / "sdk/sdk-consumers-current.json").write_text(json.dumps({"receipt": "sdk-receipt"}), encoding="utf-8")
        events = []
        self.write('tooling/build-policy.json', json.dumps({'bundledExtensions': ['native-plugin', 'plain-plugin']}).encode())
        self.write('plugins/managed/native-plugin/extension.json', json.dumps({'extensionId': 'native-plugin',
                   'managed': {'nativeLibraries': ['runtime/win-x64/fixture.dll']}}).encode())
        self.write('plugins/managed/plain-plugin/extension.json', json.dumps({'extensionId': 'plain-plugin'}).encode())
        def python(label, root, script, *arguments):
            events.append((label, script, arguments))
            if label == 'plugin-declarations':
                return json.dumps(importlib.import_module('build_inputs').declarations(root))
            if label.endswith("-native"):
                return json.dumps({"receipt": "native-receipt"})
            return json.dumps({"receipt": "compiled-receipt"})
        with production_tools(PLUGINS) as owner:
            owner.ci_build.package_plugins(python, None, self.repo, self.repo, self.scope / "build", output,
                                          ["native-plugin", "plain-plugin"], {})
        self.assertIn(("native-plugin-native", "tooling/build_inputs.py",
                       ("--extension", "native-plugin", "--output", output / "binary-inputs/native-plugin")), events)
        packaged = next(arguments for label, _, arguments in events if label == "native-plugin-package")
        self.assertEqual("native-receipt", packaged[packaged.index("--runtime-receipt") + 1])
        plain = next(arguments for label, _, arguments in events if label == 'plain-plugin-package')
        self.assertNotIn('--runtime-receipt', plain)
        self.assertFalse(any(label == 'plain-plugin-native' for label, _, _ in events))

    def declarations(self):
        for name, kind, frontend in (("live-screenshot", "managed", True), ("game-checkin", "managed", True),
                                     ("emulator-support", "managed", False), ("maa-framework", "managed", True),
                                     ("maaend", "specialized", False), ("maas", "specialized", False)):
            self.write(f"plugins/{kind}/{name}/extension.json", json.dumps({
                "extensionId": name, "frontend": {} if frontend else None,
                "specialized": {} if name in {"maa-framework", "maaend", "maas"} else None}).encode())


    def test_selects_plugins(self):
        self.declarations()
        for root in (PLUGINS,):
            with self.subTest(repository=root.name), production_tools(root) as owner:
                scope = lambda path: owner.ci_plan.plugin_scope(self.repo, [path])["extensions"]
                self.assertEqual([], scope("docs/a.md"))
                self.assertEqual(["maaend"], scope("plugins/specialized/maaend/README.md"))
                self.assertEqual(["live-screenshot"], scope("plugins/managed/live-screenshot/src/Main.cs"))
                self.assertEqual(["game-checkin", "live-screenshot", "maa-framework"],
                                 scope("plugins/managed/frontend-ui/src/a.ts"))
                self.assertEqual(["maa-framework", "maaend", "maas"], scope("adapter-runtime/core/a.js"))
                self.assertEqual(["emulator-support", "game-checkin", "live-screenshot", "maa-framework", "maaend", "maas"],
                                 scope("unknown.json"))


    def test_protects_publisher(self):
        self.declarations()
        base = self.commit()
        protected = ["catalog.json", "metadata/catalog/stable.json", "metadata/releases/stable-state.json", "packages/Alpha/Alpha-0.1.0.zip"]
        for path in protected:
            self.write(path, b"{}\n")
        head = self.commit()
        for root in (PLUGINS,):
            with self.subTest(repository=root.name), production_tools(root) as owner:
                real_git = owner.ci_plan.git

                def fixed(repository, *arguments):
                    return (head + "\trefs/heads/develop\n").encode() if arguments[0] == "ls-remote" else real_git(repository, *arguments)

                with patch.object(owner.ci_plan, "git", side_effect=fixed):
                    plan = owner.ci_plan.make_plan(self.repo, "plugins", base, head, head)
                self.assertEqual(protected, plan["forbiddenChanges"])
                with self.assertRaises(ValueError):
                    owner.ci_plan.verify_plan(self.repo, plan)
                plan["forbiddenChanges"] = []
                with self.assertRaises(ValueError):
                    owner.ci_plan.verify_plan(self.repo, plan)
