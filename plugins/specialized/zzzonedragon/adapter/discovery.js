'use strict';

globalThis.nexusDiscoverScript = input => {
  const candidates = [];
  for (const item of sourceEntries('config').filter(row => row.kind === 'directory' && /^\d{2}$/.test(row.name))) {
    const id = item.name, root = 'config/' + id + '/', modern = root + 'one_dragon/_group.yml', legacy = root + 'one_dragon_app.yml';
    const main = sourceExists(modern) ? sourceResource('group:' + id, modern, 'yaml')
      : sourceExists(legacy) ? sourceResource('legacy:' + id, legacy, 'yaml') : null;
    if (!main) continue;
    const resources = [main, sourceResource('account:' + id, root + 'game_account.yml', 'yaml'),
      sourceResource('global', 'config/one_dragon.yml', 'yaml')];
    const charge = root + 'one_dragon/charge_plan.yml';
    if (sourceExists(charge)) resources.push(sourceResource('charge:' + id, charge, 'yaml'));
    candidates.push(sourceCandidate(id, '实例 ' + id, 'OneDragon-Launcher.exe', ['-o', '-i', id], resources, ['.log/log.txt']));
  }
  return sourceResult(input, candidates);
};
