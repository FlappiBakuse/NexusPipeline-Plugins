'use strict';

globalThis.nexusDiscoverScript = discoverFromSource(input => {
  const candidates = [], diagnostics = [];
  for (const item of sourceEntries('config').filter(row => row.kind === 'directory' && /^\d{2}$/.test(row.name))) {
    const id = item.name, root = 'config/' + id + '/', modern = root + 'one_dragon/_group.yml', legacy = root + 'one_dragon_app.yml';
    const main = sourceExists(modern) ? sourceResource('group:' + id, modern, 'yaml')
      : sourceExists(legacy) ? sourceResource('legacy:' + id, legacy, 'yaml') : null;
    if (!main) continue;
    const resources = [main, sourceResource('account:' + id, root + 'game_account.yml', 'yaml'),
      sourceResource('global', 'config/one_dragon.yml', 'yaml')];
    const charge = root + 'one_dragon/charge_plan.yml';
    if (sourceExists(charge)) resources.push(sourceResource('charge:' + id, charge, 'yaml'));
    const candidate = sourceCandidate(id, '实例 ' + id, 'OneDragon-Launcher.exe', ['-o', '-i', id], resources, ['.log/log.txt']);
    if (candidate && input.purpose === 'edit') candidate.isolationPath = root.slice(0, -1);
    if (!candidate && input.purpose === 'edit') diagnostics.push('zzzonedragon_source_config_incomplete');
    candidates.push(candidate);
  }
  return sourceResult(input, candidates, [...new Set(diagnostics)],
    sourceEditor(input, 'OneDragon-Launcher.exe', ['config'], true));
});
