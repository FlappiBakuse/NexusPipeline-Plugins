'use strict';

globalThis.nexusTaskAdapter = function(input) {
  if (input?.format !== 'nexus.task.adapter' || input.version !== 1 || input.direction !== 'request' ||
      input.extensionId !== 'maa-framework') throw new Error('maa_driver_contract_invalid');
  const response = { format: input.format, version: 1, direction: 'response', phase: input.phase,
    extensionId: input.extensionId, operationId: input.operationId };
  for (const key of ['runId', 'attemptId', 'planDigest']) if (input[key] !== undefined) response[key] = input[key];
  const compilation = input.compiled, view = compilation?.view;
  if (!compilation || !/^[a-f0-9]{64}$/.test(compilation.fingerprint) || view?.format !== 'maa-internal-execution' ||
      view.version !== 1 || !Array.isArray(view.Tasks) || !Array.isArray(view.Pretasks)) throw new Error('maa_driver_compilation_required');
  const tasks = [...view.Pretasks, ...view.Tasks].map(row => ({ taskId: row.Id, executionTaskId: row.Id, title: row.Name,
    isEnabled: row.Enabled, isSelected: row.Enabled, dependencies: [], retrySafety: 'unknown',
    workflowRole: view.Pretasks.includes(row) ? 'technical' : row.Role === 'cleanup' ? 'cleanup' : 'business',
    repetitionLimit: row.RepeatCount }));
  const diagnostics = (view.blockingDiagnostics ?? []).map(item => ({ code: item.Code || 'maa_driver_compilation_blocked', severity: 'blocking' }));
  if (input.phase === 'discover') return { ...response, tasks, diagnostics };
  if (input.phase === 'configuration') return { ...response, configPatches: [], diagnostics };
  const identity = task => [task.taskId, task.executionTaskId, task.isEnabled, task.isSelected,
    task.retrySafety, task.workflowRole, task.repetitionLimit, task.dependencies];
  if (!Array.isArray(input.tasks) || JSON.stringify(input.tasks.map(identity)) !== JSON.stringify(tasks.map(identity)))
    throw new Error('maa_driver_tasks_changed');
  if (input.phase === 'observe') return { ...response,
    ...maaNativeObservations(input, { compilation }, maaObservationTasks(input, tasks, 'maa_driver'), 'maa_driver') };
  if (input.phase !== 'retry' || typeof input.idempotencyKey !== 'string') throw new Error('maa_driver_phase_invalid');
  return { ...response, idempotencyKey: input.idempotencyKey, selectedTaskIds: [] };
};
