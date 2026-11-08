"""Project package metadata and adapter titles from one handwritten locale source."""
import json
import re
from pathlib import PurePosixPath
from source_snapshot import sha

LOCALE = re.compile(r'^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-[0-9]{3})?$')

def unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate localization key')
        result[key] = value
    return result

def read_locales(plugin, manifest):
    declaration = manifest.get('localization')
    if declaration is None:
        return {}, []
    if set(declaration) != {'defaultLocale', 'locales'} or not isinstance(declaration['locales'], dict) or not 1 <= len(declaration['locales']) <= 16:
        raise ValueError('Localization declaration invalid')
    path = plugin / 'locale.ts'
    if path.is_symlink() or path.is_junction() or plugin.is_symlink() or plugin.is_junction():
        raise ValueError('Linked localization source')
    data = path.read_bytes()
    if len(data) > 1048576:
        raise ValueError('Localization source exceeds package bound')
    match = re.fullmatch(r'export const locales = (\{.*\}) as const;\s*', data.decode('utf-8'), re.DOTALL)
    if match is None:
        raise ValueError('Localization source must export a literal locales dictionary')
    dictionaries = json.loads(match[1], object_pairs_hook=unique)
    if not isinstance(dictionaries, dict) or dictionaries.keys() != declaration['locales'].keys():
        raise ValueError('Localization source differs from declared locales')
    dictionaries = {locale: dictionaries[locale] for locale in declaration['locales']}
    records = [{'path': 'locale.ts', 'sha256': sha(data)}]
    for locale, name in declaration['locales'].items():
        relative = PurePosixPath(name)
        if not LOCALE.fullmatch(locale) or relative.parts != ('i18n', locale + '.json'):
            raise ValueError('Localization must use its declared portable locale path')
        value = dictionaries[locale]
        if not isinstance(value, dict) or len(locale_bytes(value)) > 262144:
            raise ValueError('Localization document exceeds package bound')
        if set(value) != {'manifest', 'tasks', 'diagnostics'} or set(value['manifest']) != {'displayName', 'gameName', 'summary'}:
            raise ValueError('Localization groups invalid')
        for key, maximum in (('displayName', 120), ('gameName', 120), ('summary', 1024)):
            text = value['manifest'][key]
            if not isinstance(text, str) or len(text) > maximum or key == 'displayName' and not text.strip():
                raise ValueError('Localization metadata invalid')
        if not isinstance(value['tasks'], dict) or len(value['tasks']) > 4096 or not isinstance(value['diagnostics'], dict):
            raise ValueError('Localization dictionary invalid')
        for key, task in value['tasks'].items():
            if not key or len(key) > 120 or not isinstance(task, dict) or set(task) != {'title'} or not isinstance(task['title'], str) or not 1 <= len(task['title']) <= 256:
                raise ValueError('Localized task title invalid')
        if any(not isinstance(code, str) or not isinstance(text, str) or not text or len(text) > 2048 for code, text in value['diagnostics'].items()):
            raise ValueError('Localized diagnostic invalid')
        dictionaries[locale] = value
    fallback = dictionaries.get(declaration['defaultLocale'])
    if fallback is None or any(manifest.get(key) != text for key, text in fallback['manifest'].items()):
        raise ValueError('Default manifest differs from its locale source')
    return dictionaries, records

def project_metadata(plugin, manifest):
    dictionaries, _ = read_locales(plugin, manifest)
    if not dictionaries:
        return manifest
    metadata = {'defaultLocale': manifest['localization']['defaultLocale'],
        **dictionaries[manifest['localization']['defaultLocale']]['manifest'],
        'tags': manifest.get('tags', []), 'locales': {locale: value['manifest'] for locale, value in dictionaries.items()}}
    if manifest.get('author'):
        metadata['author'] = manifest['author']
    return {**manifest, 'metadata': metadata}

def adapter_titles(plugin, manifest):
    dictionaries, records = read_locales(plugin, manifest)
    if not dictionaries:
        return b'', records
    fallback = dictionaries[manifest['localization']['defaultLocale']]['tasks']
    titles = {}
    for key, task in fallback.items():
        values = {locale: value['tasks'][key]['title'] for locale, value in dictionaries.items() if key in value['tasks']}
        titles[key] = values
        titles.setdefault(task['title'], values)
    payload = json.dumps(titles, ensure_ascii=False, separators=(',', ':'))
    code = 'const nexusTaskLocales = (() => { const titles = ' + payload + '; return id => Object.prototype.hasOwnProperty.call(titles, id) ? { ...titles[id] } : undefined; })();\n'
    code += 'const nexusTitleEquals = (first, second) => { const a = first || {}, b = second || {}; return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key] === b[key]); };\n'
    return code.encode('utf-8'), records


def locale_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def locale_members(plugin, manifest):
    dictionaries, _ = read_locales(plugin, manifest)
    return {manifest['localization']['locales'][locale]: locale_bytes(value)
            for locale, value in dictionaries.items()}


def write_locales(plugin, manifest, output):
    records = []
    for name, data in locale_members(plugin, manifest).items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        records.append({'member': name, 'path': str(target), 'sha256': sha(data)})
    return records
