'use strict';

globalThis.nexusDiscoverScript = input => {
  const paths = sourceFiles('User/OneDragon', /\.json$/i), names = new Map(), candidates = [], diagnostics = [];
  for (const path of paths) {
    const document = strictConfigurationJson(nexusReadSource(path), 'bettergi');
    const name = document.Name;
    if (!bgiText(name, 120)) { diagnostics.push('bettergi_source_name_invalid'); continue; }
    if (!names.has(name)) names.set(name, []);
    names.get(name).push(path);
  }
  for (const [name, matches] of names) {
    if (matches.length !== 1) { diagnostics.push('bettergi_source_name_ambiguous'); continue; }
    candidates.push(sourceCandidate(matches[0], name + ' · ' + matches[0], 'BetterGI.exe', ['startOneDragon', name],
      [sourceResource('one-dragon', matches[0]), sourceResource('extra-user-config', 'User/config.json')], ['log/*.log']));
  }
  return sourceResult(input, candidates, [...new Set(diagnostics)]);
};
