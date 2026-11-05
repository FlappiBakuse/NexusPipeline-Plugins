import type { Panel } from '../../../frontend-ui/src/elements.js';
import { createModal } from '../../../frontend-ui/src/modal.js';
import { createImageQueue } from '../../../frontend-ui/src/visible-images.js';
import { boundedImage } from '../../../frontend-ui/src/image-bound.js';
import type { ActivityFeed, ActivityPorts, ActivityState } from './ports.js';
import { gameName } from './activity-labels.js';
import { formatTime, phase } from './time-view.js';
import { bindLocale } from '../../../frontend-ui/src/localize.js';

export function openActivityDetails(
  panel: Panel,
  ports: ActivityPorts,
  feed: ActivityFeed,
  state: ActivityState,
  locale: string,
  now: number,
  onClose: () => void
) {
  const urls = new Set<string>();
  const modal = createModal(panel, '活动详情', false, onClose, () => {
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
  });
  modal.body.className = 'activity-details';
  const queue = createImageQueue(modal.signal);
  modal.signal.addEventListener('abort', () => queue.dispose(), { once: true });
  const text = (parent: Element, tag: string, value: string | (() => string), className = '') => {
    const element = document.createElement(tag);
    bindLocale(panel.t, modal.signal, element, 'textContent', () => {
      element.textContent = typeof value === 'function' ? value() : value;
    });
    element.className = className;
    parent.append(element);
    return element;
  };
  text(modal.body, 'p', () => panel.t('游戏活动'), 'activity-eyebrow');
  text(modal.body, 'h3', () => gameName(feed.game, panel.t));
  text(modal.body, 'span', feed.server, 'activity-server');
  const zone = state.displayZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  text(
    modal.body,
    'p',
    () => panel.t('以下时间按本机时区') + ' ' + zone + ' ' + panel.t('显示；未核验时间保留来源原值。'),
    'activity-help'
  );
  text(modal.body, 'p', () => panel.t('数据来源：SRA'), 'activity-help');
  const section = document.createElement('section');
  section.className = 'activity-events';
  modal.body.append(section);
  const heading = text(section, 'h4', () => panel.t('活动'));
  text(heading, 'span', String(feed.events.length), 'activity-count');
  for (const [label, name] of [
    ['进行中', 'ongoing'],
    ['即将开始', 'upcoming'],
    ['时间待核验', 'unknown'],
    ['已结束', 'ended']
  ] as const) {
    const events = feed.events.filter((item) => phase(item, now) === name);
    if (!events.length) continue;
    const group = document.createElement('details');
    group.className = 'activity-group activity-' + name;
    group.open = name !== 'ended';
    const summary = document.createElement('summary');
    const caption = document.createElement('span');
    bindLocale(panel.t, modal.signal, caption, 'textContent', () => { caption.textContent = panel.t(label) + ' '; });
    summary.append(caption);
    text(summary, 'span', String(events.length));
    group.append(summary);
    section.append(group);
    for (const event of events) {
      const card = document.createElement('article');
      card.className = 'activity-event';
      group.append(card);
      const copy = document.createElement('div');
      copy.className = 'activity-event-copy';
      card.append(copy);
      text(copy, 'h5', event.title);
      if (event.kind) text(copy, 'p', event.kind, 'activity-help');
      text(copy, 'p', () => event.summary || panel.t('暂无活动介绍'), 'activity-help');
      const instant = (value?: string) =>
        value ? { instantUtc: value, rawValue: value, timeBasis: 'explicit', sourceZone: null } : undefined;
      text(
        copy,
        'p',
        () => formatTime(event.start ?? instant(event.startsAt), zone, panel.t.locale?.() ?? locale, panel.t) +
          ' — ' +
          formatTime(event.playEnd ?? instant(event.endsAt), zone, panel.t.locale?.() ?? locale, panel.t),
        'activity-event-time'
      );
      if (event.coverId) {
        const image = document.createElement('img');
        image.className = 'activity-event-cover';
        image.alt = event.title;
        card.prepend(image);
        const load = () => {
          if (!group.open || image.hasAttribute('src')) return;
          queue.observe(card, async () => {
            const candidate = await ports.readCover(event.coverId!, modal.signal);
            if (!modal.alive() || !group.open) return;
            const blob = await boundedImage(candidate);
            if (!modal.alive() || !group.open) return;
            const url = URL.createObjectURL(blob);
            urls.add(url);
            image.src = url;
          });
        };
        group.addEventListener(
          'toggle',
          () => {
            if (group.open) load();
            else queue.unobserve(card);
          },
          { signal: modal.signal }
        );
        queueMicrotask(load);
      }
    }
  }
  return modal;
}
