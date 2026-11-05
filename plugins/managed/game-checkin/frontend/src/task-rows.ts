import { bindLocale } from '../../../frontend-ui/src/localize.js';
import type { UiElement } from '@nexuspipeline/extension-sdk';
import { button, type Panel } from '../../../frontend-ui/src/elements.js';
import type { CheckInRun, CheckInState, CheckInTask } from './ports.js';

interface TaskRow {
  element: HTMLLIElement;
  owner: AbortController;
  fingerprint: string;
}
const statusLabels: Record<string, string> = {
  success: '全部成功',
  partial: '部分成功',
  failed: '全部失败',
  running: '运行中',
  cancelled: '已取消',
  interrupted: '程序关闭时中断',
  unknown: '结果待确认'
};

export class TaskRows {
  private readonly rows = new Map<string, TaskRow>();
  constructor(
    private readonly panel: Panel,
    private readonly list: HTMLElement,
    private readonly locale: string,
    private readonly actions: {
      edit: (task: CheckInTask) => Promise<void>;
      run: (task: CheckInTask) => Promise<void>;
      remove: (task: CheckInTask) => Promise<void>;
    }
  ) {}

  render(state: CheckInState): void {
    for (const [id, row] of this.rows)
      if (!state.tasks.some((task) => task.id === id)) {
        row.owner.abort();
        row.element.remove();
        this.rows.delete(id);
      }
    state.tasks.forEach((task, index) => {
      const fingerprint = JSON.stringify([task, state.platforms]);
      const old = this.rows.get(task.id);
      if (old?.fingerprint !== fingerprint) {
        const expanded = new Set(
          Array.from(old?.element.querySelectorAll<HTMLDetailsElement>('details[open]') || []).map(
            (details) => details.dataset.runId || details.className
          )
        );
        const active =
          document.activeElement instanceof HTMLElement && old?.element.contains(document.activeElement)
            ? { tag: document.activeElement.localName, text: document.activeElement.textContent }
            : undefined;
        old?.owner.abort();
        const row = this.create(task, state, old?.element);
        row.fingerprint = fingerprint;
        this.rows.set(task.id, row);
        row.element.querySelectorAll('details').forEach((details) => {
          details.open = expanded.has(details.dataset.runId || details.className);
        });
        if (active)
          Array.from(row.element.querySelectorAll<HTMLElement>(active.tag))
            .find((element) => element.textContent === active.text)
            ?.focus();
      }
      const element = this.rows.get(task.id)!.element;
      if (this.list.children[index] !== element)
        this.list.insertBefore(element, this.list.children[index] ?? null);
    });
  }

  private badge(
    panel: Panel,
    parent: HTMLElement,
    label: string | (() => string),
    tone: 'neutral' | 'success' | 'info' | 'danger' | 'warning' = 'neutral'
  ): void {
    const badge = document.createElement('nexus-badge') as UiElement<'nexus-badge'>;
    bindLocale(panel.t, panel.signal, badge, 'label', () => {
      badge.label = typeof label === 'function' ? label() : panel.t(label);
    });
    badge.tone = tone;
    parent.append(badge);
  }

