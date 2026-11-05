import type { ExtensionSurface, UiElement } from '@nexuspipeline/extension-sdk';
import { button, createPanel } from '../../../frontend-ui/src/elements.js';
import { createModal, type PluginModal } from '../../../frontend-ui/src/modal.js';
import type { Translate } from '../../../frontend-ui/src/localize.js';
import type { CheckInPorts, CheckInState, CheckInTask, TaskDraft, SecretAction } from './ports.js';
import { CredentialFields } from './credential-fields.js';
import { taskFields } from './editor-fields.js';
import { createIdentity } from '../../../frontend-ui/src/identity.js';

export async function openTaskEditor(
  surface: ExtensionSurface,
  ports: CheckInPorts,
  state: CheckInState,
  task: CheckInTask | undefined,
  saved: (next: CheckInState) => void,
  t: Translate
) {
  let visible = surface.visible,
    modal: PluginModal | undefined,
    credentials: CredentialFields | undefined;
  const visibility = surface.onVisibilityChanged((value) => {
    visible = value;
    credentials?.visibility(value);
    modal?.setVisible(value);
  });
  let editor;
  try {
    editor = await ports.openEditor(task?.id, surface.signal, state.configurationRevision);
  } catch (error) {
    visibility();
    throw error;
  }
  if (surface.signal.aborted) {
    visibility();
    await ports.closeEditor(editor.editorSessionId);
    return () => {};
  }
  task = editor.task ?? task;
  let closed = false,
    busy = false,
    pending: { operationId: string; committed: boolean } | undefined,
    lease: ReturnType<typeof setInterval> | undefined;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(lease);
    visibility();
    credentials?.dispose();
    void ports.closeEditor(editor.editorSessionId).catch(() => {});
  };
  const title = task ? '编辑签到任务' : '新建签到任务';
  const owner = createPanel(surface, title, t);
  owner.card.classList.add('checkin-modal-owner');
  owner.card.querySelector('h3')?.remove();
  owner.body.hidden = true;
  modal = createModal(
    owner,
    title,
    false,
    cleanup,
    () => {
      cleanup();
      owner.cleanup();
    },
    visible
  );
  const dialog = modal;
  dialog.element.className = 'checkin-editor';
  dialog.body.className = 'checkin-edit-body';
  const panel = { ...owner, confirmationHost: dialog.body, signal: dialog.signal, alive: () => dialog.alive() && !closed && visible };
  panel.run = async (action) => {
    if (!panel.alive()) return;
    try {
      await action();
    } catch (error) {
      if (panel.alive()) owner.say(error instanceof Error ? error.message : '签到任务保存失败。', true);
    }
  };
  dialog.body.prepend(owner.status);
  const draft: TaskDraft = task
    ? {
        id: task.id,
        name: task.name,
        remark: task.remark,
        enabled: task.enabled,
        games: structuredClone(task.games),
        schedules: structuredClone(task.schedules),
        notification: structuredClone(task.notification)
      }
    : {
        name: '',
        remark: '',
        enabled: true,
        games: {},
        schedules: [],
        notification: { enabled: false, notificationTaskIds: [] }
      };
  credentials = new CredentialFields(panel, ports, editor, visible);
  taskFields(panel, dialog.body, state, draft, credentials);
  if (!visible) credentials.visibility(false);
  const save = button(panel, dialog.footer, '保存', async () => {
    if (busy || pending) return;
    validate(draft, state);
    const command = structuredClone(draft);
    let secrets: Record<string, SecretAction> = {};
    busy = true;
    dialog.element.locked = true;
    save.busy = true;
    dialog.body.inert = true;
    try {
      if (ports.prepareSave) {
        await credentials!.waitForPending();
        credentials!.synchronize(await ports.prepareSave(editor.editorSessionId, dialog.signal));
      }
      secrets = credentials!.prepare();
      pending = { operationId: createIdentity(), committed: false };
      const next = await ports.saveTask(pending.operationId, command, editor.editorSessionId, secrets, dialog.signal);
      if (!closed && dialog.alive()) {
        saved(next);
        dialog.close();
      }
    } catch (error) {
      const uncertain = (error as { uncertain?: boolean }).uncertain === true;
      if (uncertain) credentials!.clearPlaintext();
      if (!uncertain) pending = undefined;
      save.disabled = !!pending;
      check.hidden = !pending;
      if (!closed)
        owner.say(
          uncertain
            ? '保存结果待确认，请保留草稿并读取原操作结果。'
            : error instanceof Error
              ? error.message
              : '签到任务保存失败。',
          true
        );
    } finally {
      for (const secret of Object.values(secrets)) if (secret.value !== undefined) secret.value = '';
      busy = false;
      save.busy = false;
      dialog.element.locked = false;
      dialog.body.inert = !!pending;
    }
  }) as UiElement<'nexus-button'>;
  const check = button(panel, dialog.footer, '检查保存结果', async () => {
    if (busy || !pending) return;
    busy = true;
    check.busy = true;
    dialog.element.locked = true;
    try {
      if (!pending.committed) pending.committed = await ports.readPublication(pending.operationId, dialog.signal);
      if (!pending.committed) {
        owner.say('保存结果仍待确认，请保留草稿并稍后检查。', true);
        return;
      }
      owner.say('已提交，正在刷新。');
      const next = await ports.readState(dialog.signal);
      if (!closed && dialog.alive()) {
        saved(next);
        dialog.close();
      }
    } catch {
      if (!closed) owner.say(pending.committed ? '已提交，刷新失败，请再次检查。' : '保存结果仍待确认，请稍后检查。', true);
    } finally {
      busy = false;
      check.busy = false;
      dialog.element.locked = false;
    }
  }) as UiElement<'nexus-button'>;
  check.hidden = true;
  save.tone = 'info';
  const cancel = button(panel, dialog.footer, '取消', () => {
    if (!busy) dialog.close();
  }) as UiElement<'nexus-button'>;
  save.style.minWidth = cancel.style.minWidth = '80px';
  dialog.element.append(dialog.footer);
  lease = setInterval(() => {
    if (!closed)
      void ports.leaseEditor(editor.editorSessionId, dialog.signal).catch((error) => {
        if (!closed && visible)
          owner.say(error instanceof Error ? error.message : '编辑会话已失效，请关闭后重新编辑。', true);
      });
  }, 60_000);
  return dialog.close;
}

function validate(draft: TaskDraft, state: CheckInState): void {
  const name = draft.name.trim();
  if (!name || name.length > 100) throw new Error('请输入不超过 100 个字符的任务名称');
  if (
    state.tasks.some(
      (item) => item.id !== draft.id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    )
  )
    throw new Error('签到任务名称已存在');
  if (new TextEncoder().encode(draft.remark).length > 512) throw new Error('备注不能超过 512 字节');
  if (draft.enabled && !Object.values(draft.games).some(games => games.length)) throw new Error('请选择至少一个签到游戏');
  for (const schedule of draft.schedules) {
    const parts = schedule.time.split(':').map(Number);
    if (
      !schedule.days.length ||
      schedule.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
      new Set(schedule.days).size !== schedule.days.length ||
      !/^\d{2}:\d{2}$/.test(schedule.time) ||
      parts[0] >= 24 ||
      parts[1] >= 60
    )
      throw new Error('请检查计划时间和执行星期');
  }
  draft.name = name;
  draft.remark = draft.remark.trim();
}
