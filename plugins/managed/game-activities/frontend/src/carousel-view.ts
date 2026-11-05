import { bindLocale } from '../../../frontend-ui/src/localize.js';
import type { ExtensionSurface, UiElement } from '@nexuspipeline/extension-sdk';
import type { Panel } from '../../../frontend-ui/src/elements.js';
import { boundedImage } from '../../../frontend-ui/src/image-bound.js';
import type { ActivityFeed, ActivityPorts, ActivityState } from './ports.js';
import { formatTime, remaining } from './time-view.js';
import { gameName } from './activity-labels.js';

export function createCarousel(
  panel: Panel,
  surface: ExtensionSurface,
  ports: ActivityPorts,
  locale: string,
  now: () => number,
  actions: {
    select: (index: number) => void;
    details: (feed: ActivityFeed) => void;
    settings: () => void;
    refresh: () => void;
    pause: () => void;
    expand: () => void;
  }
) {
  const stage = document.createElement('div');
  stage.className = 'activity-carousel';
  stage.tabIndex = 0;
  stage.setAttribute('role', 'region');
  stage.setAttribute('aria-roledescription', 'carousel');
  bindLocale(panel.t, panel.signal, stage, 'aria-label', () => {
    stage.setAttribute('aria-label', panel.t('游戏活动轮播'));
  });
  const viewport = document.createElement('div');
  viewport.className = 'activity-viewport';
  const track = document.createElement('div');
  track.className = 'activity-track';
  viewport.append(track);
  const tools = document.createElement('div');
  tools.className = 'activity-tools';
  const indicators = document.createElement('div');
  indicators.className = 'activity-indicators';
  const owner = new AbortController();
  const signal = AbortSignal.any([panel.signal, owner.signal]);
  let contentOwner = new AbortController(),
    imageOwner = new AbortController();
  const urls = new Map<string, string>();
  let generation = 0,
    items: ActivityFeed[] = [],
    state: ActivityState | undefined,
    selected = 0;
  let visible = surface.visible,
    expanded = false,
    paused = false;
  const timings = new Map<string, HTMLElement>();
  const tooltips = new Map<UiElement<'nexus-icon-button'>, UiElement<'nexus-tooltip'>>();
  const icon = (parent: Element, label: string, glyph: string, action: () => void, className = '') => {
    const button = document.createElement('nexus-icon-button') as UiElement<'nexus-icon-button'>;
    bindLocale(panel.t, panel.signal, button, 'label', () => {
      button.label = panel.t(label);
    });
    button.className = className;
    const content = document.createElement('span');
    content.slot = 'icon';
    content.textContent = glyph;
    content.setAttribute('aria-hidden', 'true');
    button.append(content);
    button.addEventListener(
      'click',
      () => {
        void panel.run(async () => action());
      },
      { signal }
    );
    if (className) parent.append(button);
    else {
      const tooltip = document.createElement('nexus-tooltip') as UiElement<'nexus-tooltip'>;
      bindLocale(panel.t, signal, tooltip, 'content', () => {
        tooltip.content = panel.t(label);
      });
      tooltip.anchor = button;
      tooltip.append(button);
      parent.append(tooltip);
      tooltips.set(button, tooltip);
    }
    return button;
  };
  const expandButton = icon(tools, '放大卡片', '', actions.expand);
  const resizeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  resizeIcon.setAttribute('viewBox', '0 0 24 24');
  resizeIcon.setAttribute('fill', 'none');
  resizeIcon.setAttribute('stroke', 'currentColor');
  resizeIcon.setAttribute('stroke-width', '2');
  resizeIcon.setAttribute('stroke-linecap', 'round');
  resizeIcon.setAttribute('stroke-linejoin', 'round');
  const resizePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  resizeIcon.append(resizePath);
  expandButton.querySelector('span')!.append(resizeIcon);
  const pauseButton = icon(tools, '暂停轮播', '⏸️', actions.pause);
  const refreshButton = icon(tools, '刷新', '🔄', actions.refresh);
  const settingsButton = icon(tools, '活动设置', '⚙️', actions.settings);
  const previous = icon(stage, '上一款游戏', '‹', () => actions.select(selected - 1), 'activity-previous');
  const next = icon(stage, '下一款游戏', '›', () => actions.select(selected + 1), 'activity-next');
  stage.append(viewport, tools, indicators);
  panel.body.append(stage);
  const showTool = (button: UiElement<'nexus-icon-button'>, show: boolean) => {
    button.hidden = !show;
    const tooltip = tooltips.get(button);
    if (tooltip) tooltip.hidden = !show;
  };
  for (const button of [expandButton, pauseButton, refreshButton]) showTool(button, false);
  settingsButton.disabled = true;
  previous.hidden = next.hidden = indicators.hidden = true;
  stage.setAttribute('aria-busy', 'true');
  stage.addEventListener(
    'keydown',
    (event) => {
      if (event.target !== stage || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      actions.select(selected + (event.key === 'ArrowLeft' ? -1 : 1));
    },
    { signal }
  );

  function select(index: number): void {
    selected = items.length ? (index + items.length) % items.length : 0;
    track.style.transform = `translateX(${-selected * 100}%)`;
    Array.from(track.children).forEach((element, position) => {
      (element as HTMLElement).inert = position !== selected;
      element.setAttribute('aria-hidden', String(position !== selected));
    });
    Array.from(indicators.children).forEach((element, position) => {
      element.setAttribute('aria-current', String(position === selected));
    });
  }

  function tick(): void {
    if (!state) return;
    for (const feed of items) {
      const timing = timings.get(feed.id);
      if (!timing) continue;
      const end = feed.overview.end;
      if (!timing.childElementCount) timing.append(document.createElement('span'),
        document.createElement('time'), document.createElement('strong'));
      const [label, date, left] = Array.from(timing.children) as HTMLElement[];
      label.textContent = panel.t('本期截止');
      date.textContent = formatTime(
        end,
        state.displayZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        panel.t.locale?.() ?? locale,
        panel.t
      );
      left.textContent = remaining(end, now(), panel.t).replace(panel.t('距离结束') + ' ', '');
      timing.hidden = !end;
    }
  }

  async function loadCover(feed: ActivityFeed, image: HTMLImageElement, own: number): Promise<void> {
    if (!feed.overview.coverId || !visible) return;
    try {
      const candidate = await ports.readCover(
        feed.overview.coverId,
        AbortSignal.any([signal, imageOwner.signal])
      );
      if (!panel.alive() || own !== generation || !visible) return;
      const blob = await boundedImage(candidate);
      if (!panel.alive() || own !== generation || !visible) return;
      const url = URL.createObjectURL(blob);
      urls.set(feed.id, url);
      image.src = url;
    } catch {
      /* The cover remains a drawn fallback while feed content stays accessible. */
    }
  }

  function release(): void {
    generation++;
    imageOwner.abort();
    imageOwner = new AbortController();
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
    for (const image of track.querySelectorAll('img')) image.removeAttribute('src');
  }

  function render(nextState: ActivityState, feeds: ActivityFeed[], index: number): void {
    state = nextState;
    items = feeds;
    release();
    timings.clear();
    track.replaceChildren();
    indicators.replaceChildren();
    contentOwner.abort();
    contentOwner = new AbortController();
    const contentSignal = AbortSignal.any([signal, contentOwner.signal]);
    const own = generation;
    for (const [position, feed] of feeds.entries()) {
      const slide = document.createElement('article');
      slide.className = 'activity-slide';
      const image = document.createElement('img');
      image.alt = feed.overview.title;
      image.className = 'activity-cover';
      slide.append(image);
      void loadCover(feed, image, own);
      const copy = document.createElement('div');
      copy.className = 'activity-copy';
      const meta = document.createElement('div');
      meta.className = 'activity-meta';
      const name = document.createElement('strong');
      bindLocale(panel.t, contentSignal, name, 'textContent', () => {
        name.textContent = gameName(feed.game, panel.t);
      });
      meta.append(name);
      for (const value of [
        () => feed.overview.number ? panel.t('版本') + ' ' + feed.overview.number : panel.t('版本待核验'),
        () => feed.server
      ]) {
        const badge = document.createElement('span');
        bindLocale(panel.t, contentSignal, badge, 'textContent', () => { badge.textContent = value(); });
        meta.append(badge);
      }
      const title = document.createElement('h3');
      bindLocale(panel.t, panel.signal, title, 'textContent', () => {
        title.textContent = feed.overview.title || panel.t('当前活动概览');
      });
      const timing = document.createElement('div');
      timing.className = 'activity-deadline';
      timings.set(feed.id, timing);
      copy.append(meta, title, timing);
      slide.append(copy);
      const hit = document.createElement('button');
      hit.type = 'button';
      hit.className = 'activity-hit';
      bindLocale(panel.t, panel.signal, hit, 'aria-label', () => {
        hit.setAttribute('aria-label', panel.t('查看') + gameName(feed.game, panel.t) + panel.t('活动详情'));
      });
      hit.addEventListener('click', () => actions.details(feed), { signal: contentSignal });
      slide.append(hit);
      track.append(slide);
      const indicator = document.createElement('button');
      indicator.type = 'button';
      indicator.className = 'activity-indicator';
      bindLocale(panel.t, panel.signal, indicator, 'aria-label', () => {
        indicator.setAttribute('aria-label', panel.t('显示') + ' ' + gameName(feed.game, panel.t));
      });
      indicator.addEventListener('click', () => actions.select(position), { signal: contentSignal });
      indicators.append(indicator);
    }
    if (!feeds.length) {
      const empty = document.createElement('p');
      empty.className = 'activity-empty';
      bindLocale(panel.t, panel.signal, empty, 'textContent', () => {
        empty.textContent = panel.t('请选择要订阅的游戏。');
      });
      track.append(empty);
    }
    previous.hidden = next.hidden = indicators.hidden = feeds.length < 2;
    showTool(expandButton, !!feeds.length);
    showTool(refreshButton, !!feeds.length);
    showTool(pauseButton, nextState.rotationSeconds >= 0 && feeds.length > 1);
    settingsButton.disabled = false;
    status(nextState);
    select(index);
    tick();
  }

  function appearance(isExpanded: boolean, isPaused: boolean): void {
    expanded = isExpanded;
    paused = isPaused;
    stage.classList.toggle('activity-expanded', expanded);
    resizePath.setAttribute(
      'd',
      expanded ? 'M3 10H10V3M10 10 3 3M21 14H14V21M14 14 21 21' : 'M3 8V3H8M3 3 10 10M16 21H21V16M21 21 14 14'
    );
    bindLocale(panel.t, panel.signal, expandButton, 'label', () => {
      expandButton.label = panel.t(expanded ? '缩小卡片' : '放大卡片');
      tooltips.get(expandButton)!.content = expandButton.label;
    });
    bindLocale(panel.t, panel.signal, pauseButton, 'label', () => {
      pauseButton.label = panel.t(paused ? '继续轮播' : '暂停轮播');
      tooltips.get(pauseButton)!.content = pauseButton.label;
    });
    tooltips.get(expandButton)!.content = expandButton.label;
    tooltips.get(pauseButton)!.content = pauseButton.label;
    expandButton.setAttribute('aria-pressed', String(expanded));
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.querySelector('span')!.textContent = paused ? '▶️' : '⏸️';
  }
  function status(value: ActivityState): void {
    const refreshing =
      !!value.refreshing || ['queued', 'running'].includes(value.refreshOperation?.status ?? '');
    refreshButton.disabled = refreshing;
    stage.setAttribute('aria-busy', String(refreshing));
  }
  panel.t.watch?.(tick, signal);
  return {
    render,
    select,
    tick,
    appearance,
    status,
    refreshing(value: boolean) {
      refreshButton.disabled = value;
    },
    setVisible(value: boolean) {
      visible = value;
      release();
      if (!value) for (const tooltip of tooltips.values()) tooltip.open = false;
      if (value)
        for (const [index, feed] of items.entries())
          void loadCover(feed, track.children[index]!.querySelector('img')!, generation);
    },
    dispose() {
      release();
      contentOwner.abort();
      owner.abort();
      stage.remove();
    }
  };
}
