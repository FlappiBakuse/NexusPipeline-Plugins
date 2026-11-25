'use strict';

function okScriptInstallation(directory, extensionId, version, origins, inputs) {
  const appFile = directory + '/app.json';
  if (!sourceExists(appFile)) return extensionId + '_runtime_installation_required';
  const app = strictConfigurationJson(nexusReadSource(appFile), extensionId);
  const profiles = Array.isArray(app.profiles) ? app.profiles.filter(row => row?.name === app.current_profile) : [];
  const profile = profiles[0];
  if (app.installed !== true || app.current_version !== version || profiles.length !== 1 ||
      !Object.prototype.hasOwnProperty.call(origins, profile?.name) || profile.git_url !== origins[profile.name] || profile.main_script !== 'main.py')
    return extensionId + '_runtime_profile_unverified';
  for (const input of inputs) {
    const working = directory + '/working/' + input, repository = directory + '/repo/' + input;
    if (!sourceExists(working) || !sourceExists(repository) || nexusReadSource(working) !== nexusReadSource(repository))
      return extensionId + '_runtime_working_source_unverified';
  }
  return null;
}
