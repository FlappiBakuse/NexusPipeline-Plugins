'use strict';

globalThis.nexusDiscoverScript = input => {
  const paths = sourceFiles('User/OneDragon', /\.json$/i), names = new Map(), candidates = [], diagnostics = [];
  for (const path of paths) {
    const document = sourceConfiguration(input, path, 'bettergi_configuration_incomplete', diagnostics,
      content => strictConfigurationJson(content, 'bettergi'));
    if (!document) continue;
    const name = document.Name;
    if (!bgiText(name, 120)) { diagnostics.push('bettergi_source_name_invalid'); continue; }
    if (!names.has(name)) names.set(name, []);
    names.get(name).push(path);
  }
  for (const [name, matches] of names) {
    if (matches.length !== 1) diagnostics.push('bettergi_source_name_ambiguous');
    if (matches.length !== 1 && input.purpose !== 'edit') continue;
    for (const path of matches) {
      const candidate = sourceCandidate(path, name + ' · ' + path, 'BetterGI.exe', ['startOneDragon', name],
        [sourceResource('one-dragon', path), sourceResource('extra-user-config', 'User/config.json')], ['log/*.log']);
      if (!candidate && input.purpose === 'edit') diagnostics.push('bettergi_source_user_config_missing');
      if (candidate) {
        candidate.exclusiveProgram = true;
        if (input.purpose === 'edit') candidate.runIdentity = name;
      }
      candidates.push(candidate);
    }
  }
  return sourceResult(input, candidates, [...new Set(diagnostics)],
    sourceEditor(input, 'BetterGI.exe', ['User/OneDragon', 'User/config.json'], true, true));
};
