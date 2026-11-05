'use strict';

globalThis.nexusTaskAdapter = function(input) {
  if (!input || input.format !== 'nexus.task.adapter' || input.version !== 1 || input.direction !== 'request' ||
      input.extensionId !== 'baah' || !['discover', 'configuration', 'observe', 'retry'].includes(input.phase))
    throw new Error('baah_adapter_contract_unsupported');
  const response = { format: input.format, version: 1, direction: 'response', phase: input.phase, extensionId: input.extensionId, operationId: input.operationId };
  for (const key of ['runId', 'attemptId', 'planDigest']) if (input[key] !== undefined) response[key] = input[key];
  const config = baahRead(input), tasks = baahTasks(config);
  if (input.phase === 'discover') return { ...response, tasks };
  if (input.phase === 'configuration') return { ...response, ...baahConfiguration(input, config) };
  baahFreeze(input, tasks);
  if (input.phase === 'observe') return { ...response, ...baahObserve(input, config, tasks) };
  if (!input.idempotencyKey || typeof input.idempotencyKey !== 'string') throw new Error('baah_retry_identity_required');
  const observations = input.observations ?? [];
  if (!Array.isArray(observations) || new Set(observations.map(item => item.taskId)).size !== observations.length ||
      observations.some(item => !tasks.some(task => task.taskId === item.taskId))) throw new Error('baah_retry_observations_unbound');
  const selectedTaskIds = tasks.filter(task => task.isSelected && task.isEnabled && task.workflowRole === 'business' && task.retrySafety === 'safe' &&
    observations.some(item => item.taskId === task.taskId && item.state === 'failed')).map(task => task.taskId);
  return { ...response, selectedTaskIds, idempotencyKey: input.idempotencyKey };
};
