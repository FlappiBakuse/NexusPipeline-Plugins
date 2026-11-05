'use strict';

function sourceEntries(path) {
  if (path && !sourceExists(path, 'directory')) return [];
  const rows = JSON.parse(nexusListSource(path));
  if (!Array.isArray(rows) || rows.length > 4096 || rows.some(row => !row || typeof row.name !== 'string' ||
      !['file', 'directory'].includes(row.kind) || !row.name || /[\\/:\u0000-\u001f]/.test(row.name)))
    throw new Error('script_source_listing_invalid');
  return rows;
}

function sourceExists(path, kind = 'file') {
  const slash = path.lastIndexOf('/'), parent = slash < 0 ? '' : path.slice(0, slash), name = path.slice(slash + 1);
  return sourceEntries(parent).some(row => row.kind === kind && row.name === name);
}

function sourceFiles(directory, pattern) {
  return sourceEntries(directory).filter(row => row.kind === 'file' && pattern.test(row.name))
    .map(row => directory + '/' + row.name).sort();
}

function sourceResource(resourceId, path, syntax = 'json') { return { resourceId, path, syntax }; }

function sourceCandidate(candidateId, title, executable, args, resources, logPaths) {
  if (!sourceExists(executable) || resources.some(resource => !sourceExists(resource.path))) return null;
  return { candidateId, title, executable, arguments: args, resources, logPaths };
}

function sourceResult(input, candidates, diagnostics = []) {
  if (input?.format !== 'nexus.script.source' || input.version !== 1 || input.direction !== 'request' ||
      typeof input.operationId !== 'string' || typeof input.extensionId !== 'string') throw new Error('script_source_request_invalid');
  const selected = candidates.filter(Boolean);
  if (selected.length > 128 || new Set(selected.map(item => item.candidateId)).size !== selected.length)
    throw new Error('script_source_candidates_invalid');
  return { format: input.format, version: 1, direction: 'response', operationId: input.operationId,
    extensionId: input.extensionId, candidates: selected, diagnostics };
}
