export interface CheckInSchedule {
  id: string;
  days: number[];
  enabled: boolean;
  time: string;
}

export interface CheckInTask {
  id: string;
  name: string;
  remark: string;
  enabled: boolean;
  games: Record<string, string[]>;
  schedules: CheckInSchedule[];
  notification: { enabled: boolean; notificationTaskIds: string[] };
  isRunning: boolean;
  nextRunAt: string | null;
  recentRun: CheckInRun | null;
  runs?: readonly CheckInRun[];
}

export interface CheckInRun {
  id?: string;
  trigger?: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  results: readonly { platform: string; gameCode: string; message: string; success: boolean }[];
  diagnostics?: readonly unknown[];
}

export interface CheckInPlatform {
  id: string;
  name: string;
  games: readonly { id: string; name: string }[];
  browserLogin?: { ready: boolean; status: string };
}

export interface CheckInState {
  readonly revision: number;
  readonly configurationRevision?: number;
  readonly timeZoneId: string;
  readonly tasks: readonly CheckInTask[];
  readonly platforms: readonly CheckInPlatform[];
  readonly notificationTasks: readonly {
    id: string;
    name: string;
    type?: string;
    enabled: boolean;
    configured: boolean;
  }[];
}

export type TaskDraft = Omit<CheckInTask, 'id' | 'isRunning' | 'nextRunAt' | 'recentRun' | 'runs'> & {
  id?: string;
};
export type SecretAction = {
  action: 'keep' | 'clear' | 'set';
  fieldGeneration: number;
  value?: string;
  candidateId?: string;
};
export interface CredentialField {
  readonly configured: boolean;
  readonly fieldGeneration: number;
  readonly maskedAccount?: string;
  readonly source?: string;
  readonly intent?: 'keep' | 'set' | 'clear';
  readonly error?: string;
  readonly candidateId?: string;
}
export interface CredentialEditor {
  readonly editorSessionId: string;
  readonly revision?: number;
  readonly fields: Readonly<Record<string, CredentialField>>;
  readonly task?: CheckInTask;
}

export interface CheckInPorts {
  readonly canReveal: boolean;
  readState(signal: AbortSignal): Promise<CheckInState>;
  readPublication(operationId: string, signal: AbortSignal): Promise<boolean>;
  saveTask(
    operationId: string,
    draft: TaskDraft,
    editorSessionId: string,
    secrets: Readonly<Record<string, SecretAction>>,
    signal: AbortSignal
  ): Promise<CheckInState>;
  deleteTask(id: string, signal: AbortSignal, expectedConfigurationRevision?: number): Promise<CheckInState>;
  reorderTasks(ids: readonly string[], signal: AbortSignal, expectedConfigurationRevision?: number): Promise<CheckInState>;
  runTask(id: string, signal: AbortSignal): Promise<CheckInState>;
  openEditor(taskId: string | undefined, signal: AbortSignal, expectedConfigurationRevision?: number): Promise<CredentialEditor>;
  readEditor(editorSessionId: string, signal: AbortSignal): Promise<CredentialEditor>;
  prepareSave?(editorSessionId: string, signal: AbortSignal): Promise<CredentialEditor>;
  leaseEditor(editorSessionId: string, signal: AbortSignal): Promise<void>;
  closeEditor(editorSessionId: string): Promise<void>;
  confirmReveal(editorSessionId: string, signal: AbortSignal): Promise<void>;
  revealCredential(
    platformId: string,
    editorSessionId: string,
    signal: AbortSignal
  ): Promise<{ value: string; remainingSeconds: number }>;
  beginBrowserLogin(
    platformId: string,
    editorSessionId: string,
    fieldGeneration: number,
    signal: AbortSignal
  ): Promise<{ candidateId: string; fieldGeneration?: number }>;
  cancelBrowserLogin(platformId: string, editorSessionId: string): Promise<void>;
  prepareTajiduo(
    editorSessionId: string,
    fieldGeneration: number,
    signal: AbortSignal
  ): Promise<{ operationId: string }>;
  sendTajiduoCode(operationId: string, phone: string, signal: AbortSignal): Promise<void>;
  loginTajiduo(
    operationId: string,
    phone: string,
    value: string,
    mode: 'sms' | 'password',
    editorSessionId: string,
    signal: AbortSignal
  ): Promise<{ candidateId: string; platformId: string }>;
  cancelTajiduo(operationId: string, editorSessionId: string): Promise<void>;
}
