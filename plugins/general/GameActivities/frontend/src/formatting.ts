import { instant } from "./activityPolicy";
import type { ActivityHost, Feed, TimePoint } from "./types";

export function translator(host: ActivityHost) {
  return (key: string, args: Record<string, unknown> = {}) => host.i18n.t(key, args, key);
}

export function formatTime(time: TimePoint | null | undefined, host: ActivityHost): string {
  const value = instant(time);
  if (value === null) {
    const label = host.i18n.t("time.unverified");
    return time?.rawValue ? `${label} · ${time.rawValue}` : label;
  }
  const formatted = new Intl.DateTimeFormat(host.i18n.locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
  if (time?.timeBasis !== "source-default") return formatted;
  const zone = time.sourceZone === "Asia/Shanghai" ? "UTC+8" : time.sourceZone === "Asia/Tokyo" ? "UTC+9" : time.sourceZone;
  return `${formatted} · ${host.i18n.t("time.sourceDefault", { zone })}`;
}

export function formatStart(time: TimePoint | null | undefined, host: ActivityHost): string {
  return instant(time) === null ? host.i18n.t("time.started") : formatTime(time, host);
}

export function versionLabel(feed: Feed | undefined | null, host: ActivityHost): string {
  const t = translator(host);
  if (feed?.version?.number) return `${t("version.label")} ${feed.version.number}`;
  return t(feed?.contentPeriod?.kind === "campaign" ? "version.topic" : "version.unverified");
}

interface DescriptionBlock {
  kind: "paragraph" | "bullet" | "field";
  text: string;
  label?: string;
}

export function descriptionBlocks(text: string, title: string): DescriptionBlock[] {
  // Cached notices can lack HTML line breaks; split only explicit list and field markers.
  const lines = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]*[●•◆][ \t]*/g, "\n• ")
    .replace(/(?=(?:活动时间|活动说明|开放时间|参与条件|参与要求|解锁条件|奖励内容|招募时间|活动期间|Event Period|Event Details)[：:])/g, "\n")
    .replace(/(?=[一二三四五六七八九十]+、[ \t]*[^\n]{2,40}(?:开启时间|开放时间|版本更新|其他内容))/g, "\n")
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => line && line !== title);

  return lines.map(line => {
    if (/^[•●◆]|^[-*]\s/.test(line)) {
      return { kind: "bullet", text: line.replace(/^[•●◆*-]\s*/, "") };
    }
    const field = /^(活动时间|活动说明|开放时间|参与条件|参与要求|解锁条件|奖励内容|招募时间|活动期间|Event Period|Event Details)[：:]\s*(.*)$/.exec(line);
    if (field) return { kind: "field", label: field[1], text: field[2] };
    return { kind: "paragraph", text: line };
  });
}
