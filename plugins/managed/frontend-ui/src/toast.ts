import type { UiElement } from '@nexuspipeline/extension-sdk';
import { bindLocale, type Translate } from './localize.js';

export function surfaceToast(parent: Element, translate: Translate, signal: AbortSignal) {
  const element = document.createElement('nexus-toast') as UiElement<'nexus-toast'>;
  if (!signal.aborted) parent.append(element);
  signal.addEventListener('abort', () => element.remove(), { once: true });
  function show(message: string, tone: UiElement<'nexus-toast'>['tone'] = 'info') {
    if (signal.aborted) return;
    element.message = '';
    element.tone = tone;
    bindLocale(translate, signal, element, 'message', () => { element.message = message ? translate(message) : ''; });
  }
  return { element, show };
}
