import type { FrontendTransport, SurfaceContext } from '@nexuspipeline/extension-sdk';
import { createIdentity } from '../../../frontend-ui/src/identity.js';
import type { MaaProtectedEdit, MaaSecretState } from './secret-drafts.js';

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('maa_editor_response_invalid');
  return value as Record<string, unknown>;
}
export function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('maa_editor_response_invalid');
  return value;
}
function sequence(value: unknown, zero = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (zero ? 0 : 1)) throw new Error('maa_editor_response_invalid');
  return value;
}

export class MaaProjectClient {
  private revision = 0;
  private choiceRevision = 0;
  private previewId = '';
  private expires = 0;
  private assets = new Map<string, { bytes: number; sha: string }>();
  private reads = 0;
  private bytes = 0;
  private pending: { id: string; input: Record<string, unknown>; protected: boolean } | undefined;
  private states: MaaSecretState[] = [];

  constructor(private readonly transport: FrontendTransport, private readonly context: SurfaceContext) {}
  private get revisionInput(): Record<string, number> {
    return { [this.context.surfaceId === 'automation.script.editor' ? 'expectedScriptRevision' : 'expectedBindingRevision']: this.revision };
  }
  get selectionVersion(): string { return String(this.choiceRevision); }
  get protectedStates(): readonly MaaSecretState[] { return this.states.map(item => ({ ...item })); }

  async read(signal: AbortSignal): Promise<{ name: string; selection: Record<string, unknown> | null }> {
    const value = record(await this.transport.project(this.context, 'context', {}, signal));
    if (value.providerId !== 'maa-framework' || value.compilerId !== 'project') throw new Error('maa_editor_provider_unbound');
    this.revision = sequence(this.context.surfaceId === 'automation.script.editor' ? value.scriptRevision : value.bindingRevision); this.choiceRevision = sequence(value.selectionRevision, true);
    this.states = (Array.isArray(value.protectedInputs) ? value.protectedInputs : []).map(item => {
      const state = record(item);
      if (typeof state.isConfigured !== 'boolean' || typeof state.isReadable !== 'boolean') throw new Error('maa_editor_secret_state_invalid');
      return { key: text(state.key), revision: sequence(state.revision, true), isConfigured: state.isConfigured, isReadable: state.isReadable };
    });
    return { name: text(value.scriptName), selection: value.selection == null ? null : record(value.selection) };
  }

  async discover(selection: Record<string, unknown>, signal: AbortSignal): Promise<Record<string, unknown>> {
    return record(await this.transport.project(this.context, 'discover', { ...this.revisionInput, selection }, signal));
  }

  async select(selection: Record<string, unknown>, signal: AbortSignal, protectedInputs: readonly MaaProtectedEdit[] = []): Promise<void> {
    if (this.context.surfaceId === 'automation.script.editor' && protectedInputs.length) throw new Error('脚本项目的受保护字段请在账号绑定中配置。');
    if (this.pending) throw new Error('保存结果待确认：' + this.pending.id);
    const input = { ...this.revisionInput, expectedSelectionRevision: this.choiceRevision, providerId: 'maa-framework',
      selection: structuredClone(selection), ...(protectedInputs.length ? { protectedInputs: protectedInputs.map(({ value: _value, ...intent }) => intent) } : {}) };
    this.pending = { id: createIdentity(), input, protected: protectedInputs.length > 0 };
    await this.submit(signal, protectedInputs.length ? { ...input, protectedInputs: protectedInputs.map(item => ({ ...item })) } : input);
  }

  async retry(signal: AbortSignal): Promise<void> {
    if (this.pending?.protected) throw Object.assign(new Error('受保护保存仅可读取原结果，不能重发秘密写入。'), { uncertain: true });
    await this.submit(signal);
  }

  private async submit(signal: AbortSignal, initial?: Record<string, unknown>): Promise<void> {
    const pending = this.pending;
    if (!pending) throw new Error('maa_editor_operation_missing');
    try {
      const value = record(await this.transport.project(this.context, 'select', initial ?? structuredClone(pending.input), signal, pending.id));
      try {
        if (value.operationId !== pending.id) throw new Error('maa_editor_operation_unbound');
        this.choiceRevision = sequence(value.revision);
        this.applyProtected(pending.input);
      } catch { throw Object.assign(new Error('maa_editor_operation_unbound'), { uncertain: true }); }
      this.pending = undefined;
    } catch (error) {
      if (pending.protected) throw Object.assign(new Error('受保护保存结果待确认，请读取原保存结果。'), { uncertain: true });
      if (!(error as { uncertain?: boolean }).uncertain) this.pending = undefined;
      throw error;
    }
  }

  async result(signal: AbortSignal): Promise<boolean | 'notAccepted' | 'recoveryPending'> {
    const pending = this.pending;
    if (!pending) throw new Error('maa_editor_operation_missing');
    const value = record(await this.transport.project(this.context, 'result', { ...structuredClone(pending.input), operationId: pending.id,
      ...(pending.protected ? { finish: true } : {}) }, signal));
    if (value.operationId !== pending.id || typeof value.found !== 'boolean') throw new Error('maa_editor_operation_unbound');
    if (value.found) {
      this.choiceRevision = sequence(value.revision);
      this.applyProtected(pending.input);
      this.pending = undefined;
    }
    if (value.outcome === 'notAccepted') {
      if (value.found || value.pending !== false) throw new Error('maa_editor_operation_unbound');
      this.pending = undefined;
      return 'notAccepted';
    }
    if (pending.protected && value.outcome === 'pending' && value.pending === true) return 'recoveryPending';
    return value.found;
  }

