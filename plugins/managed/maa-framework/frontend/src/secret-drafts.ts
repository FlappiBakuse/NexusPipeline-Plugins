export interface MaaSecretState {
  readonly key: string;
  readonly revision: number;
  readonly isConfigured: boolean;
  readonly isReadable: boolean;
}

export interface MaaProtectedEdit {
  readonly key: string;
  readonly expectedRevision: number;
  readonly intent: 'keep' | 'set' | 'clear';
  readonly value?: string;
}

export interface MaaSecretDraft {
  value: string;
  edit?: MaaProtectedEdit;
}

export class MaaSecretDrafts extends Map<string, MaaSecretDraft> {
  private readonly listeners = new Set<() => void>();
  private readonly active = new Set<string>();
  private readonly submitted = new Map<string, MaaSecretDraft>();
  begin(): void { this.active.clear(); }
  activate(key: string): void { this.active.add(key); }
  isActive(key: string): boolean { return this.active.has(key); }
  markSubmitted(): void {
    this.submitted.clear();
    for (const key of this.active) {
      const draft = this.get(key);
      if (draft?.edit) this.submitted.set(key, draft);
    }
  }
  confirmSaved(): void {
    for (const [key, draft] of this.submitted) if (this.get(key) === draft) this.delete(key);
    this.submitted.clear();
  }
  notAccepted(): void { this.submitted.clear(); }
  override set(key: string, value: MaaSecretDraft): this {
    const previous = this.get(key);
    if (previous && previous !== value) previous.value = '';
    super.set(key, value); this.refresh(); return this;
  }
  override delete(key: string): boolean {
    const previous = this.get(key);
    if (previous) previous.value = '';
    const removed = super.delete(key); this.refresh(); return removed;
  }
  override clear(): void {
    for (const draft of this.values()) draft.value = '';
    super.clear(); this.refresh();
    this.active.clear();
    this.submitted.clear();
  }
  watch(listener: () => void, signal: AbortSignal): void {
    if (signal.aborted) return;
    this.listeners.add(listener);
    signal.addEventListener('abort', () => this.listeners.delete(listener), { once: true });
    listener();
  }
  refresh(): void { for (const listener of this.listeners) listener(); }
}

export async function secretKey(scope: string, option: string, input: string): Promise<string> {
  const bytes = new TextEncoder().encode(scope + '\0' + option + '\0' + input);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return 'input-' + [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function projectScope(profile: { sourceSnapshot?: unknown }, scope: string): string {
  const snapshot = profile.sourceSnapshot as { compilation?: { compilationFingerprint?: unknown } } | undefined;
  const fingerprint = snapshot?.compilation?.compilationFingerprint;
  if (typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('请先读取项目');
  return fingerprint + '/' + scope;
}

export function secretEdits(drafts: MaaSecretDrafts): MaaProtectedEdit[] {
  return [...drafts].flatMap(([key, draft]) => drafts.isActive(key) && draft.edit ? [{ ...draft.edit,
    ...(draft.edit.intent === 'set' ? { value: draft.value } : {}) }] : []);
}

export function requireSecretBindings(schema: { options: Readonly<Record<string, {
  inputs?: readonly { name: string; password?: boolean }[];
  hotkeys?: readonly { name: string; password?: boolean }[];
}>> }, options: Record<string, unknown>): void {
  for (const [name, definition] of Object.entries(schema.options)) {
    const fields = options[name];
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) continue;
    for (const input of definition.inputs ?? definition.hotkeys ?? []) {
      const value = (fields as Record<string, unknown>)[input.name];
      if (!input.password || value === undefined) continue;
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 ||
        typeof (value as Record<string, unknown>).$maaSecret !== 'string' ||
        !/^input-[a-f0-9]{64}$/.test((value as Record<string, string>).$maaSecret))
        throw new Error('密码须使用受保护输入控件');
    }
  }
}
