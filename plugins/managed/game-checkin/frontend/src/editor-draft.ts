import type { EditorDraftScope } from '@nexuspipeline/extension-sdk';
import type { CheckInPorts, CheckInState, CheckInTask, CredentialEditor, SecretAction, TaskDraft } from './ports.js';

interface EditorDraft {
  editor?: CredentialEditor;
  opening?: Promise<CredentialEditor>;
  draft?: TaskDraft;
  baseline?: string;
  busy: boolean;
  pending?: { operationId: string; committed: boolean };
}

export function editorDraft(parent: EditorDraftScope, id: string | undefined, ports: CheckInPorts) {
  const scope = parent.child(id || 'new');
  const state = scope.retain('editor', () => {
    const state: EditorDraft = { busy: false };
    scope.guardCancel(() => !state.busy && !state.pending);
    scope.onSettled(() => {
      if (state.editor) void ports.closeEditor(state.editor.editorSessionId)
        .catch(() => console.error('checkin_editor_cleanup_unavailable'));
    });
    return state;
  });
  return { scope, state };
}

export async function openDraft(scope: EditorDraftScope, state: EditorDraft, ports: CheckInPorts,
  catalog: CheckInState, task?: CheckInTask): Promise<CredentialEditor> {
  if (!state.editor) {
    state.busy = true;
    state.opening ??= ports.openEditor(task?.id, scope.signal, catalog.configurationRevision).then(editor => {
      state.editor = editor;
      return editor;
    }).finally(() => { state.busy = false; state.opening = undefined; scope.changed(); });
    await state.opening;
  }
  return state.editor!;
}

export function credentialDraft(scope: EditorDraftScope) {
  return scope.protect('credentials', () => ({ inputs: new Map<string, string>(), actions: new Map<string, SecretAction>() }), draft => {
    for (const key of draft.inputs.keys()) draft.inputs.set(key, '');
    for (const action of draft.actions.values()) if (action.value !== undefined) action.value = '';
    draft.inputs.clear(); draft.actions.clear();
  });
}

export function credentialActions(inputs: ReadonlyMap<string, string>, actions: ReadonlyMap<string, SecretAction>,
  editor: CredentialEditor): Record<string, SecretAction> {
  const prepared: Record<string, SecretAction> = Object.fromEntries(
    Object.entries(editor.fields).map(([id, field]) => [
    id,
    { action: 'keep', fieldGeneration: field.fieldGeneration }
    ])
  );
  Object.assign(prepared, Object.fromEntries(actions));
  for (const [id, value] of inputs)
    if (value)
    prepared[id] = {
      action: 'set',
      value,
      fieldGeneration: editor.fields[id]?.fieldGeneration || 0
    };
  return prepared;
}
