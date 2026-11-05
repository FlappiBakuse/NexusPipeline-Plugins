import type { FrontendTransport } from '@nexuspipeline/extension-sdk';
import { createIdentity } from '../../../frontend-ui/src/identity.js';
import type { CheckInPorts, CheckInState, CredentialEditor } from './ports.js';

type Reply<T> = { ok: true; value: T } | { ok: false; error: { code: string } };
const errorMessages: Readonly<Record<string, string>> = {
  reveal_confirmation_required: '显示凭据前需要确认。',
  credential_editor_expired: '凭据编辑会话已过期，请重新打开。',
  credential_field_stale: '凭据草稿已更新，请重新打开编辑器。',
  credential_saved_conflict: '任务或凭据已更新，请重新读取。',
  checkin_revision_conflict: '任务或凭据已更新，请重新读取。',
  credential_editor_owner_mismatch: '凭据编辑会话不属于当前客户端。',
  client_not_supported: '当前客户端不支持官方网页登录，请手动填写凭据。'
};

class CheckInError extends Error {
  readonly uncertain: boolean;
  constructor(readonly code: string) { super(errorMessages[code] ?? '签到操作未完成。'); this.uncertain = code === 'checkin_publication_unknown'; }
}

export function transportPorts(transport: FrontendTransport): CheckInPorts {
  const cancellations = new Map<string, Promise<void>>();
  const call = async <T>(operation: string, input: unknown, signal: AbortSignal, write = false, operationId?: string): Promise<T> => {
    const reply = await transport.invoke(operation, input, signal, write ? operationId ?? createIdentity() : undefined) as Reply<T>;
    if (!reply || typeof reply !== 'object' || typeof reply.ok !== 'boolean') throw new CheckInError('checkin_reply_invalid');
    if (!reply.ok) {
      const code = reply.error?.code;
      throw new CheckInError(typeof code === 'string' && /^[a-z][a-z0-9_]{0,127}$/.test(code) ? code : 'checkin_reply_invalid');
    }
    return reply.value;
  };
  const revision = (value: number | undefined): number => {
    if (!Number.isSafeInteger(value) || value! < 0) throw new CheckInError('checkin_configuration_revision_required');
    return value!;
  };
  const state = async (operation: string, input: unknown, signal: AbortSignal, write = false, operationId?: string): Promise<CheckInState> => {
    const result = await call<CheckInState>(operation, input, signal, write, operationId);
    if (!result || !Number.isSafeInteger(result.revision) || !Number.isSafeInteger(result.configurationRevision) ||
        !Array.isArray(result.tasks) || !Array.isArray(result.platforms) || !Array.isArray(result.notificationTasks))
      throw new CheckInError('checkin_state_invalid');
    return result;
  };
  const editor = async (operation: string, input: unknown, signal: AbortSignal, write = false): Promise<CredentialEditor> => {
    const result = await call<CredentialEditor>(operation, input, signal, write);
    if (!result || typeof result.editorSessionId !== 'string' || !Number.isSafeInteger(result.revision) || result.revision! < 0 || !result.fields || typeof result.fields !== 'object')
      throw new CheckInError('credential_editor_invalid');
    return result;
  };
  const cancel = (operation: string, editorSessionId: string, input: unknown): Promise<void> => {
    const pending = (async () => { await call(operation, input, AbortSignal.timeout(5000), true); })();
    const combined = Promise.all([cancellations.get(editorSessionId), pending]).then(() => {});
    cancellations.set(editorSessionId, combined);
    void combined.finally(() => { if (cancellations.get(editorSessionId) === combined) cancellations.delete(editorSessionId); }).catch(() => {});
    return combined;
  };
  const currentEditor = async (editorSessionId: string, signal: AbortSignal) => {
    await cancellations.get(editorSessionId);
    return editor('read-editor', { editorSessionId }, signal);
  };
  return {
    get canReveal() { return transport.connectionKind === 'local'; },
    readState: signal => state('read-state', {}, signal),
    async readPublication(operationId, signal) {
      const result = await call<{ committed: boolean }>('read-publication', { publicationOperationId: operationId }, signal);
      if (!result || typeof result.committed !== 'boolean') throw new CheckInError('checkin_reply_invalid');
      return result.committed;
    },
    async saveTask(operationId, draft, editorSessionId, secrets, signal) {
      try { return await state('save-task', { draft: { ...draft, id: draft.id ?? null }, editorSessionId, secrets }, signal, true, operationId); }
      catch (error) {
        if (error instanceof CheckInError && ['credential_editor_expired', 'credential_editor_owner_mismatch',
          'credential_saved_conflict', 'credential_field_stale', 'credential_task_mismatch', 'checkin_revision_conflict'].includes(error.code)) throw error;
        throw new CheckInError('checkin_publication_unknown');
      }
    },
    deleteTask: (id, signal, expected) => state('delete-task', { taskId: id, expectedRevision: revision(expected) }, signal, true),
    reorderTasks: (ids, signal, expected) => state('reorder-tasks', { taskIds: ids, expectedRevision: revision(expected) }, signal, true),
    runTask: (id, signal) => state('run-task', { taskId: id }, signal, true),
    openEditor: (taskId, signal, expected) => editor('open-editor', { taskId: taskId ?? null, expectedRevision: revision(expected) }, signal, true),
    readEditor: currentEditor,
    prepareSave: currentEditor,
    async leaseEditor(editorSessionId, signal) { await call('lease-editor', { editorSessionId }, signal, true); },
    async closeEditor(editorSessionId) { await call('close-editor', { editorSessionId }, AbortSignal.timeout(5000), true); },
    async confirmReveal(editorSessionId, signal) { await call('confirm-reveal', { editorSessionId }, signal, true); },
    revealCredential: (platformId, editorSessionId, signal) => call('reveal-credential', { platformId, editorSessionId }, signal, true),
    beginBrowserLogin: (platformId, editorSessionId, fieldGeneration, signal) =>
      call('begin-browser-login', { platformId, editorSessionId, fieldGeneration }, signal, true),
    async cancelBrowserLogin(platformId, editorSessionId) {
      await cancel('cancel-browser-login', editorSessionId, { platformId, editorSessionId });
    },
    prepareTajiduo: (editorSessionId, fieldGeneration, signal) => call('prepare-tajiduo', { editorSessionId, fieldGeneration }, signal, true),
    async sendTajiduoCode(operationId, phone, signal) { await call('send-tajiduo-code', { loginOperationId: operationId, phone }, signal, true); },
    loginTajiduo: (operationId, phone, value, mode, editorSessionId, signal) =>
      call('login-tajiduo', { loginOperationId: operationId, phone, value, mode, editorSessionId }, signal, true),
    async cancelTajiduo(operationId, editorSessionId) {
      await cancel('cancel-tajiduo', editorSessionId, { loginOperationId: operationId, editorSessionId });
    }
  };
}
