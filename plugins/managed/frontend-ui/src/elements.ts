import { bindLocale } from './localize.js';
import { createIdentity } from './identity';
import type { ExtensionSurface, UiElement } from '@nexuspipeline/extension-sdk';
import type { Translate } from './localize.js';

export type Panel = ReturnType<typeof createPanel> & { confirmationHost?: Element };

export function createPanel(surface: ExtensionSurface, title: string, t: Translate = text => text) {
  const owner = new AbortController();
  const signal = AbortSignal.any([surface.signal, owner.signal]);
  const card = document.createElement('nexus-card') as UiElement<'nexus-card'>;
  bindLocale(t, signal, card, 'accessibleName', () => {
    card.accessibleName = t(title);
  });
  card.className = 'plugin-panel';
  const heading = document.createElement('h3');
  bindLocale(t, signal, heading, 'textContent', () => {
    heading.textContent = t(title);
  });
  const body = document.createElement('div');
  body.className = 'plugin-body';
  const status = document.createElement('nexus-toast') as UiElement<'nexus-toast'>;
  status.className = 'plugin-status';
  status.setAttribute('role', 'status');
  card.append(heading, status, body);
  surface.element.append(card);
  let closed = false;
  const cleanup = () => { if (closed) return; closed = true; owner.abort(); card.remove(); };
  surface.signal.addEventListener('abort', cleanup, { once: true, signal: owner.signal });
  const alive = () => !closed && !surface.signal.aborted;
  const say = (message: string, error = false) => {
    if (!alive()) return;
    status.message = '';
    status.tone = error ? 'danger' : 'info';
    bindLocale(t, signal, status, 'message', () => { status.message = t(message); });
    status.classList.toggle('plugin-error', error);
  };
  const run = async (action: () => Promise<void>) => {
    if (!alive()) return;
    try { await action(); }
    catch (error) {
      if (alive()) say(error instanceof Error ? error.message : String(error), true);
    }
  };
  return { card, body, status, alive, say, run, cleanup, signal, t };
}

export function button(panel: Panel, parent: Element, label: string, action: () => void | Promise<void>, signal = panel.signal) {
  const element = document.createElement('nexus-button');
  bindLocale(panel.t, signal, element, 'textContent', () => {
    element.textContent = panel.t(label);
  });
  element.addEventListener('click', () => { void panel.run(async () => action()); }, { signal });
  parent.append(element);
  return element;
}

export function field(panel: Panel, parent: Element, label: string, value: string,
  change: (value: string) => void, type: 'text' | 'password' | 'tel' = 'text', display?: () => string) {
  const wrapper = document.createElement('label');
  wrapper.className = 'plugin-field';
  const caption = document.createElement('span');
  bindLocale(panel.t, panel.signal, caption, 'textContent', () => {
    caption.textContent = display ? display() : panel.t(label);
  });
  const input = document.createElement('nexus-text-input') as HTMLElement & {
    value: string; type: string; readOnly: boolean;
  };
  input.value = value;
  input.type = type;
  if (type === 'password') panel.signal.addEventListener('abort', () => { input.value = ''; }, {once:true});
  bindLocale(panel.t, panel.signal, input, 'aria-label', () => {
    input.setAttribute('aria-label', display ? display() : panel.t(label));
  });
  input.addEventListener('nexus-change', (event) => {
    const detail = (event as CustomEvent<{ value: string }>).detail;
    change(detail.value);
  }, { signal: panel.signal });
  wrapper.append(caption, input);
  parent.append(wrapper);
  return input;
}

export function choice(panel: Panel, parent: Element, label: string, value: string,
  options: readonly { value: string; label: string }[], change: (value: string) => void) {
  const wrapper = document.createElement('label');
  wrapper.className = 'plugin-field';
  const caption = document.createElement('span');
  bindLocale(panel.t, panel.signal, caption, 'textContent', () => {
    caption.textContent = panel.t(label);
  });
  const select = document.createElement('nexus-select') as HTMLElement & {
    value: string; options: readonly { id: string; label: string }[];
  };
  const emptyId = 'empty-' + createIdentity();
  bindLocale(panel.t, panel.signal, select, 'options', () => {
    select.options = options.map(option => ({ id: option.value || emptyId, label: panel.t(option.label) }));
  });
  select.value = value || emptyId;
  bindLocale(panel.t, panel.signal, select, 'aria-label', () => {
    select.setAttribute('aria-label', panel.t(label));
  });
  select.addEventListener('nexus-change', event => {
    const next = (event as CustomEvent<{ value: string }>).detail.value;
    change(next === emptyId ? '' : next);
  }, { signal: panel.signal });
  wrapper.append(caption, select);
  parent.append(wrapper);
  return select;
}

