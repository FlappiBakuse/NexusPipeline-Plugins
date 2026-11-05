'use strict';

globalThis.nexusTaskAdapter = function(input) {
  if (!input || input.format !== 'nexus.task.adapter' || input.version !== 1 || input.direction !== 'request' || input.extensionId !== 'okww' ||
      !['discover', 'configuration', 'observe', 'retry'].includes(input.phase)) throw new Error('okww_adapter_contract_unsupported');
  const response = { format: input.format, version: 1, direction: 'response', phase: input.phase, extensionId: input.extensionId, operationId: input.operationId };
  for (const key of ['runId', 'attemptId', 'planDigest']) if (input[key] !== undefined) response[key] = input[key];
  const config = okwwRead(input), tasks = okwwTasks(config);
  if (input.phase === 'discover') return { ...response, tasks };
  if (input.phase === 'configuration') return { ...response, ...okwwConfiguration(input, config) };
  okwwFreeze(input, tasks);
  if (input.phase === 'observe') return { ...response, ...okwwObserve(input, config, tasks) };
  if (typeof input.idempotencyKey !== 'string' || !input.idempotencyKey) throw new Error('okww_retry_identity_required');
  const observations = input.observations ?? [];
  if (!Array.isArray(observations) || new Set(observations.map(item => item.taskId)).size !== observations.length ||
      observations.some(item => !tasks.some(task => task.taskId === item.taskId))) throw new Error('okww_observation_identity_unbound');
  const parent = observations.find(item => item.taskId === 'okww:daily'), partial = observations.some(item => item.state === 'partial');
  return { ...response, idempotencyKey: input.idempotencyKey, selectedTaskIds: !partial && parent?.state === 'failed' &&
    tasks.find(task => task.taskId === 'okww:daily')?.retrySafety === 'safe' ? ['okww:daily'] : [] };
};
