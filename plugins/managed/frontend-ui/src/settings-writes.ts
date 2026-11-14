import { createIdentity } from './identity.js';

type Submission<T> = { operationId: string; before: T; value: T };
type SettingsPort<T> = {
  signal: AbortSignal;
  read(): Promise<T>;
  write(value: T, before: T, operationId: string): Promise<T>;
  inspect(operationId: string): Promise<boolean>;
};
const equal = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);
const copy = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function rebaseSettings<T>(current: T, before: T, after: T): T {
  if (equal(before, after) || equal(current, after)) return copy(current);
  if (equal(current, before)) return copy(after);
  if (object(current) && object(before) && object(after)) {
    const next: Record<string, unknown> = { ...current };
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)]))
      next[key] = rebaseSettings(current[key], before[key], after[key]);
    return next as T;
  }
  throw Error('设置已在其他位置更改，请检查当前值。');
}

export class SettingsWrites<T extends object> {
  value: T;
  error = '';
  unknown = false;
  private confirmed: T;
  private accepted: T;
  private queued?: { before: T; value: T };
  private pending?: Submission<T>;
  private work?: Promise<void>;
  private readonly listeners = new Set<() => void>();

  constructor(initial: T, private readonly port: SettingsPort<T>) {
    this.value = copy(initial); this.confirmed = copy(initial); this.accepted = copy(initial);
    port.signal.addEventListener('abort', () => this.listeners.clear(), { once: true });
  }
  get snapshot(): T { return this.confirmed; }
  observe(value: T): void {
    this.confirmed = copy(value);
    if (!this.work && !this.pending && !equal(this.value, value)) { this.value = copy(value); this.notify(); }
    if (this.unknown && !this.work) void this.resume();
  }
  listen(listener: () => void): () => void {
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  }
  private notify(): void { this.listeners.forEach(listener => listener()); }
  async patch(patch: Partial<T>): Promise<T> {
    this.port.signal.throwIfAborted();
    if (this.unknown) throw Error('设置结果待确认，请稍后查看。');
    this.error = '';
    const before = copy(this.value), value = { ...before, ...copy(patch) };
    if (!equal(before, value)) {
      this.queued = { before: this.queued?.before ?? before, value };
      this.value = value; this.error = '';
      if (!this.work) this.work = Promise.resolve().then(() => this.drain()).finally(() => {
        this.work = undefined; this.notify();
      });
      this.notify();
    }
    await this.settled();
    return copy(this.accepted);
  }
  async settled(): Promise<void> {
    await this.work;
    if (this.pending) throw Error('设置结果待确认，请稍后查看。');
  }
  private async drain(): Promise<void> {
    while (this.queued && !this.port.signal.aborted) {
      const change = this.queued; this.queued = undefined;
      try {
        let before = this.confirmed, value = rebaseSettings(before, change.before, change.value);
        if (equal(value, before)) continue;
        this.pending = { operationId: createIdentity(), before: copy(before), value };
        let saved: T;
        try { saved = await this.port.write(value, before, this.pending.operationId); }
        catch (reason) {
          if ((reason as { status?: number }).status !== 409 || (reason as { uncertain?: boolean }).uncertain) throw reason;
          before = await this.port.read(); this.confirmed = copy(before);
          value = rebaseSettings(before, change.before, change.value);
          this.pending = { operationId: createIdentity(), before: copy(before), value };
          saved = await this.port.write(value, before, this.pending.operationId);
        }
        this.accept(saved);
      } catch (reason) {
        this.queued = undefined;
        if ((reason as { uncertain?: boolean }).uncertain && this.pending) {
          this.unknown = true; this.notify(); await this.inspect();
        } else { this.pending = undefined; this.error = reason instanceof Error ? reason.message : String(reason); }
        this.value = copy(this.confirmed);
        break;
      }
    }
  }
  private accept(value: T): void {
    this.accepted = copy(value); this.confirmed = copy(value);
    this.pending = undefined; this.unknown = false; this.error = '';
    if (!this.queued) this.value = copy(value);
    this.notify();
  }
  private async inspect(): Promise<void> {
    for (const delay of [0, 200, 800, 2000]) {
      if (delay) await new Promise<void>(resolve => {
        const finish = () => { clearTimeout(timer); this.port.signal.removeEventListener('abort', finish); resolve(); };
        const timer = setTimeout(finish, delay); this.port.signal.addEventListener('abort', finish, { once: true });
      });
      if (this.port.signal.aborted || !this.pending) return;
      try {
        if (await this.port.inspect(this.pending.operationId)) { this.accept(await this.port.read()); return; }
      } catch { /* Only a committed original operation unlocks the next write. */ }
    }
    this.error = '设置结果待确认，请稍后查看。';
  }
  async resume(): Promise<void> {
    if (this.work || !this.pending) return;
    this.work = this.inspect().finally(() => { this.work = undefined; this.notify(); });
    await this.work;
  }
}
