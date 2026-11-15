import type { UiElement } from '@nexuspipeline/extension-sdk';
import { bindLocale } from './localize.js';
import type { Panel } from './elements.js';

export function fieldHelp(panel: Panel, anchor: HTMLElement, content: string | (() => string), signal = panel.signal) {
  const tooltip = document.createElement('nexus-tooltip') as UiElement<'nexus-tooltip'>;
  tooltip.style.cssText = 'position:absolute;width:0;height:0';
  tooltip.anchor = anchor;
  bindLocale(panel.t, signal, tooltip, 'content', () => {
    tooltip.content = typeof content === 'function' ? content() : panel.t(content);
  });
  anchor.after(tooltip);
  signal.addEventListener('abort', () => tooltip.remove(), { once: true });
  return tooltip;
}
