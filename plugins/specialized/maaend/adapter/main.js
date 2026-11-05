'use strict';

globalThis.nexusTaskAdapter = function(input) {
  if (!input || input.format !== 'nexus.task.adapter' || input.version !== 1 || input.direction !== 'request' || input.extensionId !== 'maaend' ||
      !['discover', 'configuration', 'observe', 'retry'].includes(input.phase)) throw new Error('maaend_adapter_contract_unsupported');
  const response = { format: input.format, version: 1, direction: 'response', phase: input.phase, extensionId: input.extensionId, operationId: input.operationId };
  for (const key of ['runId', 'attemptId', 'planDigest']) if (input[key] !== undefined) response[key] = input[key];
  let config;
  try { config = maaendRead(input); }
  catch (error) {
    if (error.message !== 'maaend_auto_start_instance_required' || !['discover', 'configuration'].includes(input.phase)) throw error;
    const diagnostics = [{ code: 'mxu_autostart_invalid', severity: 'blocking', resourceId: 'main' }];
    return input.phase === 'discover' ? { ...response, tasks: [], diagnostics } : { ...response, configPatches: [], diagnostics };
  }
  const tasks = maaendTasks(config);
  if (input.phase === 'discover') return { ...response, tasks, diagnostics: maaDataDiagnostics(config, 'maaend') };
  if (input.phase === 'configuration') return { ...response, ...maaendConfiguration(input, config) };
  maaendFreeze(input, tasks);
  if (input.phase === 'observe') return { ...response, ...maaendObserve(input, config, tasks) };
  if (typeof input.idempotencyKey !== 'string' || !input.idempotencyKey) throw new Error('maaend_retry_identity_required');
  const observations = input.observations ?? [];
  if (!Array.isArray(observations) || new Set(observations.map(item => item.taskId)).size !== observations.length ||
      observations.some(item => !tasks.some(task => task.taskId === item.taskId))) throw new Error('maaend_observation_identity_unbound');
  return { ...response, idempotencyKey: input.idempotencyKey, selectedTaskIds: tasks.filter(task => task.isSelected && task.isEnabled &&
    task.workflowRole === 'business' && task.retrySafety === 'safe' && observations.some(item => item.taskId === task.taskId &&
      (item.state === 'failed' || item.state === 'unknown' && item.completionKind === 'notExecuted' &&
        observations.some(result => result.state === 'failed')))).map(task => task.taskId) };
};
