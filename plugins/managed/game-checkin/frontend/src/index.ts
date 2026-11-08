import { bindLocale } from '../../../frontend-ui/src/localize.js';
import {
  contractFingerprint,
  sdkVersion,
  type FrontendExtension,
  type FrontendTransport,
  type ExtensionSurface,
  type UiElement
} from '@nexuspipeline/extension-sdk';
import { confirm, button, createPanel } from '../../../frontend-ui/src/elements.js';
import { localize, type Translate } from '../../../frontend-ui/src/localize.js';
import { openTaskEditor } from './editor.js';
import type { CheckInPorts, CheckInState, CheckInTask } from './ports.js';
import { TaskRows } from './task-rows.js';
import { english } from './messages.js';
import { transportPorts } from './transport-ports.js';
import '../../../frontend-ui/src/style.css';
import './style.css';

function mountPage(surface: ExtensionSurface, t: Translate, provided?: CheckInPorts, locale = 'zh-CN', prepared?: CheckInState) {
  const panel = createPanel(surface, '签到', t);
  panel.card.classList.add('checkin-page');
  panel.card.querySelector('h3')?.remove();
  const heading = document.createElement('header');
  heading.className = 'checkin-heading';
  const titles = document.createElement('div');
  const title = document.createElement('h1');
  bindLocale(t, panel.signal, title, 'textContent', () => {
    title.textContent = t('签到');
  });
  const description = document.createElement('p');
  description.className = 'checkin-description';
  bindLocale(t, panel.signal, description, 'textContent', () => {
    description.textContent = t('管理多平台游戏签到任务和运行计划。');
  });
  titles.append(title, description);
  const add = button(panel, heading, '添加签到任务', () => edit()) as UiElement<'nexus-button'>;
  add.tone = 'info';
  add.disabled = true;
  heading.prepend(titles);
  const list = document.createElement('nexus-sortable-list') as UiElement<'nexus-sortable-list'>;
  list.className = 'checkin-task-list';
  const empty = document.createElement('nexus-empty-state') as UiElement<'nexus-empty-state'>;
  empty.className = 'checkin-empty';
  bindLocale(t, panel.signal, empty, 'title', () => {
    empty.title = t('正在读取签到任务…');
  });
  panel.body.append(heading, panel.status, list, empty);
  if (!provided) {
    bindLocale(t, panel.signal, empty, 'title', () => {
      empty.title = t('签到服务尚未接入');
    });
    return panel.cleanup;
  }
  const ports = provided;
  let state: CheckInState | undefined = prepared, waiting: CheckInState | undefined;
  let visible = surface.visible,
    dragging = false,
    serial = 0,
    drawnRevision = -1;
  let timer: ReturnType<typeof setTimeout> | undefined, request: AbortController | undefined;
  let activeEditor: (() => void) | undefined,
    editorOwner: AbortController | undefined,
    editorGeneration = 0;
  const closeEditor = () => {
    editorGeneration++;
    editorOwner?.abort();
    editorOwner = undefined;
    activeEditor?.();
    activeEditor = undefined;
  };
  const edit = async (task?: CheckInTask) => {
    if (!state) return;
    closeEditor();
    const generation = editorGeneration,
      owner = new AbortController();
    editorOwner = owner;
    try {
      const close = await openTaskEditor(
        {
          get element() { return surface.element; },
          get context() { return surface.context; },
          get scope() { return surface.scope; },
          signal: AbortSignal.any([surface.signal, owner.signal]),
          get visible() { return surface.visible; },
          onVisibilityChanged: surface.onVisibilityChanged.bind(surface),
          setAppearance: surface.setAppearance.bind(surface)
        },
        ports,
        state,
        task,
        update,
        t
      );
      if (!panel.alive() || owner.signal.aborted || generation !== editorGeneration) {
        close();
        return;
      }
      activeEditor = close;
    } catch (error) {
      if (!owner.signal.aborted) throw error;
    }
  };
  const update = (next: CheckInState) => {
    if (
      !panel.alive() ||
      (state && next.revision <= state.revision) ||
      (waiting && next.revision <= waiting.revision)
    )
      return;
    if (dragging) {
      waiting = next;
      return;
    }
    state = next;
    if (visible) draw();
  };
  const rows = new TaskRows(panel, list, locale, {
    edit,
    run: async (task) => update(await ports.runTask(task.id, surface.signal)),
    remove: async (task) => {
      const expectedRevision = state?.configurationRevision;
      if (await confirm(panel, t('删除此任务、计划和凭据？'), 'danger'))
        update(await ports.deleteTask(task.id, surface.signal, expectedRevision));
    }
  });
  const draw = () => {
    add.disabled = !state;
    list.hidden = !state?.tasks.length;
    empty.hidden = !!state?.tasks.length;
    bindLocale(t, panel.signal, empty, 'title', () => {
      empty.title = t(state ? '还没有签到任务' : '正在读取签到任务…');
    });
    bindLocale(t, panel.signal, empty, 'description', () => {
      empty.description = state ? t('创建任务后设置游戏、凭据和定时计划。') : '';
    });
    if (!state) return;
    drawnRevision = state.revision;
    list.ids = state.tasks.map((item) => item.id);
    rows.render(state);
  };
  const refresh = async () => {
    const own = ++serial;
    request?.abort();
    const active = new AbortController();
    request = active;
    try {
      const next = await ports.readState(AbortSignal.any([surface.signal, active.signal]));
      if (panel.alive() && own === serial) update(next);
    } catch (error) {
      if (panel.alive() && own === serial)
        panel.say(error instanceof Error ? error.message : String(error), true);
    } finally {
      if (request === active) request = undefined;
      if (panel.alive() && visible && own === serial)
        timer = setTimeout(() => {
          void refresh();
        }, 5000);
    }
  };
  list.addEventListener(
    'dragstart',
    () => {
      dragging = true;
    },
    { signal: surface.signal }
  );
  list.addEventListener(
    'dragend',
    () => {
      dragging = false;
      const next = waiting;
      waiting = undefined;
      if (next) update(next);
    },
    { signal: surface.signal }
  );
  list.addEventListener(
    'nexus-reorder',
    (event) => {
      void panel.run(async () => {
        const ids = (event as CustomEvent<{ ids: string[] }>).detail.ids;
        if (
          state &&
          ids.length === state.tasks.length &&
          new Set(ids).size === ids.length &&
          ids.every((id) => state!.tasks.some((task) => task.id === id))
        )
          update(await ports.reorderTasks(ids, surface.signal, state.configurationRevision));
      });
    },
    { signal: surface.signal }
  );
  const visibility = surface.onVisibilityChanged((value) => {
    visible = value;
    clearTimeout(timer);
    request?.abort();
    timer = undefined;
    serial++;
    if (value) {
      if (state && drawnRevision !== state.revision) draw();
      void refresh();
    }
  });
  draw();
  if (visible) void refresh();
  return () => {
    serial++;
    clearTimeout(timer);
    request?.abort();
    rows.dispose();
    closeEditor();
    visibility();
    panel.cleanup();
  };
}

export function createExtension(ports?: CheckInPorts): FrontendExtension {
  return {
    extensionId: 'game-checkin',
    sdkVersion,
    contractFingerprint,
    async activate(context) {
      const prepared = ports ? await ports.readState(context.scope.signal) : undefined;
      context.scope.signal.throwIfAborted();
      const t = localize(context, english);
      context.registerRoute({
        id: 'game-checkin.tasks',
        path: '/plugin/game-checkin/tasks',
        get label() { return t('签到'); },
        mount: (surface) => mountPage(surface, t, ports, context.locale, prepared)
      });
      context.registerSurface({
        id: 'game-checkin.navigation',
        target: 'application.navigation',
        mount(surface) {
          const link = document.createElement('a');
          link.href = '/plugin/game-checkin/tasks';
          bindLocale(t, surface.signal, link, 'textContent', () => {
            link.textContent = t('签到');
          });
          surface.element.append(link);
          return () => link.remove();
        }
      });
    }
  };
}
export function createFrontend(transport: FrontendTransport): FrontendExtension {
  return createExtension(transportPorts(transport));
}
export default createExtension();
