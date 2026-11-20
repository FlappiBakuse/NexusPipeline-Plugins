import type { UiElement } from '@nexuspipeline/extension-sdk';
import { bindLocale } from './localize.js';
import type { Panel } from './elements.js';

export function fieldHelp(panel: Panel, anchor: HTMLElement, content: string | (() => string), signal = panel.signal) {
  const tooltip = document.createElement('nexus-tooltip') as UiElement<'nexus-tooltip'>;
  tooltip.anchor = anchor;
  bindLocale(panel.t, signal, tooltip, 'content', () => {
    tooltip.content = typeof content === 'function' ? content() : panel.t(content);
  });
  const caption = anchor.closest('label')?.querySelector(':scope > span:first-child');
  if (caption && !caption.contains(anchor)) {
    const row = document.createElement('span');
    caption.before(row);
    row.append(caption, tooltip);
    signal.addEventListener('abort', () => { row.before(caption); row.remove(); }, { once: true });
  } else {
    anchor.after(tooltip);
    signal.addEventListener('abort', () => tooltip.remove(), { once: true });
  }
  return tooltip;
}
