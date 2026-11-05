import type { FrontendTransport, SurfaceContext } from '@nexuspipeline/extension-sdk';
import { createIdentity } from '../../../frontend-ui/src/identity.js';
import type { MaaDiscovery, MaaEditorState, MaaPorts, MaaProfile } from './ports.js';
import { MaaProjectClient, record, text } from './project-client.js';
import { profileView, schemaView, selectionView } from './project-view.js';
import type { MaaProtectedEdit } from './secret-drafts.js';
import { runtimeSelection } from './runtime-inputs.js';

export class MaaHostPorts implements MaaPorts {
  private readonly client: MaaProjectClient;
  private current: MaaProfile | undefined;
  private view: Record<string, unknown> | undefined;
  private sources: Record<string, unknown>[] = [];
  private sourceId = '';
  private name = '';

  constructor(private readonly transport: FrontendTransport, private readonly context: SurfaceContext) {
    this.client = new MaaProjectClient(transport, context);
  }

  async readEditor(context: SurfaceContext, signal: AbortSignal): Promise<MaaEditorState | null> {
    if (context !== this.context || !['automation.binding.editor', 'automation.script.editor'].includes(context.surfaceId) || !context.entityId) return null;
    const state = await this.client.read(signal);
    this.name = state.name;
    if (!this.current) {
      if (state.selection) {
        this.view = await this.client.editor(signal);
        this.current = profileView(this.view, context.entityId, this.client.selectionVersion, this.name);
      } else this.current = this.empty(context.entityId);
    }
    this.current.protectedInputs = this.client.protectedStates;
    return { providerId: 'maa-framework', mode: context.surfaceId === 'automation.script.editor' ? 'script' : 'binding', userId: context.entityId, expectedUserRevision: this.client.selectionVersion,
      packageRoot: this.name, profile: structuredClone(this.current) };
  }

  async discover(_root: string, path: string, signal: AbortSignal): Promise<MaaDiscovery> {
    const selection: Record<string, unknown> = { Language: this.current?.language ?? 'zh_cn' };
    if (path) selection.InterfacePath = path;
    const value = await this.client.discover(selection, signal);
    if (!Array.isArray(value.Interfaces) || !Array.isArray(value.Sources)) throw new Error('maa_editor_discovery_invalid');
    this.sources = value.Sources.map(record);
    const interfaces = value.Interfaces.map(text);
    return { interfacePath: interfaces.length === 1 ? interfaces[0] : undefined, interfaceCandidates: interfaces,
      candidates: this.sources.map(item => ({ id: text(item.Id), name: text(item.Name), kind: text(item.Kind),
        instanceId: text(item.InstanceId), path: text(item.Path) })), schema: this.view ? schemaView(this.view) : undefined };
  }

  async inspect(profile: MaaProfile, signal: AbortSignal): ReturnType<MaaPorts['inspect']> {
    const discovery = await this.discover(profile.packageRoot, profile.interfacePath, signal);
    const path = profile.interfacePath || discovery.interfacePath;
    const bound = profile.sourceBinding;
    const source = this.sources.find(item => this.sourceId ? item.Id === this.sourceId : bound && item.Kind === bound.sourceKind &&
      item.Path === bound.sourcePath && item.InstanceId === bound.sourceInstanceId) ?? (this.sources.length === 1 ? this.sources[0] : undefined);
    if (!path || !source) return { discovery };
    const preserved = bound && source.Kind === bound.sourceKind && source.Path === bound.sourcePath &&
      source.InstanceId === bound.sourceInstanceId && path === profile.interfacePath;
    const runtime = runtimeSelection(profile);
    const selection = preserved ? selectionView(profile) : { InterfacePath: path, Language: profile.language,
      ...(runtime ? { Runtime: runtime } : {}),
      ClientKind: source.Kind, Source: { Kind: source.Kind, Path: source.Path, InstanceId: source.InstanceId } };
    this.view = await this.client.editor(signal, selection);
    this.current = preserved ? structuredClone(profile) : profileView(this.view, profile.profileId, profile.revision, this.name);
    return { schema: schemaView(this.view), discovery, profile: structuredClone(this.current) };
  }

