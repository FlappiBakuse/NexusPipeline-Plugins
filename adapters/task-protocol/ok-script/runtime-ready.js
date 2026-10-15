function runtimeReady(plan) {
  const optional = id => {
    try { return nexus.readResource(id).document; }
    catch (error) { if (!String(error.message).includes('config_unavailable')) throw error; return null; }
  };
  const identity = runtimeIdentity(optional('runtime-app'), optional('runtime-head'),
    optional('runtime-origin'), input.executionContext?.runtimeActivity);
  if (!identity.ready) {
    plan.coverage = 'unsupported';
    plan.diagnostics.push({ code: 'okscript.runtime_unqualified',
      message: 'The official runtime identity could not be established. See the channel/version-specific reason.', reasonText: identity.reasonText });
  }
  if (identity.recognized === false && plan.verification) {
    plan.verification.opaqueScopes.push({id:ADAPTER.id+':implementation',resourceId:'runtime-app',enabled:true,reasonCode:'unknown_implementation'});
    plan.diagnostics.push({code:'okscript.unrecognized_implementation',message:'Upstream implementation is not fully recognized.',reasonText:identity.reasonText});
  }
  return identity.ready;
}
