'use strict';

globalThis.nexusScriptSource = function(input) {
  const root = sourceEntries(''), candidates = [], sources = [];
  const interfaces = ['interface.json', 'interface.jsonc', 'assets/interface.json', 'assets/interface.jsonc']
    .filter(path => sourceExists(path));
  const executables = root.filter(row => row.kind === 'file' && /\.exe$/i.test(row.name)).map(row => row.name);
  const read = path => strictConfigurationJson(nexusReadSource(path), 'maa-framework');
  const add = (kind, path, id, name, required) => {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id) || !sourceExists(path) || required.some(path => !sourceExists(path)))
      throw new Error('maa_driver_source_invalid');
    sources.push({ kind, path, id, name, required: [...new Set([path, ...required])] });
  };
  for (const path of ['mxu.json', ...sourceFiles('config', /^mxu-.*\.json$/)]) {
    if (!sourceExists(path)) continue;
    const config = read(path);
    if (config.version !== '1.0' || !Array.isArray(config.instances)) throw new Error('maa_driver_source_invalid');
    for (const instance of config.instances) add('mxu', path, instance.id, instance.name || instance.id, []);
  }
  if (sourceExists('appsettings.json')) {
    const settings = read('appsettings.json');
    const globalPath = name => name === 'Default' ? 'config/config.json' : 'config/mfa_' + name + '.json';
    const fallback = globalPath(settings.DefaultConfig || 'Default');
    for (const path of sourceFiles('config/instances', /\.json$/)) {
      const id = path.slice('config/instances/'.length, -5), local = read(path);
      add('mfa', path, id, local.InstanceName || id, ['appsettings.json', sourceExists(fallback) ? fallback : 'config/config.json']);
    }
    const ids = String(settings['Instances.List'] || '').split(',').filter(Boolean);
    if (settings['Instances.LastActive']) ids.push(settings['Instances.LastActive']);
    if (!ids.length && sourceExists('config/config.json') && Array.isArray(read('config/config.json').TaskItems)) ids.push('default');
    for (const id of [...new Set(ids)]) {
      if (sources.some(source => source.kind === 'mfa' && source.id === id)) continue;
      const path = globalPath(settings['Instance.' + id + '.Config'] || settings.DefaultConfig || 'Default');
      if (sourceExists(path)) add('mfa', path, id, settings['Instance.' + id + '.Name'] || id, ['appsettings.json']);
    }
  }
  if (sourceExists('config/multi_config.json')) {
    const config = read('config/multi_config.json');
    if (!Array.isArray(config.config_list)) throw new Error('maa_driver_source_invalid');
    for (const id of config.config_list) {
      const path = 'config/configs/' + id + '.json';
      add('cfa', path, id, read(path).name || id, ['config/multi_config.json']);
    }
  }
  if (sourceExists('config/maa_pi_config.json')) add('maapicli', 'config/maa_pi_config.json', 'cli', 'MaaPiCli', []);
  for (const executable of executables) for (const source of sources) for (const interfacePath of interfaces) {
    const resources = source.required.map((path, index) => sourceResource('project-config-' + index, path));
    const candidate = sourceCandidate(executable + ':' + source.kind + ':' + source.path + ':' + source.id + ':' + interfacePath,
      executable + ' · ' + source.name, executable, [], resources, []);
    if (candidate) candidates.push({ ...candidate, projectSelection: { InterfacePath: interfacePath,
      Language: 'zh_cn', ClientKind: source.kind, Source: { Kind: source.kind, Path: source.path, InstanceId: source.id } } });
  }
  return sourceResult(input, candidates, []);
};
