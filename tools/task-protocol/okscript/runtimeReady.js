function runtimeReady(plan) {
  let identity = runtimeIdentity(null, null, null);
  try {
    identity = runtimeIdentity(resource('runtime-app'), nexus.readResource('runtime-head').document, nexus.readResource('runtime-tag').document);
  } catch { /* Missing/unreadable metadata remains a structured installation diagnostic. */ }
  if (!identity.ready) {
    plan.coverage = 'unsupported';
    plan.diagnostics.push({ code: 'okscript.runtime_unqualified',
      message: 'The official runtime identity could not be established. See the channel/version-specific reason.', reasonText: identity.reasonText });
  }
  return identity.ready;
}
