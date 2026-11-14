import { draftPresentation } from '../../../frontend-ui/src/draft-presentation.js';
import { bindLocale } from '../../../frontend-ui/src/localize.js';
import { button, choice, field, paragraph, type Panel } from '../../../frontend-ui/src/elements.js';
import { createModal } from '../../../frontend-ui/src/modal.js';
import type { CheckInPorts, CredentialEditor } from './ports.js';
import type { UiElement } from '@nexuspipeline/extension-sdk';

export async function openTajiduo(
  panel: Panel,
  ports: CheckInPorts,
  editor: CredentialEditor,
  generation: number,
  callbacks: {
    current: () => boolean;
    accept: (candidateId: string, platformId: string, current: () => boolean) => Promise<boolean>;
    closed: () => void;
  }
) {
  const scope = panel.drafts.child('tajiduo-login');
  const presentation = draftPresentation(scope, false, panel.t);
  const draft = scope.protect('input', () => ({ phone: '', mode: 'sms' as 'sms' | 'password',
    values: { sms: '', password: '' }, sentAt: null as number | null }), value => {
    value.phone = ''; value.values.sms = ''; value.values.password = ''; value.sentAt = null;
  });
  presentation.edited = () => !!draft.phone || !!draft.values.sms || !!draft.values.password || draft.mode !== 'sms';
  const prepared = await ports.prepareTajiduo(editor.editorSessionId, generation, panel.signal);
  if (!panel.alive() || !callbacks.current()) {
    await ports.cancelTajiduo(prepared.operationId, editor.editorSessionId);
    return () => {};
  }
  let closed = false,
    accepted = false;
  let phone: ReturnType<typeof field> | undefined, value: ReturnType<typeof field> | undefined;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (phone) phone.value = '';
    if (value) value.value = '';
    if (!accepted) void ports.cancelTajiduo(prepared.operationId, editor.editorSessionId).catch(() => {});
    callbacks.closed();
  };
  const modal = createModal(panel, '塔吉多登录', false, reason => {
    if (reason === 'cancel') scope.settle('cancel');
    cleanup();
  }, cleanup);
  modal.element.className = 'checkin-login-modal';
  modal.element.size = 'normal';
  modal.body.className = 'checkin-login';
  presentation.attach(modal.body);
  modal.signal.addEventListener('abort', () => presentation.detach(), { once: true });
  const child = { ...panel, signal: modal.signal, alive: () => panel.alive() && modal.alive() };
  let busy = false;
  const status = document.createElement('p');
  status.hidden = true;
  child.run = async (action) => {
    try {
      await action();
    } catch (error) {
      if (child.alive()) {
        status.hidden = false;
        status.setAttribute('role', 'alert');
        bindLocale(panel.t, panel.signal, status, 'textContent', () => {
          status.textContent = panel.t(
            error instanceof Error && error.message === 'code_request_throttled'
              ? '60 秒内请勿重复发送验证码'
              : '登录未完成，请检查信息、网络或官方账号状态后重试。'
          );
        });
      }
    }
  };
  paragraph(
    modal.body,
    panel.t('通过官方账号接口登录。输入草稿仅留在内存，取消或结束界面会话时清除；登录后请保存签到任务使凭据生效。')
  );
  const mode = choice(
    child,
    modal.body,
    '登录方式',
    draft.mode,
    [
      { value: 'sms', label: '短信验证码' },
      { value: 'password', label: '密码' }
    ],
    () => {
      draft.mode = mode.value as 'sms' | 'password';
      if (value) {
        value.value = draft.values[draft.mode];
        const label = mode.value === 'sms' ? '短信验证码' : '密码';
        bindLocale(panel.t, panel.signal, value, 'aria-label', () => {
          value!.setAttribute('aria-label', panel.t(label));
        });
        bindLocale(panel.t, panel.signal, value.parentElement!.querySelector('span')!, 'textContent', () => {
          value!.parentElement!.querySelector('span')!.textContent = panel.t(label);
        });
      }
      send.hidden = mode.value !== 'sms';
      status.hidden = true;
    }
  );
  phone = field(child, modal.body, '手机号', draft.phone, value => { draft.phone = value; }, 'tel');
  value = field(child, modal.body, draft.mode === 'sms' ? '短信验证码' : '密码', draft.values[draft.mode], value => { draft.values[draft.mode] = value; }, 'password');
  const setBusy = (next: boolean) => {
    busy = next;
    (mode as UiElement<'nexus-select'>).toggleAttribute('inert', next);
    (phone as UiElement<'nexus-text-input'>).disabled = next;
    (value as UiElement<'nexus-text-input'>).disabled = next;
    (send as UiElement<'nexus-button'>).disabled = next;
    (submit as UiElement<'nexus-button'>).disabled = next;
    bindLocale(panel.t, panel.signal, submit, 'textContent', () => {
      submit.textContent = panel.t(next ? '正在登录…' : '登录');
    });
  };
  const send = button(child, modal.body, '发送验证码', async () => {
    if (busy || mode.value !== 'sms') return;
    if (draft.sentAt !== null && Date.now() - draft.sentAt < 60_000) throw new Error('code_request_throttled');
    setBusy(true);
    try {
      await ports.sendTajiduoCode(prepared.operationId, phone!.value.trim(), modal.signal);
      if (!child.alive() || !callbacks.current()) return;
      draft.sentAt = Date.now();
      status.hidden = false;
      status.setAttribute('role', 'status');
      bindLocale(panel.t, panel.signal, status, 'textContent', () => {
        status.textContent = panel.t('验证码已发送，请输入收到的验证码。60 秒内请勿重复发送。');
      });
    } finally {
      if (child.alive()) setBusy(false);
    }
  });
  send.hidden = draft.mode !== 'sms';
  modal.body.append(status);
  button(child, modal.footer, '取消', () => modal.close('cancel'));
  const submit = button(child, modal.footer, '登录', async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await ports.loginTajiduo(
        prepared.operationId,
        phone!.value.trim(),
        value!.value,
        mode.value as 'sms' | 'password',
        editor.editorSessionId,
        modal.signal
      );
      if (closed || !child.alive() || !callbacks.current()) {
        await ports.cancelTajiduo(prepared.operationId, editor.editorSessionId);
        return;
      }
      if (
        !(await callbacks.accept(
          result.candidateId,
          result.platformId || 'tajiduo',
          () => !closed && child.alive() && callbacks.current()
        ))
      ) {
        await ports.cancelTajiduo(prepared.operationId, editor.editorSessionId);
        return;
      }
      accepted = true;
      scope.settle('saved');
      modal.close('saved');
    } finally {
      if (child.alive()) setBusy(false);
    }
  });
  (submit as UiElement<'nexus-button'>).tone = 'info';
  modal.element.append(modal.footer);
  return modal.close;
}
