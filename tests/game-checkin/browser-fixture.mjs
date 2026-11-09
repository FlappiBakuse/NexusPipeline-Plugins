import { registerElements } from '/ui.js';
import { ExtensionScope } from '/sdk.js';
import { createFrontend } from '/plugin.js';

registerElements();
const model = await (await fetch('/model.json')).json();
let editorSequence = 0, taskSequence = 0, viewRevision = model.revision - 1;
window.calls = []; window.saves = []; window.visibility = new Set(); window.committed = new Set();
const ok = value => ({ ok: true, value });
const fail = code => ({ ok: false, error: { code } });
const taskId = () => `00000000-0000-4000-8000-${String(++taskSequence).padStart(12, '0')}`;
const fieldSet = configured => Object.fromEntries(model.platforms.map(platform => [platform.id, {
  configured: configured?.[platform.id] ?? false, fieldGeneration: 0, source: configured?.[platform.id] ? window.credentialSource : null,
  maskedAccount: configured?.[platform.id] ? platform.id + ' · 12**56' : null, intent: 'keep', candidateId: null, error: null
}]));
const current = () => ({ ...structuredClone(window.state), revision: ++viewRevision });
const requireEditor = id => {
  const editor = window.editors.get(id);
  if (!editor) throw Error('fixture_editor_missing');
  return editor;
};
class FixtureSurface {
  #element; #context; #scope; #visible = true; #listeners;
  constructor(element, scope, listeners) {
    this.#element = element; this.#scope = scope; this.#listeners = listeners;
    this.#context = Object.freeze({ surfaceId: 'overview.cards', instanceId: 'fixture' });
  }
  get element() { return this.#element; }
  get context() { return this.#context; }
  get scope() { return this.#scope; }
  get signal() { return this.#scope.signal; }
  get visible() { return this.#visible; }
  onVisibilityChanged(callback) {
    if (this.#scope.signal.aborted) return () => {};
    this.#listeners.add(callback); return () => this.#listeners.delete(callback);
  }
  setAppearance(value) { this.#element.dataset.fixtureAppearance = value === null ? '' : 'set'; }
  setVisible(value) {
    const next = !!value && !this.#scope.signal.aborted && this.#element.isConnected;
    if (next === this.#visible) return;
    this.#visible = next; for (const callback of [...this.#listeners]) callback(next);
  }
}
const transport = {
  get connectionKind() { return window.isLocal ? 'local' : 'remote'; },
  async invoke(operation, input, signal, operationId) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    window.calls.push({ operation, operationId: operationId ?? null,
      expectedRevision: input.expectedRevision, publicationOperationId: input.publicationOperationId });
    const read = ['read-state', 'read-editor', 'read-publication'].includes(operation);
    if (read ? operationId !== undefined : !operationId) throw Error('fixture_operation_identity_invalid');
    if (['confirm-reveal', 'reveal-credential'].includes(operation) && !window.isLocal) return fail('secret_read_requires_local_client');
    if (operation === 'read-state') return ok(current());
    if (operation === 'open-editor') {
      if (input.expectedRevision !== window.state.configurationRevision) return fail('checkin_configuration_conflict');
      const task = input.taskId ? window.state.tasks.find(task => task.id === input.taskId) : undefined;
      if (input.taskId && !task) return fail('checkin_task_not_found');
      const editor = { editorSessionId: `editor-${++editorSequence}`, revision: 0, fields: fieldSet(window.configured.get(input.taskId)),
        task: task ? structuredClone(task) : null, expectedRevision: input.expectedRevision };
      window.editors.set(editor.editorSessionId, editor); return ok(structuredClone(editor));
    }
    if (operation === 'read-editor') return ok(structuredClone(requireEditor(input.editorSessionId)));
    if (operation === 'lease-editor') { requireEditor(input.editorSessionId); return ok({}); }
    if (operation === 'close-editor') { window.editors.delete(input.editorSessionId); return ok({}); }
    if (operation === 'confirm-reveal') { requireEditor(input.editorSessionId); window.confirmed = true; return ok({}); }
    if (operation === 'reveal-credential') {
      requireEditor(input.editorSessionId);
      return window.confirmed ? ok({ value: 'synthetic-sensitive-canary', remainingSeconds: 86400 }) : fail('reveal_confirmation_required');
    }
    if (operation === 'read-publication') return ok({ committed: window.committed.has(input.publicationOperationId) });
    if (operation === 'save-task') {
      if (!operationId) throw Error('fixture_missing_operation');
      const editor = requireEditor(input.editorSessionId);
      if (editor.expectedRevision !== window.state.configurationRevision) return fail('checkin_configuration_conflict');
      if (window.saveFailure === 'conflict') return fail('credential_saved_conflict');
      if (window.saveFailure === 'unknown') throw Error('synthetic_lost_response');
      const id = input.draft.id ?? taskId(); const task = { ...structuredClone(input.draft), id, isRunning: false, nextRunAt: null, recentRun: null, runs: [] };
      const configured = Object.fromEntries(Object.entries(editor.fields).map(([id, field]) => [id, field.configured]));
      for (const [platform, action] of Object.entries(input.secrets)) {
        if (action.action === 'set') configured[platform] = true;
        if (action.action === 'clear') configured[platform] = false;
      }
      window.saves.push({ task: structuredClone(task), newIdWasNull: input.draft.id === null, operationId,
        actions: Object.fromEntries(Object.entries(input.secrets).map(([id, action]) => [id, { action: action.action,
          fieldGeneration: action.fieldGeneration, hasValue: typeof action.value === 'string', hasCandidate: typeof action.candidateId === 'string' }])) });
      const index = window.state.tasks.findIndex(task => task.id === id);
      if (index < 0) window.state.tasks.push(task); else window.state.tasks[index] = task;
      window.configured.set(id, configured); window.state.configurationRevision++; window.editors.delete(input.editorSessionId); window.committed.add(operationId);
      if (window.saveFailure === 'committedReplyLost') throw Error('synthetic_committed_response_lost');
      return ok(current());
    }
    if (operation === 'delete-task') {
      if (!operationId || input.expectedRevision !== window.state.configurationRevision) return fail('checkin_configuration_conflict');
      window.state.tasks = window.state.tasks.filter(task => task.id !== input.taskId); window.configured.delete(input.taskId);
      window.state.configurationRevision++; return ok(current());
    }
    if (operation === 'reorder-tasks') {
      if (!operationId || input.expectedRevision !== window.state.configurationRevision) return fail('checkin_configuration_conflict');
      window.state.tasks = input.taskIds.map(id => window.state.tasks.find(task => task.id === id)); window.state.configurationRevision++; return ok(current());
    }
    if (operation === 'run-task') {
      if (!operationId || !window.state.tasks.some(task => task.id === input.taskId)) return fail('checkin_task_not_found');
      window.state.tasks.find(task => task.id === input.taskId).isRunning = true; return ok(current());
    }
    if (operation === 'cancel-browser-login' || operation === 'cancel-tajiduo') return ok({});
    return fail('client_not_supported');
  },
  subscribe() { return () => {}; }
};
window.mountFixture = async (withTask = false) => {
  window.cleanup?.(); await window.scope?.dispose();
  window.calls = []; window.saves = []; window.state = structuredClone(model); window.editors = new Map(); window.configured = new Map();
  window.confirmed = false; window.isLocal = false; window.saveFailure = ''; window.committed.clear(); window.visibility.clear();
  window.credentialSource = 'browser';
  if (withTask) {
    const id = taskId(); window.state.tasks = [{ id, name: 'fixture-task', remark: '', enabled: true, games: { kuro: ['ww'] }, schedules: [],
      notification: { enabled: false, notificationTaskIds: [] }, isRunning: false, nextRunAt: null, recentRun: null, runs: [] }];
    window.configured.set(id, { kuro: true });
  }
  window.scope = new ExtensionScope(); const routes = [];
  await createFrontend(transport).activate({ extensionId: 'game-checkin', scope: window.scope, locale: 'zh-CN', appearance: 'dark', translate: key => key,
    registerRoute(route) { routes.push(route); }, registerSurface() {}, registerStyle() {}, onLocaleChanged: () => () => {} });
  window.fixtureSurface = new FixtureSurface(document.querySelector('#app'), window.scope, window.visibility);
  window.cleanup = await routes.find(route => route.id === 'game-checkin.tasks').mount(window.fixtureSurface);
};
await window.mountFixture();
