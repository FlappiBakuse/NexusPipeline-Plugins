const ADAPTER = {"id": "task-protocol-mxu", "preset": "mxu"};
// Bundled by generate_task_protocol.py; no Node/CLR or runtime imports.
'use strict';
function requireValue(ok) { if (!ok) throw new Error('unsupported_schema'); }
function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function unique(values) { return new Set(values).size === values.length; }
function clean(text) { return String(text).replace(/\x1b\[[0-9;]*m/g, '').trim(); }
function configOne(predicate) {
  const found = input.configResources.filter(predicate || (() => true)); requireValue(found.length === 1);
  return { id: found[0].id, ...nexus.readConfig(found[0].id) };
}
function jsonc(text) {
  // Native token matching avoids a per-character Jint statement cost on full MXU interfaces.
  // Quoted strings are consumed first, preserving URL/comment-like and comma-like string content.
  try { return JSON.parse(text); } catch { /* upstream interfaces also allow JSONC */ }
  const stripped = text.replace(/"(?:\\.|[^"\\])*"|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g,
    token => token[0] === '"' ? token : ' ');
  return JSON.parse(stripped.replace(/"(?:\\.|[^"\\])*"|,\s*(?=[}\]])/g,
    token => token[0] === '"' ? token : ''));
}
const resourceCache = {};
function resource(id) {
  if (!Object.prototype.hasOwnProperty.call(resourceCache, id)) {
    const r = nexus.readResource(id); resourceCache[id] = r.format === 'text' ? jsonc(r.document) : r.document;
  }
  return resourceCache[id];
}
function endRun(result, line, ruleId, aborted) {
  if (result.runBoundary === 'aborted' && !aborted) return;
  result.runBoundary = aborted ? 'aborted' : 'ended';
  result.boundaryEvidence = [{ sourceId: line.sourceId, epoch: line.epoch, sequence: line.sequence, ruleId }];
}
function createPlan() { return { protocolVersion: '1.0', type: 'discovery', coverage: 'partial', tasks: [], selectionFields: [], behaviorFields: [], diagnostics: [], slots: {} }; }
function behavior(plan, config, keys, prefix) {
  for (const key of keys) if (Object.prototype.hasOwnProperty.call(config.document, key))
    plan.behaviorFields.push({ resourceId: config.id, selector: (prefix || []).concat(key) });
}
function addTask(plan, resourceId, key, name, enabled, selector, risk, detection, role, parentId) {
  const id = ADAPTER.id + ':' + key;
  requireValue(typeof enabled === 'boolean' && typeof name === 'string' && name.length > 0 && !plan.tasks.some(t => t.id === id));
  const task = { id, sourceKey: key, name, parentId: parentId || null, role: role || 'business', enabled,
    order: plan.tasks.length, countsAsUnit: !parentId && (!role || role === 'business'), requiredForParent: true,
    retryUnitId: parentId || id, retryRisk: risk || 'unknown', dependencies: [], detection: detection || 'limited', configRef: resourceId };
  plan.tasks.push(task);
  if (selector) {
    const field = { resourceId, selector, purpose: 'selection' };
    if (!plan.selectionFields.some(f => JSON.stringify(f) === JSON.stringify(field))) plan.selectionFields.push(field);
    plan.slots[id] = field;
  }
  return task;
}
function select(document, selector) {
  let node = document;
  for (const token of selector) {
    if (typeof token === 'string') { requireValue(object(node) && Object.prototype.hasOwnProperty.call(node, token)); node = node[token]; }
    else if (Object.prototype.hasOwnProperty.call(token, 'by')) {
      requireValue(Array.isArray(node)); const found = node.filter(v => object(v) && JSON.stringify(v[token.by]) === JSON.stringify(token.value));
      requireValue(found.length === 1); node = found[0];
    } else {
      requireValue(Array.isArray(node) && object(node[token.index]) && JSON.stringify(node[token.index][token.guardKey]) === JSON.stringify(token.guardValue)); node = node[token.index];
    }
  }
  return node;
}
function retryPlan(discover) {
  const stop = reason => ({ protocolVersion: '1.0', type: 'retry', decision: 'stop', reasonCode: reason,
    includedTaskIds: [], prerequisiteTaskIds: [], expandedUnitIds: [], filePatches: [] });
  if (input.cancelled || input.budgetExhausted || input.attemptsUsed >= input.maxAttempts) return stop('retry.budget_exhausted');
  const tasks = input.originalPlan.tasks, selected = new Set(tasks.filter(t => t.enabled && ['failed', 'blocked'].includes(input.taskStates[t.id])).map(t => t.id));
  if (!selected.size) return stop('retry.no_verified_candidate');
  const prerequisites = new Set(), expanded = new Set();
  let changed = true;
  while (changed) {
    const count = selected.size;
    for (const id of Array.from(selected)) {
      const task = tasks.find(t => t.id === id); requireValue(task);
      const unit = tasks.filter(t => t.enabled && t.retryUnitId === task.retryUnitId).map(t => t.id).concat(task.retryUnitId);
      if (unit.some(id => !selected.has(id))) expanded.add(task.retryUnitId);
      unit.forEach(id => selected.add(id)); task.dependencies.forEach(id => { selected.add(id); prerequisites.add(id); });
    }
    changed = selected.size !== count;
  }
  if (tasks.some(t => selected.has(t.id) && (t.retryRisk !== 'safe' || (!t.enabled && t.role === 'business')))) return stop('retry.risk_not_verified');
  const included = [], remaining = new Set(selected);
  while (remaining.size) {
    const ready = tasks.filter(t => remaining.has(t.id) && !t.dependencies.some(d => remaining.has(d))).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    requireValue(ready.length > 0); ready.forEach(t => { included.push(t.id); remaining.delete(t.id); });
  }
  const current = discover(), patches = {};
  if (typeof customRetryPatches === 'function') {
    const custom = customRetryPatches(current, selected);
    return { protocolVersion: '1.0', type: 'retry', decision: 'selective', reasonCode: 'retry.unfinished', includedTaskIds: included,
      prerequisiteTaskIds: included.filter(id => prerequisites.has(id)), expandedUnitIds: Array.from(expanded).sort(), filePatches: custom };
  }
  for (const task of tasks) {
    const slot = current.slots[task.id];
    if (!slot) { if (selected.has(task.id) && !task.enabled) return stop('retry.no_selection_field'); continue; }
    const r = nexus.readConfig(slot.resourceId), expected = select(r.document, slot.selector);
    if (typeof expected !== 'boolean') return stop('retry.unsupported_selection');
    const value = selected.has(task.id);
    if (expected === value) continue;
    if (!patches[slot.resourceId]) patches[slot.resourceId] = { resourceId: slot.resourceId, format: r.format, expectedRevision: r.revision, operations: [] };
    patches[slot.resourceId].operations.push({ selector: slot.selector, expected, value, purpose: 'selection' });
  }
  return { protocolVersion: '1.0', type: 'retry', decision: 'selective', reasonCode: 'retry.unfinished', includedTaskIds: included,
    prerequisiteTaskIds: included.filter(id => prerequisites.has(id)), expandedUnitIds: Array.from(expanded).sort(), filePatches: Object.values(patches) };
}
function observeRules(rule) {
  const result = { protocolVersion: '1.0', type: 'observation', runId: input.runId, attemptId: input.attemptId,
    runBoundary: 'open', boundaryEvidence: [], diagnostics: [], observations: [], cursorState: input.adapterState || {} };
  const tasks = input.originalPlan.tasks.filter(t => input.attemptTaskIds.includes(t.id));
  const states = JSON.parse(JSON.stringify(input.acceptedState));
  function emit(task, status, line, ruleId, skipKind) {
    const old = states[task.id] || { status: 'pending', executionOrdinal: 0 };
    let ordinal = old.executionOrdinal || 1;
    if (status === 'running' && old.executionOrdinal > 0 && !['running', 'pending'].includes(old.status)) ordinal++;
    const observation = { id: [line.sourceId, line.epoch, line.sequence, task.id, status].join(':'), taskId: task.id,
      executionOrdinal: ordinal, status, reasonCode: ruleId, evidence: [{ sourceId: line.sourceId, epoch: line.epoch, sequence: line.sequence, ruleId }] };
    if (skipKind) observation.skipKind = skipKind;
    result.observations.push(observation); states[task.id] = { executionOrdinal: ordinal, status };
  }
  for (const line of input.logBatch.records) rule(clean(line.text), tasks, (task, status, ruleId, skipKind) => emit(task, status, line, ruleId, skipKind), result, line, states);
  return result;
}
function dispatch() {
  try {
    if (input.phase === 'discover') { const result = discover(); delete result.slots; return result; }
    if (input.phase === 'observe') return observeRules(observe);
    if (input.phase === 'retry') return retryPlan(discover);
    throw new Error('protocol_error');
  } catch (error) {
    if (input.phase !== 'discover') throw error;
    return { protocolVersion: '1.0', type: 'discovery', coverage: 'unsupported', tasks: [], selectionFields: [],
      diagnostics: [{ code: 'unsupported_schema', message: 'Configuration identity or schema could not be verified.' }] };
  }
}

