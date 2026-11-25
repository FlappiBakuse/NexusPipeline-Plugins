'use strict';

globalThis.nexusDiscoverScript = discoverFromSource(input => {
  const directory = 'data/apps/ok-nte', root = directory + '/working/configs/';
  const runtimeIssue = okScriptInstallation(directory, 'oknte', 'v1.5.12', {
    China: 'https://cnb.cool/BnanZ0/ok-nte-update.git', Global: 'https://github.com/BnanZ0/ok-nte-update.git'
  }, ['requirements.txt', 'src/config.py', 'src/tasks/daily/DailyRoutineTask.py']);
  const resources = [sourceResource('main', root + 'DailyRoutineTask.json'),
    sourceResource('routine-configs', root + 'DailyRoutineTaskConfigs.json'), sourceResource('devices', root + 'devices.json')];
  return sourceResult(input, runtimeIssue ? [] : [sourceCandidate('daily', '单账号日常', 'ok-nte.exe', ['-u', 'manual', '-t', 'DailyRoutineTask', '-e'], resources,
    ['data/apps/ok-nte/working/logs/ok-script.log'])], runtimeIssue ? [runtimeIssue] : [],
    sourceEditor(input, 'ok-nte.exe', [root.slice(0, -1)], false));
});
