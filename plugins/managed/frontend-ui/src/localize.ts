import type { FrontendExtensionContext } from '@nexuspipeline/extension-sdk';

export type Translate = ((text: string) => string) & {
  watch?: (listener: () => void, signal: AbortSignal) => void;
  locale?: () => string;
};

export function localize(context: FrontendExtensionContext, english: Readonly<Record<string, string>>): Translate {
  const listeners = new Set<() => void>();
  let stop: (() => void) | undefined;
  const release = () => {
    stop?.(); stop = undefined; listeners.clear();
    context.scope.signal.removeEventListener('abort', release);
  };
  const translate: Translate = text => {
    const translated = context.translate(text);
    if (translated !== text) return translated;
    return context.locale === 'en-US' ? english[text] ?? text : text;
  };
  translate.locale = () => context.locale;
  translate.watch = (listener, signal) => {
    if (signal.aborted || context.scope.signal.aborted) return;
    if (!listeners.size) context.scope.signal.addEventListener('abort', release, { once: true });
    listeners.add(listener);
    stop ??= context.onLocaleChanged(() => {
      for (const refresh of listeners) refresh();
    });
    signal.addEventListener('abort', () => {
      listeners.delete(listener);
      if (!listeners.size) release();
    }, { once: true });
  };
  return translate;
}

export function watchLocale(t: Translate, signal: AbortSignal, apply: () => void): void {
  if (signal.aborted) return;
  apply();
  t.watch?.(apply, signal);
}

const bindings = new WeakMap<object, Map<string, { apply: () => void; signal: AbortSignal }>>();

export function bindLocale(t: Translate, signal: AbortSignal, target: object, key: string, apply: () => void): void {
  if (signal.aborted) return;
  let entries = bindings.get(target);
  if (!entries) { entries = new Map(); bindings.set(target, entries); }
  const previous = entries.get(key);
  if (previous?.signal === signal) {
    previous.apply = apply;
    apply();
    return;
  }
  const entry = { apply, signal };
  entries.set(key, entry);
  watchLocale(t, signal, () => {
    if (entries.get(key) === entry) entry.apply();
  });
  signal.addEventListener('abort', () => {
    if (entries.get(key) === entry) entries.delete(key);
  }, { once: true });
}
