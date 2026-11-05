import type { SurfaceContext } from '@nexuspipeline/extension-sdk';
import type { MaaProtectedEdit, MaaSecretState } from './secret-drafts.js';

export interface MaaTask {
  readonly name: string;
  readonly label: string;
  readonly defaultCheck?: boolean;
  readonly repeatable?: boolean;
  readonly controller?: readonly string[];
  readonly resource?: readonly string[];
  readonly options?: readonly string[];
  readonly groups?: readonly string[];
}

export interface MaaOption {
  readonly label: string;
  readonly type: 'select' | 'switch' | 'checkbox' | 'input' | 'hotkey';
  readonly controller?: readonly string[];
  readonly resource?: readonly string[];
  readonly defaultCase?: string | readonly string[];
  readonly cases?: readonly { name: string; label: string; options?: readonly string[] }[];
  readonly inputs?: readonly { name: string; label: string; password?: boolean; default?: string }[];
  readonly hotkeys?: readonly { name: string; label: string; password?: boolean; default?: string }[];
}

export interface MaaSchema {
  readonly projectName: string;
  readonly projectVersion: string;
  readonly controllers: readonly {
    name: string;
    label: string;
    type: 'Win32' | 'Adb' | 'Other';
    options?: readonly string[];
  }[];
  readonly resources: readonly { name: string; label: string; options?: readonly string[] }[];
  readonly tasks: readonly MaaTask[];
  readonly groups?: readonly { name: string; label: string }[];
  readonly pretasks?: readonly {
    name: string;
    label: string;
    controller?: readonly string[];
    resource?: readonly string[];
    options?: readonly string[];
  }[];
  readonly settings?: readonly { name: string; label: string; options?: readonly string[] }[];
  readonly options: Readonly<Record<string, MaaOption>>;
  readonly globalOptions?: readonly string[];
  readonly presets: readonly { name: string; label: string }[];
}

export interface MaaOccurrence {
  occurrenceId: string;
  taskName: string;
  sourceTaskId?: string;
  order: number;
  enabled: boolean;
  repeatCount: number;
  options: Record<string, unknown>;
  pipelineOverride: Record<string, unknown>;
  definitionKnown?: boolean;
}

export interface MaaProfile {
  protectedInputs?: readonly MaaSecretState[];
  schemaVersion?: number;
  profileId: string;
  revision: string;
  packageRoot: string;
  interfacePath: string;
  nativeDirectory: string;
  nativeVersion?: string;
  language: string;
  controller: string;
  resource: string;
  taskOccurrences: MaaOccurrence[];
  pretaskOccurrences?: MaaOccurrence[];
  selectedTasks?: string[];
  taskOptions?: Record<string, unknown>;
  options: Record<string, unknown>;
  resourceOptions: Record<string, unknown>;
  controllerOptions: Record<string, unknown>;
  windowSelection: 'exact_process' | 'executable';
  windowHandle: number;
  windowProcessId: number;
  windowStartedAtUtc?: string;
  windowExecutable: string;
  windowWaitMilliseconds: number;
  adbPath: string;
  adbSerial: string;
  sourceBinding?: { sourceKind: string; sourceInstanceId: string; sourcePath?: string; interfaceRelativePath?: string } | null;
  sourceSnapshot?: unknown;
  dependencyLock?: unknown;
  runtimeInputs?: { executables: { program: string; path: string }[]; directories: string[] } | null;
  authorizedFingerprint?: string;
}

export interface MaaEditorState {
  readonly providerId: string;
  readonly mode: 'script' | 'binding';
  readonly userId?: string;
  readonly sourceId?: string;
  readonly status?: string;
  readonly packageRoot?: string;
  readonly expectedUserRevision?: string;
  readonly profile: MaaProfile;
}

export interface MaaDiscovery {
  readonly interfacePath?: string;
  readonly interfaceCandidates: readonly string[];
  readonly candidates: readonly { id: string; name: string; kind: string; instanceId?: string; path?: string }[];
  readonly schema?: MaaSchema;
}

export interface MaaPorts {
  close?(): Promise<void>;
  readSave?(signal: AbortSignal): Promise<boolean | 'notAccepted' | 'recoveryPending'>;
  retrySave?(signal: AbortSignal): Promise<void>;
  readEditor(context: SurfaceContext, signal: AbortSignal): Promise<MaaEditorState | null>;
  discover(packageRoot: string, interfacePath: string, signal: AbortSignal): Promise<MaaDiscovery>;
  inspect(profile: MaaProfile, signal: AbortSignal): Promise<{ schema?: MaaSchema; profile?: MaaProfile; discovery?: MaaDiscovery }>;
  preview(profile: MaaProfile, signal: AbortSignal): Promise<unknown>;
  applyPreset(profile: MaaProfile, name: string, signal: AbortSignal): Promise<MaaProfile>;
  findWindows(
    profile: MaaProfile,
    signal: AbortSignal
  ): Promise<
    readonly {
      handle: number;
      title: string;
      pid: number;
      executable: string;
      startedAtUtc?: string;
    }[]
  >;
  previewImport(
    kind: string,
    path: string,
    instanceId: string,
    signal: AbortSignal
  ): Promise<{
    readonly profile?: MaaProfile;
    readonly details: unknown;
  }>;
  publishDraft(context: SurfaceContext, profile: MaaProfile, sourceId: string): void;
  saveBinding(
    context: SurfaceContext,
    profile: MaaProfile,
    sourceId: string,
    signal: AbortSignal,
    protectedInputs?: readonly MaaProtectedEdit[]
  ): Promise<void>;
}
