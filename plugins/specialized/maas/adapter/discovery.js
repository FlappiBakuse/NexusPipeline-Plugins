'use strict';

globalThis.nexusDiscoverScript = input => {
  const candidates = [], diagnostics = [];
  if (!sourceExists('appsettings.json')) return sourceResult(input, [], ['maas_source_settings_missing']);
  const settings = strictConfigurationJson(nexusReadSource('appsettings.json'), 'maas');
  const name = settings.DefaultConfig ?? 'Default';
  if (typeof name !== 'string' || !name || name.length > 128 || /[\\/:\u0000-\u001f]/.test(name))
    return sourceResult(input, [], ['maas_source_global_invalid']);
  let globalPath = name === 'Default' ? 'config/config.json' : 'config/mfa_' + name + '.json';
  if (!sourceExists(globalPath)) globalPath = 'config/config.json';
  const interfaces = ['interface.json', 'interface.jsonc', 'assets/interface.json', 'assets/interface.jsonc'].filter(path => sourceExists(path));
  for (const path of sourceFiles('config/instances', /\.json$/)) {
    const id = path.slice('config/instances/'.length, -5);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) { diagnostics.push('maas_source_instance_invalid'); continue; }
    for (const pi of interfaces) {
      const candidate = sourceCandidate(pi + ':' + path, id + ' · ' + pi, 'MFAAvalonia.exe', ['--instance', id],
        [sourceResource('main', path), sourceResource('global', globalPath), sourceResource('settings', 'appsettings.json')], ['logs/log-*.log']);
      if (candidate) candidate.exclusiveProgram = true;
      candidates.push(candidate);
    }
  }
  return sourceResult(input, candidates, [...new Set(diagnostics)]);
};
