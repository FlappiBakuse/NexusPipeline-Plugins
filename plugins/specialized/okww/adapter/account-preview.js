'use strict';

const okwwAccountTasks = new Set([
  'DailyTask', 'RahaiBlocksTask', 'FarmEchoTask', 'NightmareNestTask', 'TacetTask', 'ForgeryTask',
  'SimulationTask', 'CultivationTask', 'MergeEchoTask', 'EnhanceEchoTask', 'ChangeEchoTask', 'GardenTask'
]);

function okwwAccountObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function okwwAccountPreview(root) {
  const modePath = root + 'MultiAccountDailyTask.json';
  let mode = 'unknown';
  if (sourceExists(modePath)) {
    try {
      const enabled = strictConfigurationJson(nexusReadSource(modePath), 'okww')['Per-account Configuration'] ?? false;
      if (typeof enabled === 'boolean') mode = enabled ? 'enabled' : 'disabled';
    } catch { /* The account list can still be read when the separate mode file is malformed. */ }
  }
  const path = root + 'MultiAccountConfig.json';
  if (!sourceExists(path)) return { state: 'empty', mode, accounts: [] };
  const invalid = { state: 'invalid', mode, accounts: [] };
  try {
    const { accounts } = strictConfigurationJson(nexusReadSource(path), 'okww');
    if (!Array.isArray(accounts) || accounts.length > 128) return invalid;
    const seen = new Set();
    const rows = [];
    for (const account of accounts) {
      if (!okwwAccountObject(account) || !okwwAccountObject(account.config)) return invalid;
      const { account_key: key, enabled = true, task } = account;
      if (typeof key !== 'string' || !key || key !== key.trim() || /[*\u0000-\u001f]/.test(key) ||
          seen.has(key) || typeof enabled !== 'boolean') return invalid;
      seen.add(key);
      let kind = 'loginOnly';
      if (task !== null) {
        if (!okwwAccountObject(task) || Object.keys(task).length !== 2 ||
            typeof task.module !== 'string' || typeof task.class !== 'string') return invalid;
        kind = 'unknown';
        if (task.module === 'src.task.' + task.class) {
          if (task.class === 'MultiAccountDailyTask' || task.class === 'MultiAccountConfigTask') return invalid;
          if (okwwAccountTasks.has(task.class)) kind = task.class;
        }
      }
      rows.push({ enabled, task: kind, overrideCount: Object.keys(account.config).length });
    }
    return { state: rows.length ? 'ready' : 'empty', mode, accounts: rows };
  } catch {
    return invalid;
  }
}