  async preview(profile: MaaProfile, signal: AbortSignal): Promise<unknown> {
    this.view = await this.client.editor(signal, selectionView(profile));
    return { compilation: structuredClone(this.view.compilation), tasks: structuredClone(record(this.view.profile).Tasks),
      pretasks: structuredClone(record(this.view.profile).Pretasks), diagnostics: structuredClone(this.view.diagnostics) };
  }

  async previewImport(kind: string, path: string, instanceId: string, signal: AbortSignal): Promise<{ profile: MaaProfile; details: unknown }> {
    if (!this.current?.interfacePath) throw new Error('maa_editor_interface_required');
    const client = kind === 'maapicli-v5.14.0' ? 'maapicli' : kind;
    const runtime = runtimeSelection(this.current);
    const selection = { InterfacePath: this.current.interfacePath, ClientKind: client, Language: this.current.language,
      ...(runtime ? { Runtime: runtime } : {}),
      Source: { Kind: client, Path: path, InstanceId: instanceId } };
    this.view = await this.client.editor(signal, selection);
    return { profile: profileView(this.view, this.current.profileId, this.current.revision, this.name),
      details: { compilation: structuredClone(this.view.compilation), configurationBindings: structuredClone(this.view.configurationBindings),
        diagnostics: structuredClone(this.view.diagnostics) } };
  }

  async applyPreset(profile: MaaProfile, name: string, signal: AbortSignal): Promise<MaaProfile> {
    const selection = selectionView(profile);
    delete selection.Profile;
    selection.Preset = name;
    this.view = await this.client.editor(signal, selection);
    const next = profileView(this.view, profile.profileId, profile.revision, this.name);
    return { ...structuredClone(profile), taskOccurrences: next.taskOccurrences, pretaskOccurrences: next.pretaskOccurrences };
  }

  async findWindows(profile: MaaProfile, signal: AbortSignal): ReturnType<MaaPorts['findWindows']> {
    if (!this.view || schemaView(this.view).controllers.find(item => item.name === profile.controller)?.type !== 'Win32')
      throw new Error('maa_editor_controller_unbound');
    const value = await this.transport.invoke('find-windows', {}, signal, createIdentity());
    if (!Array.isArray(value)) throw new Error('maa_editor_windows_invalid');
    return value.map(item => {
      const row = record(item);
      if (!Number.isSafeInteger(row.handle) || !Number.isSafeInteger(row.processId)) throw new Error('maa_editor_windows_invalid');
      return { handle: Number(row.handle), pid: Number(row.processId), title: text(row.title), executable: text(row.executable),
        startedAtUtc: typeof row.startedAtUtc === 'string' ? row.startedAtUtc : undefined };
    });
  }

  publishDraft(_context: SurfaceContext, profile: MaaProfile, sourceId: string): void {
    this.current = structuredClone(profile);
    this.sourceId = sourceId;
  }

  async saveBinding(_context: SurfaceContext, profile: MaaProfile, _sourceId: string, signal: AbortSignal,
    protectedInputs: readonly MaaProtectedEdit[] = []): Promise<void> {
    await this.client.select(selectionView(profile), signal, protectedInputs);
    await this.client.read(signal).catch(() => undefined);
    profile.protectedInputs = this.client.protectedStates;
    profile.revision = this.client.selectionVersion;
    this.current = { ...structuredClone(profile), revision: this.client.selectionVersion };
  }

  close(): Promise<void> { return this.client.close(); }
  readSave(signal: AbortSignal): ReturnType<NonNullable<MaaPorts['readSave']>> { return this.client.result(signal); }
  retrySave(signal: AbortSignal): Promise<void> { return this.client.retry(signal); }

  private empty(id: string): MaaProfile {
    return { schemaVersion: 1, profileId: id, revision: this.client.selectionVersion, packageRoot: this.name,
      interfacePath: '', nativeDirectory: '', nativeVersion: '5.14.3', language: 'zh_cn', controller: '', resource: '',
      taskOccurrences: [], options: {}, resourceOptions: {}, controllerOptions: {}, windowSelection: 'exact_process',
      windowHandle: 0, windowProcessId: 0, windowExecutable: '', windowWaitMilliseconds: 10000, adbPath: '', adbSerial: '' };
  }
}
