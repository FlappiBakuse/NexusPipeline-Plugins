import type { ExtensionSurface, UiElement } from '@nexuspipeline/extension-sdk';
import { button, choice, createPanel, paragraph, type Panel } from '../../../frontend-ui/src/elements.js';
import { watchLocale, type Translate } from '../../../frontend-ui/src/localize.js';
import type { MaaEditorState, MaaPorts, MaaProfile, MaaSchema } from './ports.js';
import { drawSchema, clearSchemaSecrets } from './schema-view.js';
import { resetPackageRoot } from './maa-profile.js';
import { MaaFields } from './maa-fields.js';
import { defaultTasks } from './task-fields.js';
import { MaaImport } from './maa-import.js';
import { MaaSave } from './maa-save.js';
import { MaaSources } from './maa-sources.js';
import { secretEdits, MaaSecretDrafts } from './secret-drafts.js';
import { drawRuntime } from './runtime-inputs.js';

export class MaaEditor {
  private readonly panel: Panel;
  private view: Panel;
  private renderOwner = new AbortController();
  private readonly fields: MaaFields;
  private readonly output = document.createElement('pre');
  private readonly secrets = new MaaSecretDrafts();
  private readonly visibility: () => void;
  private editor: MaaEditorState | undefined;
  private profile: MaaProfile | undefined;
  private schema: MaaSchema | undefined;
  private readonly sources = new MaaSources();
  private preset = '';
  private readonly imports: MaaImport;
  private preview: unknown;
  private previewProfile = '';
  private version = 0;
  private advanced = false;
  private visible: boolean;
  private readonly saver: MaaSave;

  constructor(
    private readonly surface: ExtensionSurface,
    private readonly ports: MaaPorts,
    t: Translate
  ) {
    this.panel = createPanel(surface, 'MaaFramework', t);
    this.panel.card.classList.add('maa-editor');
    this.view = this.panel;
    this.saver = new MaaSave(this.panel, surface, ports);
    this.fields = new MaaFields(this.panel, () => this.changed());
    this.imports = new MaaImport(
      this.panel,
      ports,
      this.output,
      () => this.profile!,
      () => this.version,
      (version) => this.current(version),
      () => this.fields.check(),
      (profile) => {
        const replaced = this.profile !== profile;
        this.profile = profile;
        if (replaced) { this.fields.clear(); clearSchemaSecrets(this.panel.body, this.secrets); }
        this.changed(replaced);
      }
    );
    this.visible = surface.visible;
    this.output.className = 'maa-output';
    this.panel.card.append(this.output);
    this.visibility = surface.onVisibilityChanged((value) => {
      this.visible = value;
      if (!value) clearSchemaSecrets(this.panel.body, this.secrets);
    });
    this.draw();
    watchLocale(t, this.panel.signal, () => {
      clearSchemaSecrets(this.panel.body, this.secrets);
    });
    void this.panel.run(() => this.start());
  }
  private async start(): Promise<void> {
    const next = await this.ports.readEditor(this.surface.context, this.panel.signal);
    if (!this.panel.alive()) return;
    if (!next) {
      this.panel.body.replaceChildren();
      paragraph(this.panel.body, this.panel.t('当前编辑区没有 Maa 配置'));
      return;
    }
    this.editor = next;
    this.profile = structuredClone(next.profile);
    this.sources.id = next.sourceId || '';
    this.imports.initialize(next.mode);
    this.sources.confirmed = Boolean(this.profile.revision);
    if (next.packageRoot && next.packageRoot.toLowerCase() !== this.profile.packageRoot.toLowerCase())
      this.resetRoot(next.packageRoot);
    this.draw();
    if (next.mode === 'script') await this.discover();
  }
  private resetRoot(root: string): void {
    clearSchemaSecrets(this.panel.body, this.secrets);
    resetPackageRoot(this.profile!, root);
    this.schema = undefined;
    this.sources.discovery = undefined;
    this.sources.id = '';
    this.sources.confirmed = false;
    this.fields.clear();
    this.changed();
  }
  private changed(redraw = false): void {
    if (!this.profile) return;
    this.version++;
    this.preview = undefined;
    this.previewProfile = '';
    this.imports.invalidate();
    this.output.textContent = '';
    this.ports.publishDraft(this.surface.context, structuredClone(this.profile), this.sources.id);
    if (redraw) this.draw();
  }
  private current(version: number): boolean {
    if (!this.panel.alive()) return false;
    if (version !== this.version) throw Error('草稿已变化，请重新执行此操作');
    this.fields.check();
    return true;
  }
  private async discover(): Promise<void> {
    if (!this.profile?.packageRoot) return;
    const version = this.version,
      profile = this.profile;
    const path =
      this.advanced || (this.sources.discovery?.interfaceCandidates.length && this.sources.confirmed)
        ? profile.interfacePath
        : profile.sourceBinding?.interfaceRelativePath || '';
    const next = await this.ports.discover(profile.packageRoot, path, this.panel.signal);
    if (!this.current(version)) return;
    this.sources.accept(profile, next);
    this.schema = next.schema;
    this.draw();
    this.ports.publishDraft(this.surface.context, structuredClone(profile), this.sources.id);
  }

