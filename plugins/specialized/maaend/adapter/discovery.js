'use strict';

globalThis.nexusDiscoverScript = input => {
  const candidates = [], diagnostics = [], edit = input.purpose === 'edit';
  const interfaces = ['interface.json', 'interface.jsonc', 'assets/interface.json', 'assets/interface.jsonc'].filter(path => sourceExists(path));
  const paths = sourceFiles('config', /^mxu-.+\.json$/);
  if (sourceExists('mxu.json')) paths.push('mxu.json');
  for (const path of paths) {
    const document = sourceConfiguration(input, path, 'maaend_configuration_incomplete', diagnostics,
      content => strictConfigurationJson(content, 'maaend'));
    if (!document) continue;
    if (document.version !== '1.0' || !Array.isArray(document.instances)) { diagnostics.push('maaend_source_format_unsupported'); continue; }
    const instances = document.instances;
    if (!edit && instances.filter(item => item?.id === document.settings?.autoStartInstanceId).length !== 1) {
      diagnostics.push('maaend_auto_start_instance_required'); continue;
    }
    if (instances.some(row => typeof row?.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.id)) ||
        new Set(instances.map(row => row.id)).size !== instances.length) { diagnostics.push('maaend_source_instance_ambiguous'); continue; }
    const selected = edit ? instances : instances.filter(item => item.id === document.settings?.autoStartInstanceId);
    for (const pi of edit ? interfaces.slice(0, 1) : interfaces) for (const instance of selected) {
      const candidate = sourceCandidate((edit ? '' : pi + ':') + path + ':' + instance.id,
        (instance.name || instance.id) + ' · ' + path + ' · ' + (edit ? instance.id : pi),
        'MaaEnd.exe', ['--autostart', '--quit-after-run'], [sourceResource('main', path)], []);
      if (candidate) {
        candidate.exclusiveProgram = true;
        if (edit) candidate.instance = { collection: 'instances', identity: 'id', value: instance.id,
          selection: ['settings', 'autoStartInstanceId'] };
      }
      candidates.push(candidate);
    }
  }
  return sourceResult(input, candidates, [...new Set(diagnostics)],
    sourceEditor(input, 'MaaEnd.exe', ['config', 'mxu.json'], interfaces.length > 0, true));
};
