'use strict';

globalThis.nexusTaskAdapter = function(input) {
  if (!input || input.format !== 'nexus.task.adapter' || input.version !== 1 || input.direction !== 'request' || input.extensionId !== 'march7th' ||
      !['discover', 'configuration', 'observe', 'retry'].includes(input.phase)) throw new Error('march7th_adapter_contract_unsupported');
  const response = { format: input.format, version: 1, direction: 'response', phase: input.phase, extensionId: input.extensionId, operationId: input.operationId };
  for (const key of ['runId', 'attemptId', 'planDigest']) if (input[key] !== undefined) response[key] = input[key];
  const config = march7thRead(input), tasks = march7thTasks(config);
  if (input.phase === 'discover') return { ...response, tasks };
  if (input.phase === 'configuration') return { ...response, ...march7thConfiguration(input, config) };
  march7thFreeze(input, tasks);
  if (input.phase === 'observe') return { ...response, ...march7thObserve(input, config, tasks) };
  if (typeof input.idempotencyKey !== 'string' || !input.idempotencyKey) throw new Error('march7th_retry_identity_required');
  const observations = input.observations ?? [];
  if (!Array.isArray(observations) || new Set(observations.map(item => item.taskId)).size !== observations.length ||
      observations.some(item => !tasks.some(task => task.taskId === item.taskId))) throw new Error('march7th_observation_identity_unbound');
  return { ...response, idempotencyKey: input.idempotencyKey, selectedTaskIds: tasks.filter(task => task.isSelected && task.isEnabled &&
    task.workflowRole === 'business' && task.retrySafety === 'safe' &&
    !tasks.some(child => child.isSelected && child.dependencies.includes(task.taskId)) &&
    observations.some(item => item.taskId === task.taskId && item.state === 'failed')).map(task => task.taskId) };
};