  private draw(): void {
    this.renderOwner.abort();
    this.renderOwner = new AbortController();
    const signal = AbortSignal.any([this.panel.signal, this.renderOwner.signal]);
    const panel = { ...this.panel, signal, alive: () => this.panel.alive() && !signal.aborted };
    this.view = panel;
    this.fields.begin(signal);
    const { profile, editor } = this;
    panel.body.replaceChildren();
    if (!profile || !editor) {
      paragraph(panel.body, panel.t('正在读取 Maa 配置…'));
      return;
    }
    if (editor.providerId !== 'maa-framework') {
      paragraph(panel.body, panel.t('此编辑区属于其他执行提供者'));
      return;
    }
    const fields = document.createElement('div');
    fields.className = 'maa-fields';
    panel.body.append(fields);
    if (editor.mode === 'script') {
      if (!this.sources.draw(panel, fields, profile, () => this.changed(), () => this.discover())) {
        this.scriptActions();
        this.projectActions(fields);
        return;
      }
      if (!this.advanced) {
        this.scriptActions();
        this.projectActions(fields);
        return;
      }
    }
    else if (this.sources.discovery) this.sources.draw(panel, fields, profile, () => this.changed(), () => this.discover());
    this.imports.draw(panel, fields, editor);
    drawRuntime(panel, fields, profile, redraw => this.changed(redraw));
    if (this.schema)
      drawSchema(
        panel,
        fields,
        this.schema,
        profile,
        (redraw) => this.changed(redraw),
        this.secrets,
        () => this.visible && this.profile === profile,
        this.fields,
        {
          name: this.preset,
          select: (value) => {
            this.preset = value;
            this.version++;
          }
        },
        editor.mode !== 'script'
      );
    if (editor.mode === 'script') this.scriptActions();
    this.projectActions(fields);
    this.output.hidden = false;
  }
  private scriptActions(): void {
    const actions = document.createElement('div');
    actions.className = 'maa-actions';
    this.panel.body.append(actions);
    button(this.view, actions, '高级设置', () => {
      this.advanced = !this.advanced;
      this.draw();
    });
    button(this.view, actions, '重新查找来源', () => this.discover());
    this.output.hidden = false;
  }
  private projectActions(fields: HTMLElement): void {
    const panel = this.view,
      actions = document.createElement('div');
    actions.className = 'maa-actions';
    panel.body.append(actions);
    button(panel, actions, '读取项目', () => this.inspect());
    button(panel, actions, '只读执行预览', () => this.executionPreview());
    button(panel, actions, '应用所选预设到草稿', () => this.applyPreset());
    button(panel, actions, '载入项目默认勾选任务', () => {
      this.fields.check();
      if (!this.schema) throw Error('请先读取项目');
      defaultTasks(this.schema, this.profile!);
      this.fields.clear();
      this.changed(true);
    });
    button(panel, actions, '查找并选择 Win32 窗口', () => this.selectWindow(fields));
    button(panel, actions, '预览显式导入', () => this.imports.preview());
    button(panel, actions, '使用已预览映射', () => this.imports.apply());
    const save = button(panel, actions, this.editor?.mode === 'script' ? '保存脚本项目配置' : '保存用户配置', () => this.save(save)) as UiElement<'nexus-button'>;
    save.disabled = this.saver.uncertain;
    button(panel, actions, '读取原保存结果', async () => {
      try {
        await this.saver.read();
        if (!this.saver.uncertain && this.profile) {
          const state = await this.ports.readEditor(this.surface.context, this.panel.signal);
          if (state && this.panel.alive()) { this.profile.protectedInputs = state.profile.protectedInputs; this.secrets.refresh(); }
        }
      } finally { save.disabled = this.saver.uncertain; }
    });
    button(panel, actions, '按原操作重试', async () => {
      try { await this.saver.retry(); } finally { save.disabled = this.saver.uncertain; }
    });
  }
  private async inspect(): Promise<void> {
    this.fields.check();
    const version = this.version;
    const result = await this.ports.inspect(structuredClone(this.profile!), this.panel.signal);
    if (this.current(version)) {
      this.schema = result.schema;
      if (result.profile) {
        clearSchemaSecrets(this.panel.body, this.secrets);
        this.profile = result.profile;
        this.sources.confirmed = true;
        this.fields.clear();
        this.changed();
      }
      if (result.discovery) this.sources.accept(this.profile!, result.discovery);
      this.draw();
    }
  }
  private async applyPreset(): Promise<void> {
    this.fields.check();
    if (!this.preset) throw Error('请先选择预设');
    const version = this.version,
      name = this.preset;
    const next = await this.ports.applyPreset(structuredClone(this.profile!), name, this.panel.signal);
    if (this.current(version) && name === this.preset) {
      clearSchemaSecrets(this.panel.body, this.secrets);
      this.profile = next;
      this.fields.clear();
      this.changed(true);
    }
  }
  private async executionPreview(): Promise<void> {
    this.fields.check();
    const version = this.version,
      profile = structuredClone(this.profile!);
    const result = await this.ports.preview(profile, this.panel.signal);
    if (this.current(version)) {
      this.preview = result;
      this.previewProfile = JSON.stringify(profile);
      this.output.textContent = JSON.stringify(result, null, 2);
    }
  }
  private async selectWindow(parent: HTMLElement): Promise<void> {
    this.fields.check();
    const version = this.version;
    const windows = await this.ports.findWindows(structuredClone(this.profile!), this.panel.signal);
    if (!this.current(version)) return;
    choice(
      this.view,
      parent,
      '匹配的窗口',
      '',
      [
        { value: '', label: '请选择' },
        ...windows.map((item) => ({ value: String(item.handle), label: item.title + ' · PID ' + item.pid }))
      ],
      (value) => {
        const selected = windows.find((item) => String(item.handle) === value);
        if (!selected) return;
        this.profile!.windowHandle = selected.handle;
        this.profile!.windowProcessId = selected.pid;
        this.profile!.windowStartedAtUtc = selected.startedAtUtc;
        this.profile!.windowExecutable = selected.executable;
        this.profile!.windowSelection = 'executable';
        this.changed(true);
      }
    );
  }
  private async save(control: UiElement<'nexus-button'>): Promise<void> {
    if (this.saver.locked) return;
    this.fields.check();
    if (this.preview === undefined || this.previewProfile !== JSON.stringify(this.profile))
      throw Error('请先预览当前配置');
    const profile = structuredClone(this.profile!),
      source = this.sources.id,
      version = this.version;
    await this.saver.save(
      control,
      profile,
      source,
      () =>
        this.visible && this.current(version) && source === this.sources.id && this.previewProfile === JSON.stringify(profile),
      () => secretEdits(this.secrets),
      () => clearSchemaSecrets(this.panel.body, this.secrets)
    );
    if (!this.saver.uncertain && this.profile) { this.profile.protectedInputs = profile.protectedInputs; this.secrets.refresh(); }
  }
  dispose(): void {
    this.visibility();
    this.renderOwner.abort();
    clearSchemaSecrets(this.panel.body, this.secrets);
    this.fields.clear();
    this.output.textContent = '';
    this.panel.cleanup();
    void this.ports.close?.();
  }
}
