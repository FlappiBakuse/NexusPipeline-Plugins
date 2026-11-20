'use strict';

globalThis.nexusDiscoverScript = input => {
  const candidates = [], diagnostics = [];
  const editor = sourceEditor(input, 'MFAAvalonia.exe', ['config', 'appsettings.json'], false, true);
  if (!sourceExists('appsettings.json')) return sourceResult(input, [], ['maas_source_settings_missing'], editor);
  const settings = sourceConfiguration(input, 'appsettings.json', 'maas_source_global_invalid', diagnostics,
    content => strictConfigurationJson(content, 'maas'));
  if (!settings) return sourceResult(input, [], diagnostics, editor);
  const name = settings.DefaultConfig ?? 'Default';
  if (typeof name !== 'string' || !name || name.length > 128 || /[\\/:\u0000-\u001f]/.test(name))
    return sourceResult(input, [], ['maas_source_global_invalid'], editor);
  let globalPath = name === 'Default' ? 'config/config.json' : 'config/mfa_' + name + '.json';
  if (!sourceExists(globalPath)) globalPath = 'config/config.json';
  const interfaces = ['interface.json', 'interface.jsonc', 'assets/interface.json', 'assets/interface.jsonc'].filter(path => sourceExists(path));
  for (const path of sourceFiles('config/instances', /\.json$/)) {
    const id = path.slice('config/instances/'.length, -5);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) { diagnostics.push('maas_source_instance_invalid'); continue; }
    for (const pi of input.purpose === 'edit' ? interfaces.slice(0, 1) : interfaces) {
      const candidate = sourceCandidate(input.purpose === 'edit' ? path : pi + ':' + path, id + ' · ' + pi, 'MFAAvalonia.exe', ['--instance', id],
        [sourceResource('main', path), sourceResource('global', globalPath), sourceResource('settings', 'appsettings.json')], ['logs/log-*.log']);
      if (candidate) candidate.exclusiveProgram = true;
      else if (input.purpose === 'edit') diagnostics.push('maas_source_global_missing');
      candidates.push(candidate);
    }
  }
  return sourceResult(input, candidates, [...new Set(diagnostics)], editor);
};
