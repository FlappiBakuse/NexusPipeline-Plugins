'use strict';

globalThis.nexusDiscoverScript = input => {
  const root = 'data/apps/ok-ww/working/configs/';
  const resources = [sourceResource('main', root + 'DailyTask.json'), sourceResource('devices', root + 'devices.json')];
  for (const [id, name] of [['farm-4c', 'FarmEchoTask.json'], ['nightmare', 'NightmareNestTask.json']])
    if (sourceExists(root + name)) resources.push(sourceResource(id, root + name));
  return sourceResult(input, [sourceCandidate('daily', '单账号日常', 'ok-ww.exe', ['-t', '1', '-e'], resources,
    ['data/apps/ok-ww/working/logs/*.log'])]);
};
