import {
  contractFingerprint,
  sdkVersion,
  type FrontendExtension,
  type FrontendTransport,
  type ExtensionSurface
} from '@nexuspipeline/extension-sdk';
import { createPanel } from '../../../frontend-ui/src/elements.js';
import { localize, type Translate } from '../../../frontend-ui/src/localize.js';
import type { PluginModal } from '../../../frontend-ui/src/modal.js';
import type { ActivityFeed, ActivityPorts, ActivityState } from './ports.js';
import { createCarousel } from './carousel-view.js';
import { openActivityDetails } from './activity-details.js';
import { openActivitySettings } from './activity-settings.js';
import { english } from './messages.js';
import { transportPorts } from './transport-ports.js';
import '../../../frontend-ui/src/style.css';
import './style.css';

function mountCarousel(surface: ExtensionSurface, t: Translate, locale: string, ports?: ActivityPorts) {
  const panel = createPanel(surface, '游戏活动', t);
  panel.card.classList.add('activity-panel');
  if (!ports) {
    panel.say('活动服务尚未接入');
    return panel.cleanup;
  }
  let state: ActivityState | undefined,
    active = 0,
    hovered = false,
    focused = false;
  let paused = false,
    expanded = false,
    visible = surface.visible,
    refreshing = false;
  let details: PluginModal | undefined, settings: PluginModal | undefined;
  let serverNow = Date.now(),
    origin = performance.now(),
    nextSlideAt = performance.now();
  const now = () => serverNow + performance.now() - origin;
  const feeds = (): ActivityFeed[] =>
    [...(state?.feeds ?? [])]
      .filter((feed) => state?.selectedFeedIds.includes(feed.id) && feed.enabled)
      .sort((a, b) => (state?.gameOrder?.indexOf(a.game) ?? -1) - (state?.gameOrder?.indexOf(b.game) ?? -1));
  const reset = () => {
    nextSlideAt = performance.now() + (state?.rotationSeconds ?? 30) * 1000;
  };
  const select = (index: number) => {
    const size = feeds().length;
    active = size ? (index + size) % size : 0;
    view.select(active);
    reset();
  };
  const showDetails = (feed: ActivityFeed) => {
    if (details || settings || !state) return;
    details = openActivityDetails(panel, ports, feed, state, locale, now(), () => {
      details = undefined;
      reset();
    });
  };
  const showSettings = () => {
    if (settings || details || !state) return;
    settings = openActivitySettings(panel, ports, state, locale, update, () => {
      settings = undefined;
      reset();
    });
  };
  const view = createCarousel(panel, surface, ports, locale, now, {
    select,
    details: showDetails,
    settings: showSettings,
    refresh: () => {
      if (refreshing) return;
      refreshing = true;
      view.refreshing(true);
      void panel.run(async () => {
        try {
          update(await ports.refreshAll(panel.signal));
        } finally {
          refreshing = false;
          if (state) view.status(state);
          else view.refreshing(false);
        }
      });
    },
    pause: () => {
      paused = !paused;
      view.appearance(expanded, paused);
      reset();
    },
    expand: () => {
      expanded = !expanded;
      view.appearance(expanded, paused);
    }
  });
  function update(next: ActivityState): void {
    if (!panel.alive() || (state && next.revision < state.revision)) return;
    const selected = feeds()[active]?.id,
      changed = !state || next.revision !== state.revision;
    state = next;
    const parsed = next.serverNowUtc ? Date.parse(next.serverNowUtc) : NaN;
    serverNow = Number.isFinite(parsed) ? parsed : Date.now();
    origin = performance.now();
    if (changed) {
      const index = feeds().findIndex((feed) => feed.id === selected);
      active = Math.max(0, index);
      view.render(next, feeds(), active);
      view.appearance(expanded, paused);
      reset();
    } else view.tick();
    view.status(next);
    const refresh = next.refreshStatus ?? next.refreshOperation?.status;
    const failure =
      refresh === 'partial' ? '部分失败，保留原数据' : refresh === 'failed' ? '刷新失败，保留原数据' : '';
    panel.status.setAttribute('role', failure ? 'alert' : 'status');
    panel.say(failure, !!failure);
  }
  let rotation: ReturnType<typeof setInterval> | undefined;
  let countdown: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;
  let reading: AbortController | undefined;
  const rotate = () => {
    if (!state || state.rotationSeconds < 0) return;
    const blocked =
      !visible ||
      document.hidden ||
      paused ||
      !!details ||
      !!settings ||
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (hovered && state.pauseOnHover) ||
      (focused && state.pauseOnInteraction);
    if (blocked) {
      reset();
      return;
    }
    if (performance.now() >= nextSlideAt && feeds().length > 1) select(active + 1);
  };
  panel.card.addEventListener(
    'pointerenter',
    () => {
      hovered = true;
    },
    { signal: panel.signal }
  );
  panel.card.addEventListener(
    'pointerleave',
    () => {
      hovered = false;
    },
    { signal: panel.signal }
  );
  panel.card.addEventListener(
    'focusin',
    () => {
      focused = true;
    },
    { signal: panel.signal }
  );
  panel.card.addEventListener(
    'focusout',
    (event) => {
      focused = panel.card.contains(event.relatedTarget as Node | null);
    },
    { signal: panel.signal }
  );
  const stopDisplay = () => {
    clearInterval(rotation); rotation = undefined;
    clearInterval(countdown); countdown = undefined;
    unsubscribe?.(); unsubscribe = undefined;
    reading?.abort(); reading = undefined;
  };
  const syncDisplay = () => {
    const shown = visible && !document.hidden;
    view.setVisible(shown);
    details?.setVisible(shown);
    settings?.setVisible(shown);
    reset();
    if (!shown) { stopDisplay(); return; }
    if (unsubscribe) return;
    const owner = new AbortController(); reading = owner;
    unsubscribe = ports.subscribe(update);
    rotation = setInterval(rotate, 250);
    countdown = setInterval(() => view.tick(), 1000);
    void panel.run(async () => {
      const next = await ports.readState(AbortSignal.any([panel.signal, owner.signal]));
      if (!owner.signal.aborted && reading === owner) update(next);
    });
  };
  const visibility = surface.onVisibilityChanged((value) => { visible = value; syncDisplay(); });
  document.addEventListener('visibilitychange', syncDisplay, { signal: panel.signal });
  syncDisplay();
  return () => {
    stopDisplay();
    visibility();
    details?.dispose();
    settings?.dispose();
    view.dispose();
    panel.cleanup();
  };
}

export function createExtension(ports?: ActivityPorts): FrontendExtension {
  return {
    extensionId: 'game-activities',
    sdkVersion,
    contractFingerprint,
    activate(context) {
      context.registerSurface({
        id: 'game-activities.carousel',
        target: 'overview.cards',
        mount: (surface) => mountCarousel(surface, localize(context, english), context.locale, ports)
      });
    }
  };
}
export function createFrontend(transport: FrontendTransport): FrontendExtension {
  return createExtension(transportPorts(transport));
}
export default createExtension();
