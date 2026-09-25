function runtimeReady(plan) {
  const optional = id => { try { return nexus.readResource(id).document; } catch { return null; } };
  const identity = runtimeIdentity(optional('runtime-app'), optional('runtime-head'),
    optional('runtime-tag'), optional('runtime-origin'));
  if (!identity.ready) {
    plan.coverage = 'unsupported';
    plan.diagnostics.push({ code: 'okscript.runtime_unqualified',
      message: 'The official runtime identity could not be established. See the channel/version-specific reason.', reasonText: identity.reasonText });
  }
  if (identity.restricted) {
    plan.runtimeRestricted = true;
    plan.diagnostics.push({ code: 'okscript.runtime_restricted',
      message: 'Official new release: only the base lifecycle is qualified. Task interpretation and selective retry are disabled.',
      reasonText: identity.reasonText });
  }
  return identity.ready;
}