  private applyProtected(input: Record<string, unknown>): void {
    if (!Array.isArray(input.protectedInputs)) return;
    for (const value of input.protectedInputs) {
      const intent = record(value), key = text(intent.key), previous = this.states.find(item => item.key === key);
      const configured = intent.intent === 'set' || intent.intent === 'keep' && previous?.isConfigured === true;
      const state = { key, revision: sequence(intent.expectedRevision, true) + (intent.intent === 'keep' ? 0 : 1),
        isConfigured: configured, isReadable: intent.intent === 'set' || intent.intent === 'keep' && previous?.isReadable === true };
      this.states = [...this.states.filter(item => item.key !== key), state];
    }
  }

  async open(signal: AbortSignal, selection?: Record<string, unknown>): Promise<Record<string, unknown>> {
    await this.close();
    const input: Record<string, unknown> = { ...this.revisionInput };
    if (selection) input.selection = structuredClone(selection);
    const value = record(await this.transport.project(this.context, 'preview', input, signal));
    this.previewId = text(value.previewId); this.expires = Date.parse(text(value.expiresAt));
    if (!/^[a-f0-9-]{36}$/.test(this.previewId) || !Number.isFinite(this.expires) || this.expires <= Date.now() || !Array.isArray(value.assets))
      throw new Error('maa_editor_preview_invalid');
    this.assets.clear(); this.reads = 0; this.bytes = 0;
    for (const item of value.assets) {
      const asset = record(item), name = text(asset.name), sha = text(asset.sha256), bytes = sequence(asset.sizeBytes);
      if (!/^[a-z][a-z0-9._-]{0,127}$/.test(name) || !/^[a-f0-9]{64}$/.test(sha) ||
          !['index', 'page'].includes(text(asset.kind)) || bytes > 524288 || this.assets.has(name)) throw new Error('maa_editor_preview_invalid');
      this.assets.set(name, { bytes, sha });
    }
    const root = await this.page(text(value.rootIndex), signal);
    if (record(root).format !== 'maa.editor.index' || record(root).version !== 1) throw new Error('maa_editor_format_unknown');
    return record(root);
  }

  async expand(node: unknown, signal: AbortSignal, depth = 0): Promise<unknown> {
    if (depth > 64) throw new Error('maa_editor_depth');
    const value = record(node), kind = text(value.kind);
    if (kind === 'inline') return structuredClone(value.value);
    if (!['object', 'array', 'string'].includes(kind) || !Array.isArray(value.pages) || value.pages.length > 4096 ||
        !Number.isSafeInteger(value.count) || (value.count as number) < 0) throw new Error('maa_editor_page_invalid');
    const result: Record<string, unknown> = Object.create(null), rows: unknown[] = [];
    let count = 0;
    for (const item of value.pages) {
      const reference = record(item), sha = text(reference.sha256);
      if (typeof reference.bytes !== 'number' || !Number.isSafeInteger(reference.bytes) || reference.bytes < 1 || reference.bytes > 65536 ||
          typeof reference.count !== 'number' || !Number.isSafeInteger(reference.count) || reference.count < 1) throw new Error('maa_editor_page_invalid');
      const page = await this.page('editor-page-' + sha, signal, { sha256: sha, bytes: reference.bytes });
      if (!Array.isArray(page) || page.length !== reference.count) throw new Error('maa_editor_page_changed');
      for (const member of page) {
        if (kind === 'object') {
          const pair = record(member), key = text(pair.name);
          if (Object.hasOwn(result, key)) throw new Error('maa_editor_page_invalid');
          result[key] = await this.expand(pair.node, signal, depth + 1);
        } else rows.push(kind === 'array' ? await this.expand(member, signal, depth + 1) : text(member));
        count++;
      }
    }
    if (count !== value.count) throw new Error('maa_editor_page_changed');
    return kind === 'object' ? result : kind === 'array' ? rows : rows.join('');
  }

  async editor(signal: AbortSignal, selection?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const root = await this.open(signal, selection);
    const output = { ...root }, profile = { ...record(root.profile) };
    for (const key of ['schema', 'translations', 'configurationBindings', 'diagnostics']) output[key] = await this.expand(root[key], signal);
    for (const key of ['Tasks', 'Pretasks', 'GlobalOptions', 'ResourceOptions', 'ControllerOptions']) profile[key] = await this.expand(profile[key], signal);
    output.profile = profile;
    return output;
  }

  async page(name: string, signal: AbortSignal, expected?: { sha256: string; bytes: number }): Promise<unknown> {
    const asset = this.assets.get(name);
    if (!this.previewId || Date.now() >= this.expires || !asset || ++this.reads > 4097 ||
        (this.bytes += asset.bytes) > 32 * 1024 * 1024 || expected && (asset.sha !== expected.sha256 || asset.bytes !== expected.bytes))
      throw new Error('maa_editor_preview_expired_or_unbound');
    const value = record(await this.transport.project(this.context, 'page', { previewId: this.previewId, asset: name }, signal));
    if (value.name !== name || value.sha256 !== asset.sha) throw new Error('maa_editor_page_changed');
    const encoded = text(value.contentBase64);
    if (encoded.length > Math.ceil(asset.bytes / 3) * 4) throw new Error('maa_editor_page_changed');
    const bytes = Uint8Array.from(atob(encoded), value => value.charCodeAt(0));
    if (bytes.length !== asset.bytes) throw new Error('maa_editor_page_changed');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }

  async close(): Promise<void> {
    const id = this.previewId; this.previewId = ''; this.assets.clear();
    if (id) await this.transport.project(this.context, 'release', { previewId: id }, AbortSignal.timeout(3000)).catch(() => {});
  }
}
