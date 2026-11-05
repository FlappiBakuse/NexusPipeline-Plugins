import type { ActivityEvent, TimePoint } from './ports.js';
import type { Translate } from '../../../frontend-ui/src/localize.js';

function countdown(milliseconds: number, t: Translate): string {
  const seconds = Math.max(1, Math.floor(milliseconds / 1000));
  if (milliseconds >= 3 * 86400000)
    return `${Math.floor(seconds / 86400)} ${t('天')} ${Math.floor((seconds % 86400) / 3600)} ${t('小时')}`;
  if (milliseconds >= 3600000)
    return `${Math.floor(seconds / 3600)} ${t('小时')} ${Math.floor((seconds % 3600) / 60)} ${t('分钟')}`;
  if (milliseconds >= 60000) return `${Math.floor(seconds / 60)} ${t('分钟')} ${seconds % 60} ${t('秒')}`;
  return `${seconds} ${t('秒')}`;
}

export function remaining(time: TimePoint | null | undefined, now: number, t: Translate): string {
  const end = Date.parse(time?.instantUtc ?? '');
  if (!Number.isFinite(end)) return t('时间待核验');
  return end <= now ? t('已结束') : `${t('距离结束')} ${countdown(end - now, t)}`;
}

export function status(event: ActivityEvent, now: number, t: Translate): string {
  const start = Date.parse(event.start?.instantUtc ?? event.startsAt ?? '');
  const end = Date.parse(event.playEnd?.instantUtc ?? event.endsAt ?? '');
  const current = phase(event, now);
  if (current === 'upcoming') return `${t('距离开始')} ${countdown(start - now, t)}`;
  if (current === 'ongoing') return `${t('距离结束')} ${countdown(end - now, t)}`;
  return t(current === 'ended' ? '已结束' : '时间待核验');
}

export function phase(event: ActivityEvent, now: number) {
  const start = Date.parse(event.start?.instantUtc ?? event.startsAt ?? '');
  const end = Date.parse(event.playEnd?.instantUtc ?? event.endsAt ?? '');
  if (Number.isFinite(start) && Number.isFinite(end) && start >= end) return 'unknown';
  if (Number.isFinite(end) && now >= end) return 'ended';
  if (Number.isFinite(start) && now < start) return 'upcoming';
  if (Number.isFinite(start) && Number.isFinite(end)) return 'ongoing';
  return 'unknown';
}

export function formatTime(time: TimePoint | null | undefined, zone: string, locale: string, t: Translate) {
  if (!time) return t('时间待核验');
  const instant = time.instantUtc ? Date.parse(time.instantUtc) : NaN;
  if (!Number.isFinite(instant)) return t('时间待核验') + (time.rawValue ? ' · ' + time.rawValue : '');
  const formatted = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(instant);
  if (time.timeBasis !== 'source-default') return formatted;
  const source =
    ({ 'Asia/Shanghai': 'UTC+8', 'Asia/Tokyo': 'UTC+9' } as Record<string, string>)[time.sourceZone ?? ''] ??
    time.sourceZone;
  return formatted + ' · ' + t('默认') + ' ' + (source ?? '');
}
