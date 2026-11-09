import json
from pathlib import Path
import tempfile
import unittest

from localization import locale_members


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
        members = {name: json.loads(data) for name, data in locale_members(self.plugin, self.manifest).items()}
        self.assertEqual({f'i18n/{locale}.json': value for locale, value in self.values.items()}, members)

    def test_refuses_unsafe_source(self):
        valid = json.dumps(self.values, ensure_ascii=False)
        english = json.dumps(self.values['en-US'], ensure_ascii=False)
        for text in ['{"en-US":' + english + ',' + valid[1:], '{...process.env,' + valid[1:],
                     valid + '; globalThis.localeExecuted = true; const ignored = {}']:
            with self.subTest(text=text):
                self.write(text)
                with self.assertRaises(ValueError):
                    locale_members(self.plugin, self.manifest)

    def test_preserves_resource_validation(self):
        self.values['en-US']['diagnostics']['missing'] = ''
        self.write()
        with self.assertRaisesRegex(ValueError, 'diagnostic'):
            locale_members(self.plugin, self.manifest)
        self.values['en-US']['diagnostics']['missing'] = 'Missing'
        self.values['zh-CN']['manifest']['displayName'] = 'Changed'
        self.write()
        with self.assertRaisesRegex(ValueError, 'Default manifest'):
            locale_members(self.plugin, self.manifest)
