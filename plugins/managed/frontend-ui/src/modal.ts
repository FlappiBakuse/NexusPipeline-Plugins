import { bindLocale } from './localize.js';
import type { Panel } from './elements.js';
import type { UiElement } from '@nexuspipeline/extension-sdk';

export function createModal(panel: Panel, title: string, secondary = false, onClose?: (reason: 'close' | 'cancel' | 'saved') => void, onDisposed?: () => void, visible = true) {
  const element = document.createElement('nexus-modal') as UiElement<'nexus-modal'>;
  bindLocale(panel.t, panel.signal, element, 'title', () => {
    element.title = panel.t(title);
  });
  element.size = 'wide';
  element.surface = secondary ? 'secondary' : 'primary';
  const body = document.createElement('div');
  const footer = document.createElement('div'); footer.slot = 'footer'; footer.className = 'plugin-actions';
  element.append(body);
  const owner = new AbortController();
  const signal = AbortSignal.any([panel.signal, owner.signal]);
  let closing = false, disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
  const dispose = () => { if (disposed) return; disposed = true; clearTimeout(timer); owner.abort(); element.remove(); onDisposed?.(); };
  const close = (reason: 'close' | 'cancel' | 'saved' = 'close') => {
    if (closing) return;
    closing = true; element.open = false; element.inert = true; owner.abort(); onClose?.(reason);
    timer = setTimeout(dispose, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
  };
  element.addEventListener('nexus-close', () => close(), { signal });
  panel.signal.addEventListener('abort', dispose, { once: true, signal: owner.signal });
  element.hidden = !visible; element.inert = !visible; panel.card.append(element); element.open = visible;
  return { element, body, footer, signal, close, dispose, alive: () => !closing && !disposed && !panel.signal.aborted,
    setVisible(visible: boolean) { if (!closing && !disposed) { element.hidden = !visible; element.inert = !visible; element.open = visible; } } };
}

export type PluginModal = ReturnType<typeof createModal>;
