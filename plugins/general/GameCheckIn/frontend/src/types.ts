export type GameOption = { id: string; name: string };
export type PlatformOption = { id: string; name: string; games: GameOption[]; browserLogin?: { ready: boolean; status: string } };
export type Schedule = { id: string; days: number[]; enabled: boolean; time: string };
export type RunResult = { platform: string; gameCode: string; success: boolean; code: string; message: string };
export type Run = { id: string; trigger: string; startedAt: string; completedAt: string | null; status: string; results: RunResult[] };
export type CheckInNotification = { enabled: boolean; smtpTo: string };
export type Task = {
  id: string;
  name: string;
  remark: string;
  enabled: boolean;
  games: Record<string, string[]>;
  schedules: Schedule[];
  notification: CheckInNotification;
  runs: Run[];
  credentials: Record<string, boolean>;
  credentialStates: Record<string, CredentialFieldState>;
  isRunning: boolean;
  nextRunAt: string | null;
  recentRun: Run | null;
};
export type TaskState = { tasks: Task[]; platforms: PlatformOption[]; timeZoneId: string };
export type TaskDraft = {
  id?: string;
  name: string;
  remark: string;
  enabled: boolean;
  games: Record<string, string[]>;
  schedules: Schedule[];
  notification: CheckInNotification;
};
export type SecretAction = { action: "keep" | "set" | "clear"; value?: string; candidateId?: string; fieldGeneration: number };
export type CredentialRead = { platform: string; fieldGeneration: number; configured: boolean; source: string | null; value: string | null; revealRemainingSeconds?: number | null };
export type CredentialFieldState = {
  configured: boolean;
  source: "manual" | "browser" | null;
  fieldGeneration: number;
  intent: SecretAction["action"];
  candidateId: string | null;
  maskedAccount: string | null;
  expiresAt: string | null;
  error: string | null;
};
export type CredentialEditor = { editorSessionId: string; fields: Record<string, CredentialFieldState> };
export type TaskSavePayload = TaskDraft & { editorSessionId: string; secrets: Record<string, SecretAction> };
export type Translate = (key: string, args?: Record<string, unknown>, fallback?: string) => string;

export type PluginHost = {
  api: {
    get(route: string, signal?: AbortSignal): Promise<unknown>;
    post(route: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
    put(route: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
    delete(route: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
  };
  i18n: { t(key: string, args?: Record<string, unknown>, fallback?: string): string };
  clientSessions: { get(): Promise<{ hostSessionId: string; clientSessionId: string; nativeBrowserAvailable: boolean }> };
  browserLogin: { open(request: { flowId: string; editorSessionId: string; fieldGeneration: number; context: Record<string, unknown> }, signal?: AbortSignal): Promise<{ completed: Promise<{ success: boolean; error?: string }>; cancel(): Promise<void> }> };
  ui?: { toast(message: string, tone?: string): void };
};
