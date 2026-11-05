import type { ExtensionSurface, UiElement } from '@nexuspipeline/extension-sdk';
import { confirm, type Panel } from '../../../frontend-ui/src/elements.js';
import type { MaaPorts, MaaProfile } from './ports.js';
import type { MaaProtectedEdit } from './secret-drafts.js';

export class MaaSave {
  private saving = false;
  uncertain = false;
  constructor(
    private readonly panel: Panel,
    private readonly surface: ExtensionSurface,
    private readonly ports: MaaPorts
  ) {}

  get locked(): boolean {
    return this.saving || this.uncertain;
  }

  async read(): Promise<void> {
    if (this.saving || !this.uncertain || !this.ports.readSave) return;
    this.saving = true;
    try {
      const result = await this.ports.readSave(this.panel.signal);
      if (result === 'notAccepted') {
        this.uncertain = false;
        this.panel.say('原操作确定未被接受，秘密草稿已清理。请重新输入并预览后保存。');
      } else if (result === 'recoveryPending') {
        this.panel.say('原保存已受理，等待恢复完成。请稍后读取原保存结果。');
      } else if (result) {
        this.uncertain = false;
        this.panel.say('已保存');
      } else this.panel.say('原操作仍未确认，请继续读取原保存结果。');
    } finally { this.saving = false; }
  }

  async retry(): Promise<void> {
    if (this.saving || !this.uncertain || !this.ports.retrySave) return;
    this.saving = true;
    this.panel.body.inert = true;
    try {
      await this.ports.retrySave(this.panel.signal);
      this.uncertain = false;
      this.panel.say('已保存');
    } catch (error) {
      this.uncertain = (error as { uncertain?: boolean }).uncertain === true;
      throw error;
    } finally {
      this.saving = false;
      this.panel.body.inert = false;
    }
  }

  async save(
    control: UiElement<'nexus-button'>,
    profile: MaaProfile,
    source: string,
    current: () => boolean,
    protectedInputs: () => readonly MaaProtectedEdit[] = () => [],
    clearProtected: () => void = () => {}
  ): Promise<void> {
    if (this.locked) return;
    this.saving = true;
    try {
      if (
        !(await confirm(
          this.panel,
          this.panel.t(
            'Agent / pretask 是项目代码，进程隔离不是文件沙箱。请核对预览后确认授权并保存此 Maa 配置。'
          )
        ))
      )
        return;
      if (!current()) throw Error('请先预览当前配置');
      control.busy = true;
      this.panel.body.inert = true;
      try { await this.ports.saveBinding(this.surface.context, profile, source, this.panel.signal, protectedInputs()); }
      finally { clearProtected(); }
      if (this.panel.alive()) this.panel.say('已保存');
    } catch (error) {
      this.uncertain = (error as { uncertain?: boolean }).uncertain === true;
      control.disabled = this.uncertain;
      if (this.uncertain) throw Error('保存结果待确认，请保留草稿并读取原操作结果。');
      throw error;
    } finally {
      this.saving = false;
      control.busy = false;
      this.panel.body.inert = false;
    }
  }
}
