import { bindLocale } from '../../../frontend-ui/src/localize.js';
import type { UiElement } from '@nexuspipeline/extension-sdk';
import { button, confirm, type Panel } from '../../../frontend-ui/src/elements.js';
import type { CheckInPlatform, CheckInPorts, CredentialEditor, SecretAction } from './ports.js';
import { openTajiduo } from './tajiduo-login.js';

const placeholders: Record<string, string> = {
  cn: '米游社 CookieToken 与同版本账号字段',
  os: 'HoYoLAB 完整 Cookie，需含 ltoken、ltuid',
  skland: '森空岛 APP 抓取的鹰角通行证 Token',
  skport: '终末地国际服 / SKPORT 通行证 Token',
  kuro: '库街区 APP 抓包获取的 token',
  tajiduo: '塔吉多原生凭据 JSON'
};
interface FieldRow {
  element: HTMLElement;
  platform: CheckInPlatform;
  owner: AbortController;
}
interface SecretJob {
  owner: AbortController;
  browser: boolean;
}

export class CredentialFields {
  private readonly inputs = new Map<string, string>();
  private readonly stored = new Map<string, string>();
  private readonly revealed = new Set<string>();
  private readonly actions = new Map<string, SecretAction>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly rows = new Map<string, FieldRow>();
  private readonly revisions = new Map<string, number>();
  private readonly jobs = new Map<string, SecretJob>();
  private readonly children = new Set<() => void>();
  private epoch = 0;
  private pendingMetadata = 0;
  private metadataIdle: Promise<void> = Promise.resolve();
  constructor(
    private readonly panel: Panel,
    private readonly ports: CheckInPorts,
    public editor: CredentialEditor,
    private visible = true
  ) {}

