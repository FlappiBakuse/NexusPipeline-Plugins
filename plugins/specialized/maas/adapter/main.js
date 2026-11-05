'use strict';

globalThis.nexusTaskAdapter = function(input) {
  if (!input || input.format !== 'nexus.task.adapter' || input.version !== 1 || input.direction !== 'request' || input.extensionId !== 'maas' ||
      !['discover', 'configuration', 'observe', 'retry'].includes(input.phase)) throw new Error('maas_adapter_contract_unsupported');
  const response = { format: input.format, version: 1, direction: 'response', phase: input.phase, extensionId: input.extensionId, operationId: input.operationId };
  for (const key of ['runId', 'attemptId', 'planDigest']) if (input[key] !== undefined) response[key] = input[key];
  if (input.phase === 'configuration' && ['editPrepare', 'editCommit'].includes(input.purpose)) {
    const resource = maaDataResource(input, 'settings', 'maas'), settings = strictConfigurationJson(resource.content, 'maas');
    const exists = maasOwn(settings, 'NoAutoStart'), value = input.purpose === 'editPrepare' ? 'True' : 'False';
    return { ...response, diagnostics: [], configPatches: [{ format: 'nexus.config.patch', version: 1,
      operationId: input.operationId, resourceId: resource.resourceId, expectedRevision: resource.revision,
      sourceSha256: resource.sha256, edits: [{ selector: ['NoAutoStart'], expected: exists ? settings.NoAutoStart : null,
        ...(exists ? {} : { expectedExists: false }), value }] }] };
  }
  const config = maasRead(input), tasks = maasTasks(config);
  if (input.phase === 'discover') return { ...response, tasks, diagnostics: maaDataDiagnostics(config, 'maas') };
  if (input.phase === 'configuration') return { ...response, ...maasConfiguration(input, config) };
  maasFreeze(input, tasks);
  if (input.phase === 'observe') return { ...response, ...maasObserve(input, config, tasks) };
  if (typeof input.idempotencyKey !== 'string' || !input.idempotencyKey) throw new Error('maas_retry_identity_required');
  const observations = input.observations ?? [];
  if (!Array.isArray(observations) || new Set(observations.map(item => item.taskId)).size !== observations.length ||
      observations.some(item => !tasks.some(task => task.taskId === item.taskId))) throw new Error('maas_observation_identity_unbound');
  return { ...response, idempotencyKey: input.idempotencyKey, selectedTaskIds: tasks.filter(task => task.isSelected && task.isEnabled &&
    task.workflowRole === 'business' && task.retrySafety === 'safe' && observations.some(item => item.taskId === task.taskId &&
      (task.repetitionLimit === undefined || Number.isSafeInteger(item.completedRepetitions) &&
        item.completedRepetitions >= 0 && item.completedRepetitions < task.repetitionLimit) &&
      (item.state === 'failed' || item.state === 'unknown' && item.completionKind === 'notExecuted' &&
        observations.some(result => result.state === 'failed')))).map(task => task.taskId) };
};
