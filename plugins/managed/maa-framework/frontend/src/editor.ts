import type { ExtensionSurface, UiElement } from '@nexuspipeline/extension-sdk';
import { button, choice, createPanel, paragraph, type Panel } from '../../../frontend-ui/src/elements.js';
import { type Translate } from '../../../frontend-ui/src/localize.js';
import type { MaaPorts } from './ports.js';
import { drawSchema, maskSchemaSecrets } from './schema-view.js';
import { resetPackageRoot } from './maa-profile.js';
import { MaaFields } from './maa-fields.js';
import { defaultTasks } from './task-fields.js';
import { MaaImport } from './maa-import.js';
import { MaaSave } from './maa-save.js';
import { draftPresentation } from '../../../frontend-ui/src/draft-presentation.js';
import { editorDraft } from './editor-draft.js';
import { secretEdits } from './secret-drafts.js';
import { drawRuntime } from './runtime-inputs.js';

export class MaaEditor {
  private readonly panel: Panel;
  private readonly presentation;
  private view: Panel;
  private renderOwner = new AbortController();
  private readonly fields: MaaFields;
  private readonly output = document.createElement('pre');
  private readonly secrets;
  private readonly draft;
  private readonly visibility: () => void;
  private readonly imports: MaaImport;
  private visible: boolean;
  private readonly saver: MaaSave;

  constructor(
    private readonly surface: ExtensionSurface,
    private readonly ports: MaaPorts,
    t: Translate
  ) {
    const retained = editorDraft(surface.drafts);
    this.draft = retained.state; this.secrets = retained.secrets;
    this.panel = createPanel(surface, 'MaaFramework', t);
    this.presentation = draftPresentation(surface.drafts, !!this.draft.profile?.revision, t);
    this.presentation.attach(this.panel.body);
    this.panel.signal.addEventListener('abort', () => this.presentation.detach(), { once: true });
    this.panel.card.classList.add('maa-editor');
    this.view = this.panel;
    this.saver = new MaaSave(this.panel, surface, ports, this.secrets);
    this.fields = new MaaFields(this.panel, () => this.changed());
    this.imports = new MaaImport(
      this.panel,
      ports,
      this.output,
      () => this.draft.profile!,
      () => this.draft.version,
      (version) => this.current(version),
      () => this.fields.check(),
      (profile) => {
        const replaced = this.draft.profile !== profile;
        this.draft.profile = profile;
        if (replaced) { this.fields.clear(); maskSchemaSecrets(this.panel.body); }
        this.changed(replaced);
      }
    );
    this.visible = surface.visible;
    this.output.className = 'maa-output';
    this.panel.card.append(this.output);
    this.visibility = surface.onVisibilityChanged((value) => {
      this.visible = value;
      if (!value) { maskSchemaSecrets(this.panel.body); this.presentation.detach(); }
      else { this.presentation.attach(this.panel.body); this.draw(); }
    });
    this.draw();
    const stop = surface.drafts.onParentSaved(() => this.panel.say('实例定义已保存，当前项目草稿已保留。'));
    const changed = surface.drafts.onChanged(() => { if (this.visible && this.panel.alive()) this.draw(); });
    this.panel.signal.addEventListener('abort', () => { stop(); changed(); }, { once: true });
    void this.panel.run(() => this.start());
  }
  private async start(): Promise<void> {
    if (this.draft.profile && this.draft.editor) { this.draw(); return; }
    const next = await this.ports.readEditor(this.surface.context, this.panel.signal);
    if (!this.panel.alive()) return;
    if (!next) {
      this.panel.body.replaceChildren();
      paragraph(this.panel.body, this.panel.t('当前编辑区没有 Maa 配置'));
      return;
    }
    this.draft.editor = next;
    this.presentation.existing = !!next.profile.revision && next.profile.revision !== '0';
    this.draft.profile = structuredClone(next.profile);
    this.draft.sources.id = next.sourceId || '';
    this.imports.initialize(next.mode);
    this.draft.sources.confirmed = Boolean(this.draft.profile.revision);
    if (next.packageRoot && next.packageRoot.toLowerCase() !== this.draft.profile.packageRoot.toLowerCase())
      this.resetRoot(next.packageRoot);
    this.draw();
    if (next.mode === 'script') await this.discover();
  }
  private resetRoot(root: string): void {
    maskSchemaSecrets(this.panel.body);
    resetPackageRoot(this.draft.profile!, root);
    this.draft.schema = undefined;
    this.draft.sources.discovery = undefined;
    this.draft.sources.id = '';
    this.draft.sources.confirmed = false;
    this.fields.clear();
    this.changed();
  }
  private changed(redraw = false): void {
    if (!this.draft.profile) return;
    this.draft.version++;
    this.draft.preview = undefined;
    this.draft.previewProfile = '';
    this.imports.invalidate();
    this.output.textContent = '';
    this.ports.publishDraft(this.surface.context, structuredClone(this.draft.profile), this.draft.sources.id);
    if (redraw) this.draw();
  }
  private current(version: number): boolean {
    if (!this.panel.alive() || this.surface.drafts.signal.aborted) return false;
    if (version !== this.draft.version) throw Error('草稿已变化，请重新执行此操作');
    this.fields.check();
    return true;
  }
  private async discover(): Promise<void> {
    if (!this.draft.profile?.packageRoot) return;
    const version = this.draft.version,
      profile = this.draft.profile;
    const path =
      this.draft.advanced || (this.draft.sources.discovery?.interfaceCandidates.length && this.draft.sources.confirmed)
        ? profile.interfacePath
        : profile.sourceBinding?.interfaceRelativePath || '';
    const next = await this.ports.discover(profile.packageRoot, path, this.panel.signal);
    if (!this.current(version)) return;
    this.draft.sources.accept(profile, next);
    this.draft.schema = next.schema;
    this.draw();
    this.ports.publishDraft(this.surface.context, structuredClone(profile), this.draft.sources.id);
  }

