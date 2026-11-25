'use strict';

globalThis.nexusDiscoverScript = discoverFromSource(input => {
  const directory = 'data/apps/ok-ww', root = directory + '/working/configs/';
  const runtimeIssue = okScriptInstallation(directory, 'okww', 'v3.8.14', {
    China: 'https://cnb.cool/ok-oldking/ok-ww-update2.git', Global: 'https://github.com/ok-oldking/ok-ww-update.git'
  }, ['requirements.txt', 'config.py', 'src/task/DailyTask.py']);
  const resources = [sourceResource('main', root + 'DailyTask.json'), sourceResource('devices', root + 'devices.json')];
  for (const [id, name] of [['farm-4c', 'FarmEchoTask.json'], ['nightmare', 'NightmareNestTask.json']])
    if (sourceExists(root + name)) resources.push(sourceResource(id, root + name));
  const editor = sourceEditor(input, 'ok-ww.exe', [root.slice(0, -1)], false);
  const result = sourceResult(input, runtimeIssue ? [] : [sourceCandidate('daily', '单账号日常', 'ok-ww.exe', ['-u', 'manual', '-t', 'DailyTask', '-e'], resources,
    ['data/apps/ok-ww/working/logs/ok-script.log'])], runtimeIssue ? [runtimeIssue] : [], editor);
  if (editor) result.accountPreview = okwwAccountPreview(root);
  return result;
});