export function toggle(panel: Panel, parent: Element, label: string, value: boolean,
  change: (value: boolean) => void) {
  const wrapper = document.createElement('label');
  wrapper.className = 'plugin-field plugin-toggle';
  const caption = document.createElement('span');
  bindLocale(panel.t, panel.signal, caption, 'textContent', () => {
    caption.textContent = panel.t(label);
  });
  const input = document.createElement('nexus-switch') as HTMLElement & { value: boolean };
  input.value = value;
  input.addEventListener('nexus-change', event => {
    const detail = (event as CustomEvent<{ value: boolean }>).detail;
    change(detail.value);
  }, { signal: panel.signal });
  wrapper.append(caption, input);
  parent.append(wrapper);
  return input;
}

export function range(panel: Panel, parent: Element, label: string, value: number,
  min: number, max: number, preview: (value: number) => void, commit: (value: number) => void) {
  const wrapper = document.createElement('label');
  wrapper.className = 'plugin-field plugin-range';
  const caption = document.createElement('span'); bindLocale(panel.t, panel.signal, caption, 'textContent', () => {
    caption.textContent = panel.t(label);
  });
  const input = document.createElement('nexus-range') as HTMLElement & {
    value: number; min: number; max: number; step: number;
  };
  input.value = value; input.min = min; input.max = max; input.step = 1;
  bindLocale(panel.t, panel.signal, input, 'aria-label', () => {
    input.setAttribute('aria-label', panel.t(label));
  });
  const output = document.createElement('output'); output.textContent = String(value);
  const onValue = (event: Event) => Number((event as CustomEvent<{ value: number }>).detail.value);
  input.addEventListener('nexus-change', event => {
    const next = onValue(event); output.textContent = String(next); preview(next);
  }, { signal: panel.signal });
  input.addEventListener('nexus-commit', event => commit(onValue(event)), { signal: panel.signal });
  wrapper.append(caption, input, output); parent.append(wrapper);
  return input;
}

export function paragraph(parent: Element, value: string) {
  const element = document.createElement('p');
  element.textContent = value;
  parent.append(element);
  return element;
}

export function section(parent: Element, heading: string) {
  const element = document.createElement('section');
  const title = document.createElement('h4');
  title.textContent = heading;
  element.append(title);
  parent.append(element);
  return element;
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const confirmations = new WeakMap<Panel, Promise<boolean>>();
export function confirm(panel: Panel, message: string, tone: 'neutral' | 'warning' | 'danger' = 'neutral'): Promise<boolean> {
  if (!panel.alive()) return Promise.resolve(false);
  const pending = confirmations.get(panel);
  if (pending) return Promise.resolve(false);
  const result = new Promise<boolean>(resolve => {
    const dialog = document.createElement('nexus-confirm-dialog');
    Object.assign(dialog, { open: true, title: panel.t('确认'), message, tone });
    const scope = new AbortController();
    const finish = (value: boolean) => {
      scope.abort(); Object.assign(dialog, { open: false }); dialog.inert = true;
      const exit = new AbortController();
      const dispose = () => { clearTimeout(timer); dialog.remove(); exit.abort(); };
      const timer = setTimeout(dispose, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
      panel.signal.addEventListener('abort', dispose, { once: true, signal: exit.signal });
      if (panel.signal.aborted) dispose();
      resolve(value);
    };
    panel.signal.addEventListener('abort', () => finish(false), { once: true, signal: scope.signal });
    dialog.addEventListener('nexus-confirm', () => finish(true), { signal: scope.signal });
    dialog.addEventListener('nexus-cancel', () => finish(false), { signal: scope.signal });
    dialog.addEventListener('nexus-close', () => finish(false), { signal: scope.signal });
    (panel.confirmationHost ?? panel.card).append(dialog);
  }).finally(() => confirmations.delete(panel));
  confirmations.set(panel, result);
  return result;
}