  private draw(): void {
    this.renderOwner.abort();
    this.renderOwner = new AbortController();
    this.secrets.begin();
    const signal = AbortSignal.any([this.panel.signal, this.renderOwner.signal]);
    const panel = { ...this.panel, signal, alive: () => this.panel.alive() && !signal.aborted };
    this.view = panel;
    this.fields.begin(signal);
    const { profile, editor } = this.draft;
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
      if (!this.draft.sources.draw(panel, fields, profile, () => this.changed(), () => this.discover())) {
        this.scriptActions();
        this.projectActions(fields);
        return;
      }
      if (!this.draft.advanced) {
        this.scriptActions();
        this.projectActions(fields);
        return;
      }
    }
    else if (this.draft.sources.discovery) this.draft.sources.draw(panel, fields, profile, () => this.changed(), () => this.discover());
    this.imports.draw(panel, fields, editor);
    drawRuntime(panel, fields, profile, redraw => this.changed(redraw));
    if (this.draft.schema)
      drawSchema(
        panel,
        fields,
        this.draft.schema,
        profile,
        (redraw) => this.changed(redraw),
        this.secrets,
        () => this.visible && this.draft.profile === profile,
        this.fields,
        {
          name: this.draft.preset,
          select: (value) => {
            this.draft.preset = value;
            this.draft.version++;
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
      this.draft.advanced = !this.draft.advanced;
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
      if (!this.draft.schema) throw Error('请先读取项目');
      defaultTasks(this.draft.schema, this.draft.profile!);
      this.fields.clear();
      this.changed(true);
    });
    button(panel, actions, '查找并选择 Win32 窗口', () => this.selectWindow(fields));
    button(panel, actions, '预览显式导入', () => this.imports.preview());
    button(panel, actions, '使用已预览映射', () => this.imports.apply());
    const save = button(panel, actions, this.draft.editor?.mode === 'script' ? '保存脚本项目配置' : '保存用户配置', () => this.save(save)) as UiElement<'nexus-button'>;
    save.disabled = this.saver.uncertain;
    button(panel, actions, '读取原保存结果', async () => {
      try {
        await this.saver.read();
        if (!this.saver.uncertain && this.draft.profile) {
          const state = await this.ports.readEditor(this.surface.context, this.panel.signal);
          if (state && this.panel.alive()) { this.draft.profile.protectedInputs = state.profile.protectedInputs; this.secrets.refresh(); }
        }
      } finally { save.disabled = this.saver.uncertain; }
    });
    button(panel, actions, '按原操作重试', async () => {
      try { await this.saver.retry(); } finally { save.disabled = this.saver.uncertain; }
    });
  }
  private async inspect(): Promise<void> {
    this.fields.check();
    const version = this.draft.version;
    const result = await this.ports.inspect(structuredClone(this.draft.profile!), this.panel.signal);
    if (this.current(version)) {
      this.draft.schema = result.schema;
      if (result.profile) {
        maskSchemaSecrets(this.panel.body);
        this.draft.profile = result.profile;
        this.draft.sources.confirmed = true;
        this.fields.clear();
        this.changed();
      }
      if (result.discovery) this.draft.sources.accept(this.draft.profile!, result.discovery);
      this.draw();
    }
  }
  private async applyPreset(): Promise<void> {
    this.fields.check();
    if (!this.draft.preset) throw Error('请先选择预设');
    const version = this.draft.version,
      name = this.draft.preset;
    const next = await this.ports.applyPreset(structuredClone(this.draft.profile!), name, this.panel.signal);
    if (this.current(version) && name === this.draft.preset) {
      maskSchemaSecrets(this.panel.body);
      this.draft.profile = next;
      this.fields.clear();
      this.changed(true);
    }
  }
  private async executionPreview(): Promise<void> {
    this.fields.check();
    const version = this.draft.version,
      profile = structuredClone(this.draft.profile!);
    const result = await this.ports.preview(profile, this.panel.signal);
    if (this.current(version)) {
      this.draft.preview = result;
      this.draft.previewProfile = JSON.stringify(profile);
      this.output.textContent = JSON.stringify(result, null, 2);
    }
  }
  private async selectWindow(parent: HTMLElement): Promise<void> {
    this.fields.check();
    const version = this.draft.version;
    const windows = await this.ports.findWindows(structuredClone(this.draft.profile!), this.panel.signal);
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
        this.draft.profile!.windowHandle = selected.handle;
        this.draft.profile!.windowProcessId = selected.pid;
        this.draft.profile!.windowStartedAtUtc = selected.startedAtUtc;
        this.draft.profile!.windowExecutable = selected.executable;
        this.draft.profile!.windowSelection = 'executable';
        this.changed(true);
      }
    );
  }
  private async save(control: UiElement<'nexus-button'>): Promise<void> {
    if (this.saver.locked) return;
    this.fields.check();
    if (this.draft.preview === undefined || this.draft.previewProfile !== JSON.stringify(this.draft.profile))
      throw Error('请先预览当前配置');
    const profile = structuredClone(this.draft.profile!),
      source = this.draft.sources.id,
      version = this.draft.version;
    await this.saver.save(
      control,
      profile,
      source,
      () =>
        this.visible && this.current(version) && source === this.draft.sources.id && this.draft.previewProfile === JSON.stringify(profile),
      () => secretEdits(this.secrets),
      () => maskSchemaSecrets(this.panel.body)
    );
    if (!this.saver.uncertain && this.draft.profile) { this.draft.profile.protectedInputs = profile.protectedInputs; this.secrets.refresh(); }
  }
  dispose(): void {
    this.visibility();
    this.renderOwner.abort();
    maskSchemaSecrets(this.panel.body);
    this.output.textContent = '';
    this.panel.cleanup();
    if (!this.draft.version && !this.presentation.modified && !this.saver.uncertain && this.surface.drafts.canCancel())
      this.surface.drafts.settle('disposed');
    void this.ports.close?.();
  }
}
