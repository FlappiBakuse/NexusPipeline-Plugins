import { TaskRows } from '../../plugins/managed/game-checkin/frontend/src/task-rows.js';
import { createPanel } from '../../plugins/managed/frontend-ui/src/elements.js';
import type { Translate } from '../../plugins/managed/frontend-ui/src/localize.js';
import type { CheckInState, CheckInTask } from '../../plugins/managed/game-checkin/frontend/src/ports.js';

export function rowOwnership(): { checks: string[]; counts: number[] } {
  const checks: string[] = [], counts: number[] = [], listeners = new Set<() => void>();
  let language = 'zh-CN';
  const t: Translate = text => language === 'en-US' && text === '已启用' ? 'Enabled' : text;
  t.watch = (callback, signal) => {
    listeners.add(callback);
    signal.addEventListener('abort', () => listeners.delete(callback), { once: true });
  };
  t.locale = () => language;
  const owner = new AbortController(), host = document.createElement('div'); document.body.append(host);
  const surface = { element: host, signal: owner.signal } as Parameters<typeof createPanel>[0];
  const panel = createPanel(surface, 'Rows', t), list = document.createElement('ol'); panel.body.append(list);
  const baseline = listeners.size;
  const rows = new TaskRows(panel, list, language, { edit: async () => {}, run: async () => {}, remove: async () => {} });
  const task = (id: string): CheckInTask => ({ id, name: id, remark: '', enabled: true, games: { kuro: ['ww'] },
    schedules: [], notification: { enabled: false, notificationTaskIds: [] }, isRunning: false });
  let state: CheckInState = { revision: 1, timeZoneId: 'UTC', tasks: [task('one'), task('two')], platforms: [], notificationTasks: [] };
  const check = (condition: boolean, name: string) => { if (!condition) throw new Error(name); checks.push(name); };
  try {
    rows.render(state); const initial = listeners.size; counts.push(baseline, initial);
    for (let index = 0; index < 50; index++) {
      state = { ...state, revision: index + 2, tasks: [state.tasks[0]!, { ...state.tasks[1]!, remark: 'update-' + index }] };
      rows.render(state); check(listeners.size <= initial, 'update ' + index + ' does not accumulate listeners');
    }
    state = { ...state, tasks: [state.tasks[1]!] }; rows.render(state); counts.push(listeners.size);
    check(!list.querySelector('[data-item-id=one]') && !!list.querySelector('[data-item-id=two]'),
      'deleting one row preserves the other task');
    language = 'en-US'; for (const listener of [...listeners]) listener();
    check(list.querySelector('nexus-badge')?.label === 'Enabled', 'remaining row visibly follows locale');
    rows.dispose(); counts.push(listeners.size);
    check(listeners.size === baseline, 'row disposal releases all row watchers');
    owner.abort(); counts.push(listeners.size);
    check(listeners.size === 0, 'page disposal releases the remaining page watchers');
    return { checks, counts };
  } finally { rows.dispose(); owner.abort(); host.remove(); }
}