  mount(parent: HTMLElement, platform: CheckInPlatform): void {
    const element = document.createElement('div');
    element.className = 'checkin-credential';
    parent.append(element);
    this.rows.set(platform.id, { element, platform, owner: new AbortController() });
    this.draw(platform.id);
  }
  private current(id: string, epoch: number, revision: number): boolean {
    return (
      this.panel.alive() && this.visible && epoch === this.epoch && revision === (this.revisions.get(id) || 0)
    );
  }
  private applyEditor(next: CredentialEditor): void {
    if (typeof next.revision === 'number' && typeof this.editor.revision === 'number' && next.revision < this.editor.revision) return;
    this.editor = next;
  }
  synchronize(next: CredentialEditor): void {
    this.applyEditor(next);
    for (const [id, action] of this.actions) {
      const field = this.editor.fields[id];
      if (field && action.candidateId && action.candidateId !== field.candidateId) this.actions.delete(id);
      else if (field) this.actions.set(id, { ...action, fieldGeneration: field.fieldGeneration });
    }
  }
  waitForPending(): Promise<void> { return this.metadataIdle; }
  private change(id: string): void {
    this.revisions.set(id, (this.revisions.get(id) || 0) + 1);
    const job = this.jobs.get(id);
    job?.owner.abort();
    this.jobs.delete(id);
    if (job?.browser) void this.cancelLogin(id);
  }
  private async cancelLogin(id: string): Promise<void> {
    this.pendingMetadata++;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    this.metadataIdle = Promise.all([this.metadataIdle, pending]).then(() => {});
    const epoch = this.epoch;
    try {
      await this.ports.cancelBrowserLogin(id, this.editor.editorSessionId);
      const next = await this.ports.readEditor(this.editor.editorSessionId, this.panel.signal);
      if (this.panel.signal.aborted || epoch !== this.epoch) return;
      this.synchronize(next);
      if (this.visible) this.draw(id);
    } catch {
      if (this.panel.alive()) this.panel.say('凭据状态读取失败，请重新打开编辑器。', true);
    } finally { this.pendingMetadata--; release(); }
  }
  private draw(id: string): void {
    const row = this.rows.get(id);
    if (!row) return;
    row.owner.abort();
    row.owner = new AbortController();
    row.element.replaceChildren();
    const signal = AbortSignal.any([this.panel.signal, row.owner.signal]),
      panel = { ...this.panel, signal };
    const current = this.editor.fields[id],
      clear = this.actions.get(id)?.action === 'clear';
    const label = document.createElement('label');
    label.className = 'checkin-label';
    const caption = document.createElement('span');
    bindLocale(panel.t, panel.signal, caption, 'textContent', () => {
      caption.textContent = panel.t(row.platform.name) + ' ' + panel.t('凭据');
    });
    const controls = document.createElement('div');
    controls.className = 'checkin-credential-controls';
    const inputWrap = document.createElement('div');
    inputWrap.className = 'checkin-credential-input';
    const input = document.createElement('nexus-text-input') as UiElement<'nexus-text-input'>;
    let shown = this.revealed.has(id);
    input.type = shown ? 'text' : 'password';
    input.value = this.inputs.get(id) ?? this.stored.get(id) ?? '';
    bindLocale(panel.t, panel.signal, input, 'placeholder', () => {
      input.placeholder = panel.t(
        clear ? '将在保存后清除' : current?.configured ? '已配置，点击眼睛显示' : placeholders[id] || '凭据'
      );
    });
    input.readOnly = current?.source === 'browser' && !shown && !clear && !this.inputs.has(id);
    bindLocale(panel.t, panel.signal, input, 'aria-label', () => {
      input.setAttribute('aria-label', panel.t(row.platform.name) + ' ' + panel.t('凭据'));
    });
    const eye = document.createElement('nexus-icon-button') as UiElement<'nexus-icon-button'>;
    bindLocale(panel.t, panel.signal, eye, 'label', () => {
      eye.label = panel.t(shown ? '隐藏凭据' : '显示凭据');
    });
    eye.className = 'checkin-secret-eye';
    const icon = document.createElement('nexus-icon') as UiElement<'nexus-icon'>;
    icon.name = 'eye';
    icon.slot = 'icon';
    eye.append(icon);
    eye.hidden = !current?.configured && !input.value;
    eye.disabled = !!current?.configured && !input.value && !this.ports.canReveal;
    input.addEventListener(
      'nexus-change',
      (event) => {
        this.change(id);
        this.inputs.set(id, (event as CustomEvent<{ value: string }>).detail.value);
        this.stored.delete(id);
        clearTimeout(this.timers.get(id));
        this.timers.delete(id);
        eye.hidden = !current?.configured && !input.value;
        eye.disabled = !!current?.configured && !input.value && !this.ports.canReveal;
      },
      { signal }
    );
    eye.addEventListener(
      'click',
      () => {
        void panel.run(async () => {
          if (!shown && !input.value) {
            await this.read(id);
            return;
          }
          shown = !shown;
          if (shown) this.revealed.add(id);
          else this.revealed.delete(id);
          input.type = shown ? 'text' : 'password';
          bindLocale(panel.t, panel.signal, eye, 'label', () => {
            eye.label = panel.t(shown ? '隐藏凭据' : '显示凭据');
          });
        });
      },
      { signal }
    );
    inputWrap.append(input, eye);
    controls.append(inputWrap);
    label.append(caption, controls);
    row.element.append(label);
    if (current?.configured) {
      const control = button(panel, controls, clear ? '将在保存后清除' : '清除已保存凭据', () => {
        this.change(id);
        this.inputs.delete(id);
        this.stored.delete(id);
        this.revealed.delete(id);
        clearTimeout(this.timers.get(id));
        this.timers.delete(id);
        this.actions.set(id, { action: 'clear', fieldGeneration: current.fieldGeneration });
        this.draw(id);
      }) as UiElement<'nexus-button'>;
      control.disabled = clear;
      bindLocale(panel.t, panel.signal, control, 'aria-label', () => {
        control.setAttribute('aria-label', panel.t(row.platform.name) + ' · ' + panel.t('清除已保存凭据'));
      });
    }
    if (row.platform.browserLogin?.ready)
      button(panel, controls, id === 'tajiduo' ? '塔吉多登录' : '浏览器登录', () => this.login(id));
  }
  private async read(id: string): Promise<void> {
    if (!this.ports.canReveal) return;
    this.change(id);
    const epoch = this.epoch,
      revision = this.revisions.get(id) || 0,
      owner = new AbortController();
    this.jobs.set(id, { owner, browser: false });
    const signal = AbortSignal.any([this.panel.signal, owner.signal]);
    try {
      if (!(await confirm(this.panel,
        this.panel.t('凭据可用于访问账号。确认后仅当前客户端可在24小时内显示，关闭编辑器会清除已显示内容。')))) return;
      if (!this.current(id, epoch, revision)) return;
      await this.ports.confirmReveal(this.editor.editorSessionId, signal);
      const result = await this.ports.revealCredential(id, this.editor.editorSessionId, signal);
      if (!this.current(id, epoch, revision)) return;
      this.stored.set(id, result.value);
      this.revealed.add(id);
      this.draw(id);
      clearTimeout(this.timers.get(id));
      this.timers.set(
        id,
        setTimeout(
          () => {
            this.stored.delete(id);
            this.revealed.delete(id);
            this.timers.delete(id);
            if (this.panel.alive() && this.visible) this.draw(id);
          },
          Math.max(1, Math.min(60, result.remainingSeconds)) * 1000
        )
      );
    } catch {
      if (this.current(id, epoch, revision))
        this.panel.say('凭据读取失败；可保留、重新输入或清除。', true);
    } finally {
      if (this.jobs.get(id)?.owner === owner) this.jobs.delete(id);
    }
  }
  private async accept(
    id: string,
    candidateId: string,
    current: () => boolean,
    generation?: number
  ): Promise<boolean> {
    const next = await this.ports.readEditor(this.editor.editorSessionId, this.panel.signal);
    if (!current()) return false;
    this.applyEditor(next);
    if (typeof this.editor.revision === 'number' && (this.editor.fields[id]?.candidateId !== candidateId ||
      generation !== undefined && generation !== this.editor.fields[id]?.fieldGeneration)) return false;
    this.inputs.delete(id);
    this.stored.delete(id);
    this.revealed.delete(id);
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.actions.set(id, {
      action: 'set',
      candidateId,
      fieldGeneration: generation ?? next.fields[id]?.fieldGeneration ?? 0
    });
    this.draw(id);
    return true;
  }
  private async login(id: string): Promise<void> {
    this.change(id);
    if (this.ports.prepareSave && this.pendingMetadata) throw new Error('请等待登录窗口关闭。');
    const epoch = this.epoch,
      revision = this.revisions.get(id) || 0,
      generation = this.editor.fields[id]?.fieldGeneration || 0;
    if (id === 'tajiduo') {
      let close: (() => void) | undefined;
      close = await openTajiduo(this.panel, this.ports, this.editor, generation, {
        current: () => this.current(id, epoch, revision),
        accept: (candidate, platform, current) => this.accept(platform, candidate, current),
        closed: () => {
          if (close) this.children.delete(close);
        }
      });
      if (this.current(id, epoch, revision)) this.children.add(close);
      else close();
      return;
    }
    const owner = new AbortController();
    this.jobs.set(id, { owner, browser: true });
    try {
      const result = await this.ports.beginBrowserLogin(
        id,
        this.editor.editorSessionId,
        generation,
        AbortSignal.any([this.panel.signal, owner.signal])
      );
      if (!this.current(id, epoch, revision)) {
        await this.ports.cancelBrowserLogin(id, this.editor.editorSessionId);
        return;
      }
      if (
        !(await this.accept(
          id,
          result.candidateId,
          () => this.current(id, epoch, revision),
          result.fieldGeneration
        ))
      )
        await this.ports.cancelBrowserLogin(id, this.editor.editorSessionId);
    } finally {
      if (this.jobs.get(id)?.owner === owner) this.jobs.delete(id);
    }
  }
  prepare(): Record<string, SecretAction> {
    if (this.ports.prepareSave && (this.pendingMetadata || [...this.jobs.values()].some(job => job.browser))) throw new Error('请等待登录窗口关闭。');
    const prepared: Record<string, SecretAction> = Object.fromEntries(
      Object.entries(this.editor.fields).map(([id, field]) => [
        id,
        { action: 'keep', fieldGeneration: field.fieldGeneration }
      ])
    );
    Object.assign(prepared, Object.fromEntries(this.actions));
    for (const [id, value] of this.inputs)
      if (value)
        prepared[id] = {
          action: 'set',
          value,
          fieldGeneration: this.editor.fields[id]?.fieldGeneration || 0
        };
    return prepared;
  }
  private forgetValues(): void {
    this.epoch++;
    this.inputs.clear();
    this.stored.clear();
    this.revealed.clear();
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
  clearPlaintext(): void {
    this.forgetValues();
    for (const id of this.rows.keys()) this.draw(id);
  }
  visibility(visible: boolean): void {
    this.visible = visible;
    if (!visible) {
      this.forgetValues();
      for (const [id, job] of this.jobs) {
        job.owner.abort();
        if (job.browser) void this.cancelLogin(id);
      }
      this.jobs.clear();
      for (const close of this.children) close();
      this.children.clear();
    }
    for (const id of this.rows.keys()) this.draw(id);
  }
  dispose(): void {
    this.visibility(false);
    this.actions.clear();
    for (const row of this.rows.values()) row.owner.abort();
    this.rows.clear();
  }
}
