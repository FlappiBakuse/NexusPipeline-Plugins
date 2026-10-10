export interface TimePoint {
  instantUtc: string | null;
  rawValue: string;
  timeBasis: string;
  sourceZone: string | null;
  precision: string;
  certainty: string;
  sourceRef: string;
}

export interface Activity {
  eventId: string;
  title: string;
  description: string | null;
  descriptionTruncated: boolean;
  channel: string;
  category: string;
  availability: string;
  importance: string;
  isOfficialFeatured: boolean;
  versionRelation: string;
  periodKey: string | null;
  times: { start: TimePoint | null; playEnd: TimePoint | null; claimEnd: TimePoint | null };
  cover: { assetId: string | null; alt: string } | null;
  officialUrl: string | null;
  officialLinkKind: string;
  provenance: { field: string }[];
}

export interface Feed {
  snapshotId: string;
  gameId: string;
  progressionId: string;
  contentLocale: string;
  contentPeriod: { key: string; kind: string; title: string } | null;
  version: { number: string; title: string; end: TimePoint | null } | null;
  overview: {
    title: string;
    number: string | null;
    start: TimePoint | null;
    end: TimePoint | null;
    cover: { assetId: string | null; alt: string } | null;
  };
  activities: Activity[];
  sources: { sourceId: string; kind: string; url: string; retrievedAt: string; note: string }[];
  coverage: {
    events: { status: string; note: string };
    gacha: { status: string; note: string };
  };
  health: {
    cacheState: string;
    contentState: string;
    lastGoodAt: string | null;
    diagnostics: { code: string; message: string }[];
  };
}

export interface Settings {
  formatVersion: number;
  onboardingCompleted: boolean;
  selectedGames: string[];
  progressions: Record<string, string>;
  carouselIntervalSeconds: number;
  pauseOnInteraction: boolean;
}

export interface FeedSummary {
  gameId: string;
  progressionId: string;
  contentLocale: string;
  snapshotId: string | null;
  cacheState: string;
}

export interface ActivityState {
  serverNowUtc: string;
  settingsRevision: number;
  refreshing: boolean;
  settings: Settings;
  selectedFeeds: FeedSummary[];
}

export interface RefreshOperation {
  operationId: string;
  status: string;
}

export interface ActivityHost {
  i18n: {
    t(key: string, args?: Record<string, unknown>, fallback?: string): string;
    locale: string;
  };
  api: {
    get<T>(route: string, signal?: AbortSignal, query?: Record<string, string>): Promise<T>;
    put<T>(route: string, body: unknown, signal?: AbortSignal): Promise<T>;
    post<T>(route: string, body: unknown, signal?: AbortSignal): Promise<T>;
    blob(route: string, options?: { query?: Record<string, string>; signal?: AbortSignal }): Promise<Blob>;
  };
  navigation: { openExternal(url: string): Promise<void> };
}

export const gameIds = [
  "blue-archive", "genshin-impact", "arknights-endfield", "stella-sora",
  "honkai-star-rail", "neverness-to-everness", "wuthering-waves", "zenless-zone-zero",
] as const;

export function feedKey(game: string, progression: string): string {
  return `${game}/${progression}`;
}
