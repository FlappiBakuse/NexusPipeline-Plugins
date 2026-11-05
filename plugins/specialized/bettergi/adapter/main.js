'use strict';

globalThis.nexusTaskAdapter = function(input) {
  if (!input || input.format !== 'nexus.task.adapter' || input.version !== 1 || input.direction !== 'request' ||
      input.extensionId !== 'bettergi' || !['discover', 'observe', 'retry', 'configuration'].includes(input.phase))
    throw new Error('bettergi_adapter_contract_unsupported');
  const response = { format: input.format, version: 1, direction: 'response', phase: input.phase,
    extensionId: input.extensionId, operationId: input.operationId };
  for (const key of ['runId', 'attemptId', 'planDigest']) if (input[key] !== undefined) response[key] = input[key];
  const config = readConfiguration(input), tasks = discoverTasks(config);
  if (input.phase === 'discover') return { ...response, tasks, diagnostics: bgiConfiguration(input, config).diagnostics };
  if (input.phase === 'configuration') return { ...response, ...bgiConfiguration(input, config) };
  assertFrozenTasks(input, tasks);
  if (input.phase === 'observe') return { ...response, ...observeTasks(input, tasks) };
  if (typeof input.idempotencyKey !== 'string' || !input.idempotencyKey) throw new Error('bettergi_retry_identity_required');
  return { ...response, selectedTaskIds: retryTasks(input, config, tasks), idempotencyKey: input.idempotencyKey };
};
