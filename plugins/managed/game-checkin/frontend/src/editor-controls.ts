import { bindLocale } from '../../../frontend-ui/src/localize.js';
import type { UiElement } from '@nexuspipeline/extension-sdk';
import type { Panel } from '../../../frontend-ui/src/elements.js';

export function label(panel: Panel, parent: HTMLElement, title: string | (() => string)): HTMLLabelElement {
  const element = document.createElement('label'),
    caption = document.createElement('span');
  element.className = 'checkin-label';
  bindLocale(panel.t, panel.signal, caption, 'textContent', () => {
    caption.textContent = typeof title === 'function' ? title() : panel.t(title);
  });
  element.append(caption);
  parent.append(element);
  return element;
}

export function setting(
  panel: Panel,
  parent: HTMLElement,
  title: string,
  description: string,
  value: boolean,
  change: (value: boolean) => void
) {
  const control = document.createElement('nexus-switch-setting') as UiElement<'nexus-switch-setting'>;
  bindLocale(panel.t, panel.signal, control, 'title', () => {
    control.title = panel.t(title);
  });
  bindLocale(panel.t, panel.signal, control, 'description', () => {
    control.description = panel.t(description);
  });
  control.value = value;
  control.setAttribute('data-draft-field', title);
  control.className = 'checkin-setting';
  control.addEventListener(
    'nexus-change',
    (event) => change((event as CustomEvent<{ value: boolean }>).detail.value),
    { signal: panel.signal }
  );
  parent.append(control);
  return control;
}