  private date(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const locale = this.panel.t.locale?.() ?? this.locale;
    if (!locale.toLowerCase().startsWith('zh'))
      return new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    const parts = new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).formatToParts(date);
    const part = (kind: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === kind)?.value || '';
    return `${part('month')}-${part('day')} ${part('dayPeriod')}${part('hour')}:${part('minute')}`;
  }

  private create(task: CheckInTask, state: CheckInState, element = document.createElement('li')): TaskRow {
    const owner = new AbortController(),
      signal = AbortSignal.any([this.panel.signal, owner.signal]);
    const panel = { ...this.panel, signal };
    element.replaceChildren();
    element.className = 'checkin-task';
    element.dataset.itemId = task.id;
    const head = document.createElement('div');
    head.className = 'checkin-task-head';
    const handle = document.createElement('nexus-drag-handle') as UiElement<'nexus-drag-handle'>;
    handle.itemId = task.id;
    bindLocale(panel.t, panel.signal, handle, 'label', () => {
      handle.label = `${panel.t('调整')} ${task.name} ${panel.t('的顺序')}`;
    });
    const avatar = document.createElement('span');
    avatar.className = 'checkin-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    bindLocale(panel.t, panel.signal, avatar, 'textContent', () => {
      avatar.textContent = Array.from(task.name.trim())[0] || panel.t('签');
    });
    const copy = document.createElement('div');
    copy.className = 'checkin-task-copy';
    const name = document.createElement('h2'),
      text = document.createElement('nexus-overflow-text') as UiElement<'nexus-overflow-text'>;
    text.text = task.name;
    name.append(text);
    copy.append(name);
    if (task.remark) {
      const note = document.createElement('p');
      note.className = 'checkin-remark';
      note.textContent = task.remark;
      copy.append(note);
    }
    const meta = document.createElement('div');
    meta.className = 'checkin-meta';
    this.badge(panel, meta, task.enabled ? '已启用' : '已停用', task.enabled ? 'success' : 'neutral');
    if (task.isRunning || task.recentRun) {
      const status = task.isRunning ? 'running' : task.recentRun!.status;
      this.badge(
        panel,
        meta,
        statusLabels[status] || status,
        status === 'success' ? 'success' : status === 'failed' ? 'danger' : 'warning'
      );
    }
    this.badge(panel, meta, task.notification.enabled ? '通知已开启' : '通知已关闭', 'info');
    this.badge(
      panel,
      meta,
      () => `${Object.values(task.games).reduce((count, games) => count + games.length, 0)} ${panel.t('个游戏')}`
    );
    this.badge(
      panel,
      meta,
      () => task.nextRunAt ? `${panel.t('下次')} ${this.date(task.nextRunAt)}` : panel.t('未安排下次运行'),
      'info'
    );
    copy.append(meta);
    const actions = document.createElement('div');
    actions.className = 'checkin-task-actions';
    for (const [id, label, action] of [
      ['run', '立即签到', this.actions.run],
      ['edit', '编辑签到', this.actions.edit],
      ['delete', '删除签到', this.actions.remove]
    ] as const) {
      const control = button(panel, actions, label, async () => {
        if (task.isRunning && id !== 'delete') return;
        const controls = Array.from(actions.querySelectorAll<UiElement<'nexus-button'>>('nexus-button'));
        controls.forEach((item) => {
          item.disabled = true;
        });
        try {
          await action(task);
        } finally {
          if (!signal.aborted)
            controls.forEach((item) => {
              item.disabled = task.isRunning && item.dataset.action !== 'delete';
            });
        }
      }) as UiElement<'nexus-button'>;
      control.dataset.action = id;
      control.disabled = task.isRunning && id !== 'delete';
      if (label === '删除签到') control.tone = 'danger';
    }
    head.append(handle, avatar, copy, actions);
    element.append(head);
    const runs = task.runs || (task.recentRun ? [task.recentRun] : []);
    if (runs.length) element.append(this.records(panel, runs, state));
    return { element, owner, fingerprint: '' };
  }

  private records(panel: Panel, runs: readonly CheckInRun[], state: CheckInState): HTMLDetailsElement {
    const details = document.createElement('details');
    details.className = 'checkin-records';
    const summary = document.createElement('summary');
    bindLocale(panel.t, panel.signal, summary, 'textContent', () => {
      summary.textContent = panel.t('运行记录');
    });
    details.append(summary);
    const list = document.createElement('ol');
    for (const run of runs) {
      const item = document.createElement('li'),
        heading = document.createElement('div');
      heading.className = 'checkin-run-heading';
      const time = document.createElement('time');
      bindLocale(panel.t, panel.signal, time, 'textContent', () => {
        time.textContent = this.date(run.completedAt || run.startedAt);
      });
      heading.append(time);
      this.badge(
        panel,
        heading,
        statusLabels[run.status] || run.status,
        run.status === 'success' ? 'success' : 'warning'
      );
      item.append(heading);
      for (const result of run.results) {
        const platform = state.platforms.find((value) => value.id === result.platform),
          text = document.createElement('p');
        text.textContent = `${platform?.name || result.platform} · ${platform?.games.find((game) => game.id === result.gameCode)?.name || result.gameCode} · ${result.message}`;
        item.append(text);
      }
      if (run.diagnostics?.length) {
        const diagnostic = document.createElement('details'),
          label = document.createElement('summary'),
          raw = document.createElement('pre');
        diagnostic.dataset.runId = run.id || run.startedAt;
        bindLocale(panel.t, panel.signal, label, 'textContent', () => {
          label.textContent = panel.t('本次脱敏诊断');
        });
        raw.textContent = JSON.stringify(run.diagnostics, null, 2);
        diagnostic.append(label, raw);
        item.append(diagnostic);
      }
      list.append(item);
    }
    details.append(list);
    return details;
  }

  dispose(): void {
    for (const row of this.rows.values()) row.owner.abort();
    this.rows.clear();
  }
}
