import json
from pathlib import Path
import tempfile
import unittest

from localization import locale_members, read_locales


class LocalizationTests(unittest.TestCase):
    def setUp(self):
        self.scope = tempfile.TemporaryDirectory()
        self.addCleanup(self.scope.cleanup)
        self.plugin = Path(self.scope.name)
        self.manifest = {'displayName': '名称', 'gameName': '', 'summary': '', 'localization': {
            'defaultLocale': 'zh-CN', 'locales': {'zh-CN': 'i18n/zh-CN.json', 'en-US': 'i18n/en-US.json'}}}
        self.values = {locale: {'manifest': {'displayName': name, 'gameName': '', 'summary': ''},
                              'tasks': {'task': {'title': name}}, 'diagnostics': {'missing': name}}
                       for locale, name in [('zh-CN', '名称'), ('en-US', 'Name')]}

    def write(self, text=None):
        literal = json.dumps(self.values, ensure_ascii=False) if text is None else text
        (self.plugin / 'locale.ts').write_text('export const locales = ' + literal + ' as const;\n', encoding='utf-8')

    def test_projects_resources(self):
        self.write()
        members = locale_members(self.plugin, self.manifest)
        self.assertEqual(set(members), set(self.manifest['localization']['locales'].values()))
        for locale, value in self.values.items():
            self.assertEqual(value, json.loads(members[f'i18n/{locale}.json']))
        _, records = read_locales(self.plugin, self.manifest)
        self.assertEqual(['locale.ts'], [record['path'] for record in records])

    def test_rejects_ambiguous_or_executable_source(self):
        for text in ['{"zh-CN":{},"zh-CN":{}}', '{...process.env}', '{}; process.exit(0); const ignored = {}']:
            with self.subTest(text=text):
                self.write(text)
                with self.assertRaises(ValueError):
                    read_locales(self.plugin, self.manifest)

    def test_preserves_resource_validation(self):
        self.values['en-US']['diagnostics']['missing'] = ''
        self.write()
        with self.assertRaisesRegex(ValueError, 'diagnostic'):
            read_locales(self.plugin, self.manifest)
        self.values['en-US']['diagnostics']['missing'] = 'Missing'
        self.values['zh-CN']['manifest']['displayName'] = 'Changed'
        self.write()
        with self.assertRaisesRegex(ValueError, 'Default manifest'):
            read_locales(self.plugin, self.manifest)
