// Local metadata plus pinned interpretation files; not complete interpreter attestation.
function runtimeIdentity(app, head, tag) {
  const channel = ['China', 'Global'].includes(app?.current_profile) ? app.current_profile : 'unknown';
  const version = typeof app?.current_version === 'string' && /^v[0-9]+\.[0-9]+\.[0-9]+(?:[-.][A-Za-z0-9]+)*$/.test(app.current_version)
    && app.current_version.length <= 48 ? app.current_version : 'unknown';
  const failure = (reason, fallback) => ({ ready: false, reasonText: {
    kind: 'plugin', key: 'diagnostic.runtime.' + reason, args: { channel, version }, fallback
  } });
  const release = ADAPTER.runtimeProfiles?.[channel] || (channel === 'Global' ? ADAPTER.runtimeRelease : null);
  if (!app || app.name !== release?.name || app.installed !== true || !release)
    return failure('installation', '无法确认官方安装身份（{channel} / {version}），请初始化受支持的官方渠道。');
  if (app.current_version !== release.version || app.current_version_missing === true
      || !Array.isArray(app.available_versions) || !app.available_versions.includes(release.version))
    return failure('version', '当前发行版本尚未通过适配验证（{channel} / {version}），请检查安装版本。');
  if (app.update_state !== 'idle' || app.update_target_version || app.update_error || app.running === true)
    return failure('busy', '更新器或上游程序尚未就绪（{channel} / {version}），请完成更新并关闭后重新检查。');
  if (typeof head !== 'string' || head.trim() !== release.commit || typeof tag !== 'string' || tag.trim() !== release.tagObject)
    return failure('repository', '本地 HEAD/tag 与受支持发行不一致（{channel} / {version}），请核对官方安装。');
  const code = ADAPTER.runtimeCodeResources;
  let verified = false;
  try { verified = Array.isArray(code) && code.length > 0 && code.every(id => nexus.readResource(id).integrity === 'verified'); }
  catch { /* Missing/unreadable bytes are unqualified. */ }
  if (!verified) return failure('code', '关键运行文件缺失或与已验证发行不同（{channel} / {version}），请修复官方安装后重新检查。');
  return { ready: true };
}
