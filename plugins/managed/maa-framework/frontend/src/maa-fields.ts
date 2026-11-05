import type { UiElement } from '@nexuspipeline/extension-sdk';
import { field, type Panel } from '../../../frontend-ui/src/elements.js';
import { bindLocale } from '../../../frontend-ui/src/localize.js';

export class MaaFields {
  private readonly invalid = new Map<string, string>();
  private signal: AbortSignal;
  constructor(
    private readonly panel: Panel,
    private readonly changed: () => void
  ) {
    this.signal = panel.signal;
  }
  begin(signal: AbortSignal): void {
    this.signal = signal;
  }

  number(
    parent: HTMLElement,
    title: string,
    value: number,
    minimum: number,
    maximum: number,
    commit: (value: number) => void,
    identity = title,
    display?: () => string
  ): void {
    const input = field(
      { ...this.panel, signal: this.signal },
      parent,
      title,
      this.invalid.get(identity) ?? String(value),
      (raw) => {
        const next = Number(raw);
        if (!raw.trim() || !Number.isInteger(next) || next < minimum || next > maximum) {
          this.invalid.set(identity, raw);
          input.setAttribute('aria-invalid', 'true');
          this.changed();
          this.panel.say(this.panel.t('请先修正无效输入') + '：' + this.panel.t(title), true);
          return;
        }
        this.invalid.delete(identity);
        input.setAttribute('aria-invalid', 'false');
        commit(next);
      },
      'text',
      display
    );
    input.setAttribute('aria-invalid', String(this.invalid.has(identity)));
  }

  json(
    parent: HTMLElement,
    title: string,
    value: Record<string, unknown>,
    commit: (value: Record<string, unknown>) => void,
    identity = title,
    display?: () => string
  ): void {
    const label = document.createElement('label'),
      caption = document.createElement('span');
    label.className = 'plugin-field';
    const input = document.createElement('nexus-text-area') as UiElement<'nexus-text-area'>;
    input.value = this.invalid.get(identity) ?? JSON.stringify(value, null, 2);
    input.rows = 3;
    bindLocale(this.panel.t, this.signal, input, 'caption', () => {
      caption.textContent = display ? display() : this.panel.t(title);
      input.setAttribute('aria-label', caption.textContent);
    });
    input.setAttribute('aria-invalid', String(this.invalid.has(identity)));
    input.addEventListener(
      'nexus-change',
      (event) => {
        const raw = (event as CustomEvent<{ value: string }>).detail.value;
        try {
          const parsed: unknown = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            throw Error('选项须为 JSON 对象');
          this.invalid.delete(identity);
          input.setAttribute('aria-invalid', 'false');
          commit(parsed as Record<string, unknown>);
        } catch (error) {
          this.invalid.set(identity, raw);
          input.setAttribute('aria-invalid', 'true');
          this.changed();
          this.panel.say(error instanceof Error && error.message === '密码须使用受保护输入控件' ? error.message : '选项须为 JSON 对象', true);
        }
      },
      { signal: this.signal }
    );
    label.append(caption, input);
    parent.append(label);
  }

  check(): void {
    if (!this.invalid.size) return;
    const field = this.panel.body.querySelector<HTMLElement>('[aria-invalid=true]'),
      label = field?.getAttribute('aria-label');
    field?.focus();
    throw Error(this.panel.t('请先修正无效输入') + (label ? '：' + this.panel.t(label) : ''));
  }
  clear(): void {
    this.invalid.clear();
  }
  remove(prefix: string): void {
    for (const key of this.invalid.keys()) if (key.startsWith(prefix)) this.invalid.delete(key);
  }
}
