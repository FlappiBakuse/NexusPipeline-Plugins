// Shared by discovery coverage and configuration admission. These checks are
// local installation metadata, not proof of an immutable working tree.
function runtimeIdentity(app, head, tag) {
  const profiles = ADAPTER.runtimeProfiles || {};
  const release = profiles[app?.current_profile] || (app?.current_profile === 'Global' ? ADAPTER.runtimeRelease : null);
  return !!(app && release && app.name === release.name && app.installed === true
    && app.current_profile && app.current_version === release.version
    && app.update_state === 'idle' && !app.update_target_version && !app.update_error
    && app.current_version_missing !== true && app.running !== true
    && Array.isArray(app.available_versions) && app.available_versions.includes(release.version)
    && typeof head === 'string' && head.trim() === release.commit
    && typeof tag === 'string' && tag.trim() === release.tagObject);
}
