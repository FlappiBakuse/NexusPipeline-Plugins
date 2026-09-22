function runtimeReady(plan) {
  let ready = false;
  try {
    const app = resource('runtime-app');
    const head = nexus.readResource('runtime-head').document;
    const tag = nexus.readResource('runtime-tag').document;
    const profiles = ADAPTER.runtimeProfiles || {};
    const release = profiles[app?.current_profile] || (app?.current_profile === 'Global' ? ADAPTER.runtimeRelease : null);
    ready = object(app) && object(release) && app.name === release.name && app.installed === true
      && app.current_profile && app.current_version === release.version
      && app.update_state === 'idle' && !app.update_target_version && !app.update_error
      && app.current_version_missing !== true && app.running !== true
      && Array.isArray(app.available_versions) && app.available_versions.includes(release.version)
      && typeof head === 'string' && head.trim() === release.commit
      && typeof tag === 'string' && tag.trim() === release.tagObject;
  } catch { /* Missing/unreadable installation identity must block, not imply a source checkout. */ }
  if (!ready) {
    plan.coverage = 'unsupported';
    plan.diagnostics.push({ code: 'okscript.runtime_unqualified',
      message: 'Initialize and close a supported official launcher first. The selected channel, release, detached repository HEAD, release tag and idle updater must match the supported distribution; manual update mode does not prevent forced repair.',
      reasonText: { kind: 'plugin', key: 'diagnostic.runtime_unqualified', args: {},
        fallback: '官方发行版本或更新状态未就绪，已阻止自动运行。请先完成受支持渠道的官方启动器初始化并关闭它，再检查版本与更新状态。' } });
  }
  return ready;
}
