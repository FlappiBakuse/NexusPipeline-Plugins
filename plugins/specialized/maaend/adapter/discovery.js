'use strict';

globalThis.nexusDiscoverScript = input => {
  const candidates = [], diagnostics = [];
  const interfaces = ['interface.json', 'interface.jsonc', 'assets/interface.json', 'assets/interface.jsonc'].filter(path => sourceExists(path));
  const paths = sourceFiles('config', /^mxu-.+\.json$/);
  if (sourceExists('mxu.json')) paths.push('mxu.json');
  for (const path of paths) {
    const document = strictConfigurationJson(nexusReadSource(path), 'maaend');
    if (document.version !== '1.0' || !Array.isArray(document.instances)) { diagnostics.push('maaend_source_format_unsupported'); continue; }
    const instances = document.instances;
    if (instances.filter(item => item.id === document.settings?.autoStartInstanceId).length !== 1) {
      diagnostics.push('maaend_auto_start_instance_required'); continue;
    }
    if (instances.some(row => typeof row?.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.id)) ||
        new Set(instances.map(row => row.id)).size !== instances.length) { diagnostics.push('maaend_source_instance_ambiguous'); continue; }
    for (const pi of interfaces) for (const instance of instances.filter(item => item.id === document.settings?.autoStartInstanceId)) {
      const candidate = sourceCandidate(pi + ':' + path + ':' + instance.id, (instance.name || instance.id) + ' · ' + path + ' · ' + pi,
        'MaaEnd.exe', ['--autostart', '--quit-after-run'], [sourceResource('main', path)], []);
      if (candidate) candidate.exclusiveProgram = true;
      candidates.push(candidate);
    }
  }
  return sourceResult(input, candidates, [...new Set(diagnostics)]);
};
