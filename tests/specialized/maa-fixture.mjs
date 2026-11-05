import { createHash } from 'node:crypto';

export const resource = (resourceId, document, relativePath = 'config.json') => {
  const content = JSON.stringify(document);
  return { resourceId, content, relativePath, revision: 7, sha256: createHash('sha256').update(content).digest('hex') };
};
export const request = (extensionId, phase, resources, extras = {}) => ({
  format: 'nexus.task.adapter', version: 1, direction: 'request', extensionId, phase, resources,
  operationId: '009ca3c5-6b90-40e2-a981-53a33ab5c43f',
  ...(['observe', 'retry'].includes(phase) ? { runId: '582d6b9e-afbe-4aa3-860e-dd208e1915de',
    attemptId: '05fe2eaf-95a7-49e1-a631-e7abdf73adfa', planDigest: 'a'.repeat(64) } : {}), ...extras,
});
export const events = (texts, sourceId, prefix = '', first = 1) => texts.map((text, index) => ({
  sourceId, epoch: 0, sequence: first + index, text: '[2026-10-25 12:00:00.000]' + prefix + text,
}));
export const intent = (input, edits) => ({ format: 'nexus.config.patch', version: 1,
  operationId: input.operationId, resourceId: 'main', expectedRevision: 7,
  sourceSha256: input.resources[0].sha256, edits });
