// Local metadata plus pinned interpretation files; not complete interpreter attestation.
function runtimeIdentity(app, head, tag, origin) {
  const channel = ['China', 'Global'].includes(app?.current_profile) ? app.current_profile : 'unknown';
  const version = typeof app?.current_version === 'string' && /^v[0-9]+\.[0-9]+\.[0-9]+(?:[-.][A-Za-z0-9]+)*$/.test(app.current_version)
    && app.current_version.length <= 48 ? app.current_version : 'unknown';
  const failure = (reason, fallback) => ({ ready: false, reasonText: {
    kind: 'plugin', key: 'diagnostic.runtime.' + reason, args: { channel, version }, fallback
  } });
  const release = ADAPTER.runtimeProfiles?.[channel] || (channel === 'Global' ? ADAPTER.runtimeRelease : null);
  if (!app || app.name !== release?.name || app.installed !== true || !release)
    return failure('installation', '无法确认官方安装身份（{channel} / {version}），请初始化受支持的官方渠道。');
  if (app.update_state !== 'idle' || app.update_target_version || app.update_error || app.running === true)
    return failure('busy', '更新器或上游程序尚未就绪（{channel} / {version}），请完成更新并关闭后重新检查。');
  if (app.current_version_missing === true || !Array.isArray(app.available_versions)
      || !app.available_versions.includes(app.current_version))
    return failure('version', '当前发行版本尚未通过适配验证（{channel} / {version}），请检查安装版本。');
  if (app.current_version !== release.version) {
    const current = /^v(\d+)\.(\d+)\.(\d+)$/.exec(version);
    const known = /^v(\d+)\.(\d+)\.(\d+)$/.exec(release.version);
    const newer = current && known && Number(current[1]) === Number(known[1])
      && ([1, 2, 3].map(i => Number(current[i]) - Number(known[i])).find(n => n !== 0) || 0) > 0;
    let originUrl = null, inOrigin = false;
    if (typeof origin === 'string' && origin.length <= 65536) for (const line of origin.split(/\r?\n/)) {
      const section = /^\s*\[([^\]]+)\]\s*$/.exec(line);
      if (section) { inOrigin = section[1] === 'remote "origin"'; continue; }
      const url = /^\s*url\s*=\s*(\S+)\s*$/.exec(line);
      if (inOrigin && url) { if (originUrl !== null) originUrl = ''; else originUrl = url[1]; }
    }
    const official = ADAPTER.runtimeOfficialRepository;
    const channelOrigins = ADAPTER.runtimeOfficialOriginsByChannel?.[channel];
    const officialOrigin = official && (originUrl === 'https://github.com/' + official + '.git'
      || originUrl === 'https://github.com/' + official
      || originUrl === 'git@github.com:' + official + '.git'
      || (Array.isArray(channelOrigins) && channelOrigins.includes(originUrl)));
    if (!newer || !officialOrigin || typeof head !== 'string' || !/^[a-f0-9]{40}\s*$/.test(head)
        || head.trim() === release.commit)
      return failure('base_unqualified', '新发行的官方身份或基础入口无法确认（{channel} / {version}），请完成更新或修复安装。');
    return { ready: true, restricted: true, reasonText: {
      kind: 'plugin', key: 'diagnostic.runtime.restricted', args: { channel, version },
      fallback: '官方新发行 {channel} / {version} 尚未验证高级任务判定；本次仅运行基础流程，任务结果保持未核验。'
    } };
  }
  if (typeof head !== 'string' || head.trim() !== release.commit || typeof tag !== 'string' || tag.trim() !== release.tagObject)
    return failure('repository', '本地 HEAD/tag 与受支持发行不一致（{channel} / {version}），请核对官方安装。');
  const code = ADAPTER.runtimeCodeResources;
  let verified = false;
  try { verified = Array.isArray(code) && code.length > 0 && code.every(id => nexus.readResource(id).integrity === 'verified'); }
  catch { /* Missing/unreadable bytes are unqualified. */ }
  if (!verified) return failure('code', '关键运行文件缺失或与已验证发行不同（{channel} / {version}），请修复官方安装后重新检查。');
  return { ready: true };
}
