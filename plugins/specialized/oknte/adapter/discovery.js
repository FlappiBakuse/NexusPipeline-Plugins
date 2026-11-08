'use strict';

globalThis.nexusDiscoverScript = input => {
  const root = 'data/apps/ok-nte/working/configs/';
  const resources = [sourceResource('main', root + 'DailyRoutineTask.json'),
    sourceResource('routine-configs', root + 'DailyRoutineTaskConfigs.json'), sourceResource('devices', root + 'devices.json')];
  return sourceResult(input, [sourceCandidate('daily', '单账号日常', 'ok-nte.exe', ['-t', '2', '-e'], resources,
    ['data/apps/ok-nte/working/logs/*.log'])]);
};
