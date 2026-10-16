function createPlan() {
  const plan = { protocolVersion: ADAPTER.protocolVersion, type: 'discovery', coverage: 'partial', tasks: [], selectionFields: [], behaviorFields: [], diagnostics: [], slots: {} };
  if (ADAPTER.protocolVersion === '0.3.0') plan.verification = { opaqueScopes: [] };
  return plan;
}
