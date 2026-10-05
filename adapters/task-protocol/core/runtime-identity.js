// Installation identity and structural contracts do not attest the complete interpreter.
function runtimeIdentity(app, head, origin, runtimeActivity) {
  const channel = ['China', 'Global'].includes(app?.current_profile) ? app.current_profile : 'unknown';
  const version = typeof app?.current_version === 'string' && /^v[0-9]+\.[0-9]+\.[0-9]+(?:[-.][A-Za-z0-9]+)*$/.test(app.current_version)
    && app.current_version.length <= 48 ? app.current_version : 'unknown';
  const failure = (reason, fallback) => ({ ready: false, reasonText: {
    kind: 'plugin', key: 'diagnostic.runtime.' + reason, args: { channel, version }, fallback
  } });
  if (!app || app.name !== ADAPTER.runtimeName || app.installed !== true || channel === 'unknown')
    return failure('installation', '无法确认官方安装身份（{channel} / {version}），请初始化受支持的官方渠道。');
  if (app.update_state !== 'idle' || app.update_target_version || app.update_error
      || runtimeActivity === 'active' || runtimeActivity === 'unknown'
      || (runtimeActivity === undefined && app.running === true))
    return failure('busy', '更新器或上游程序尚未就绪（{channel} / {version}），请完成更新并关闭后重新检查。');
  if (app.current_version_missing === true || !Array.isArray(app.available_versions)
      || !app.available_versions.includes(app.current_version))
    return failure('version', '当前发行版本尚未通过适配验证（{channel} / {version}），请检查安装版本。');
  const matches = typeof origin === 'string' ? Array.from(origin.matchAll(/\[remote "origin"\]([^\[]*)/g)) : [];
  const url = matches.length === 1 ? matches[0][1].match(/^\s*url\s*=\s*(\S+)\s*$/m)?.[1] : null;
  const official = ADAPTER.runtimeOfficialRepository;
  const allowed = ['https://github.com/' + official, 'https://github.com/' + official + '.git', 'git@github.com:' + official + '.git']
    .concat(ADAPTER.runtimeOfficialOriginsByChannel?.[channel] || []);
  if (!allowed.includes(url) || typeof head !== 'string' || !/^[a-f0-9]{40}\s*$/.test(head) || /^0{40}\s*$/.test(head))
    return failure('repository', '无法确认当前工作副本的官方来源与提交身份，请修复安装。');
  try {
    const contracts = ADAPTER.runtimeStructuralContracts;
    if (!Array.isArray(contracts) || !contracts.length || !contracts.every(contract => {
      const source = nexus.readResource(contract.id).document;
      return typeof source === 'string' && source.length <= 2097152
        && contract.patterns.every(pattern => new RegExp(pattern, 'm').test(source));
    })) return failure('code', '当前运行入口、日常任务或执行器结构不兼容，请检查安装。');
  } catch { return failure('code', '关键运行文件缺失或无法读取，请修复安装。'); }
  return {ready:true};
}