// Synthetic grammar: TASK <stable-id> START|OK|FAIL. No real game claims.
function discover() {
  const config = configOne(), plan = createPlan(), d = config.document;
  if (ADAPTER.preset === 'json-map' || ADAPTER.preset === 'yaml') {
    requireValue(object(d.enabled));
    for (const [id, enabled] of Object.entries(d.enabled))
      addTask(plan, config.id, id, id, enabled, ['enabled', id], 'safe', 'supported');
  } else if (ADAPTER.preset === 'json-parallel-array') {
    requireValue(Array.isArray(d.pipelines) && d.pipelines.length === 1);
    const row = d.pipelines[0];
    requireValue(Array.isArray(row.ids) && unique(row.ids) && Array.isArray(row.enabled) && row.ids.length === row.enabled.length);
    row.ids.forEach((id, index) => addTask(plan, config.id, id, id, row.enabled[index], null, 'safe', 'supported'));
    plan.selectionFields.push({ resourceId: config.id, selector: ['pipelines', {index:0, guardKey:'ids', guardValue:row.ids}, 'enabled'], purpose:'selection' });
  } else {
    const instance = ADAPTER.preset === 'mxu' ? (d.instances || []).filter(i => i.id === d.activeId) : [{tasks:d.tasks}];
    requireValue(instance.length === 1 && Array.isArray(instance[0].tasks));
    const prefix = ADAPTER.preset === 'mxu' ? ['instances', {by:'id',value:d.activeId}] : [];
    for (const task of instance[0].tasks) {
      requireValue(typeof task.id === 'string' && /^[A-Za-z0-9_-]+$/.test(task.id));
      addTask(plan, config.id, task.id, task.name, task.enabled, prefix.concat(['tasks', {by:'id',value:task.id}, 'enabled']), 'safe', 'supported');
    }
  }
  plan.coverage = 'complete'; return plan;
}
function customRetryPatches(plan, selected) {
  const groups = {};
  if (ADAPTER.preset === 'json-parallel-array') {
    const field = plan.selectionFields[0], r = nexus.readConfig(field.resourceId);
    return [{resourceId:field.resourceId,format:r.format,expectedRevision:r.revision,operations:[{
      selector:field.selector,expected:select(r.document,field.selector),value:plan.tasks.map(t=>selected.has(t.id)),purpose:'selection'}]}];
  }
  for (const task of plan.tasks) {
    const field = plan.slots[task.id], r = nexus.readConfig(field.resourceId);
    const expected = select(r.document, field.selector), value = selected.has(task.id);
    if (expected === value) continue;
    groups[field.resourceId] ||= {resourceId:field.resourceId,format:r.format,expectedRevision:r.revision,operations:[]};
    groups[field.resourceId].operations.push({selector:field.selector,expected,value,purpose:'selection'});
  }
  return Object.values(groups);
}
function observe(text, tasks, emit) {
  const match = /^TASK ([A-Za-z0-9_-]+) (START|OK|FAIL)$/.exec(text);
  if (!match) return;
  const found = tasks.filter(t => t.sourceKey === match[1]);
  if (found.length !== 1) return;
  emit(found[0], { START:'running', OK:'succeeded', FAIL:'failed' }[match[2]], 'example.task.' + match[2].toLowerCase());
}

console.log(dispatch());
