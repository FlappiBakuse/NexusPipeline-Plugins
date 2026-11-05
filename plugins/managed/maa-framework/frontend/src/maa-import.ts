import { createIdentity } from '../../../frontend-ui/src/identity';
import { choice, confirm, field, type Panel } from '../../../frontend-ui/src/elements.js';
import type { MaaEditorState, MaaPorts, MaaProfile } from './ports.js';

export class MaaImport {
  private kind = 'mxu';
  private path = '';
  private instance = '';
  private mode: 'new' | 'overwrite' = 'new';
  private generation = 0;
  private pending: { profile?: MaaProfile; details: unknown; key: string } | undefined;

  constructor(
    private readonly panel: Panel,
    private readonly ports: MaaPorts,
    private readonly output: HTMLElement,
    private readonly profile: () => MaaProfile,
    private readonly version: () => number,
    private readonly current: (version: number) => boolean,
    private readonly check: () => void,
    private readonly applyProfile: (profile: MaaProfile) => void
  ) {}

  initialize(mode: MaaEditorState['mode']): void {
    this.mode = mode === 'binding' ? 'overwrite' : 'new';
  }
  invalidate(): void {
    this.pending = undefined;
  }

  draw(panel: Panel, parent: HTMLElement, editor: MaaEditorState): void {
    const profile = this.profile();
    field(panel, parent, 'Interface 相对路径', profile.interfacePath, (value) => {
      profile.interfacePath = value;
      this.applyProfile(profile);
    });
    field(panel, parent, '原生 DLL 相对目录', profile.nativeDirectory, (value) => {
      profile.nativeDirectory = value;
      this.applyProfile(profile);
    });
    const changed = () => {
      this.generation++;
      this.pending = undefined;
      this.output.textContent = '';
    };
    field(panel, parent, '导入源相对路径（只读）', this.path, (value) => {
      this.path = value;
      changed();
    });
    choice(
      panel,
      parent,
      '导入格式',
      this.kind,
      [
        { value: 'mxu', label: 'MXU schema 1.0' },
        { value: 'mfa', label: 'MFAAvalonia' },
        { value: 'cfa', label: 'CFA' },
        { value: 'maapicli-v5.14.0', label: 'MaaPiCli v5.14.0' }
      ],
      (value) => {
        this.kind = value;
        changed();
      }
    );
    field(panel, parent, '源实例精确 ID', this.instance, (value) => {
      this.instance = value;
      changed();
    });
    if (editor.mode === 'script')
      choice(
        panel,
        parent,
        '导入目标',
        this.mode,
        [
          { value: 'new', label: '新建独立配置' },
          { value: 'overwrite', label: '覆盖此明确配置（CAS）' }
        ],
        (value) => {
          this.mode = value as 'new' | 'overwrite';
          changed();
        }
      );
  }

  private key(): string {
    return JSON.stringify([this.kind, this.path, this.instance, this.mode]);
  }

  async preview(): Promise<void> {
    this.check();
    const version = this.version(),
      generation = ++this.generation,
      key = this.key();
    const [kind, path, instance] = [this.kind, this.path, this.instance];
    this.pending = undefined;
    const result = await this.ports.previewImport(kind, path, instance, this.panel.signal);
    if (this.current(version) && generation === this.generation && key === this.key()) {
      this.pending = { ...result, key };
      this.output.textContent = JSON.stringify(result.details, null, 2);
    }
  }

  async apply(): Promise<void> {
    this.check();
    if (!this.pending?.profile || this.pending.key !== this.key()) throw Error('请先预览当前导入选择');
    const candidate = this.pending,
      previous = JSON.stringify(this.profile());
    if (!(await confirm(this.panel, this.panel.t('将此映射载入草稿？源配置不会写入。')))) return;
    if (
      !this.panel.alive() ||
      candidate !== this.pending ||
      candidate.key !== this.key() ||
      previous !== JSON.stringify(this.profile())
    )
      throw Error('请先预览当前导入选择');
    const target = this.profile();
    if (this.mode === 'overwrite' && !target.revision)
      throw Error('覆盖导入需要已保存配置修订，不能覆盖未知目标');
    const profile = structuredClone(candidate.profile!);
    profile.profileId = this.mode === 'new' ? createIdentity() : target.profileId;
    profile.revision = this.mode === 'new' ? '' : target.revision;
    this.applyProfile(profile);
  }
}
