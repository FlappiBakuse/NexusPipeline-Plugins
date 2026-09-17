import unittest

from tools.change_classifier import (
    FRONTEND,
    MANAGED,
    PACKAGE,
    SOURCE,
    classify_path,
    classify_paths,
    normalize_path,
    parse_name_status_z,
    plugin_relative,
)


class ChangeClassifierTests(unittest.TestCase):
    def assert_gates(self, path, *expected):
        self.assertEqual(classify_path(path), frozenset(expected))

    def test_plugin_manifest_and_frontend_sources_expand_the_right_gates(self):
        self.assert_gates("plugins/general/CustomWallpaper/plugin.json", SOURCE, FRONTEND, PACKAGE)
        self.assert_gates("plugins/general/CustomWallpaper/frontend/src/App.vue", FRONTEND, PACKAGE)
        self.assert_gates("plugins/general/CustomWallpaper/data/config.js", SOURCE, FRONTEND, PACKAGE)
        self.assert_gates("plugins/general/CustomWallpaper/i18n/zh-CN.json", SOURCE, PACKAGE)

    def test_managed_and_package_shared_inputs_expand_consumers(self):
        self.assert_gates("plugins/specialized/Example/src/Example.cs", MANAGED, PACKAGE)
        self.assert_gates("plugins/general/Example/tests/ExampleTests.cs", MANAGED, PACKAGE)
        self.assert_gates("plugins/general/Example/Example.csproj", MANAGED, PACKAGE)
        self.assert_gates("tools/PluginTestKit/loader.py", SOURCE, MANAGED, PACKAGE)
        self.assert_gates("tools/Test-FrontendPlugins.mjs", SOURCE, FRONTEND, PACKAGE)
        self.assert_gates("host.lock.json", SOURCE, MANAGED, PACKAGE)

    def test_root_package_inputs_and_unknown_paths_are_conservative(self):
        self.assert_gates("package.json", FRONTEND, PACKAGE)
        self.assert_gates("package-lock.json", FRONTEND, PACKAGE)
        self.assert_gates("catalog.json", SOURCE, PACKAGE)
        self.assert_gates("packages/CustomWallpaper.zip", SOURCE, PACKAGE)
        self.assert_gates("new-policy.md", SOURCE)
        self.assert_gates("plugins/../outside.txt", SOURCE)
        self.assertIsNone(normalize_path("C:/outside.txt"))

    def test_plugin_relative_handles_both_plugin_layouts(self):
        self.assertEqual(plugin_relative("plugins/general/Example/plugin.json"), ("plugin.json",))
        self.assertEqual(plugin_relative("plugins/specialized/Example/frontend/App.vue"), ("frontend", "App.vue"))
        self.assertEqual(plugin_relative("plugins/Example/plugin.json"), ("plugin.json",))
        self.assertIsNone(plugin_relative("README.md"))

    def test_renames_keep_both_sides_for_cross_domain_selection(self):
        output = b"R100\0plugins/general/Example/README.md\0plugins/general/Example/plugin.json\0D\0plugins/general/Example/src/Old.cs\0"
        self.assertEqual(
            parse_name_status_z(output),
            [
                "plugins/general/Example/README.md",
                "plugins/general/Example/plugin.json",
                "plugins/general/Example/src/Old.cs",
            ],
        )
        enabled, evidence = classify_paths(parse_name_status_z(output))
        self.assertEqual(enabled, {SOURCE, FRONTEND, MANAGED, PACKAGE})
        self.assertEqual(evidence["plugins/general/Example/plugin.json"], {SOURCE, FRONTEND, PACKAGE})


if __name__ == "__main__":
    unittest.main()
