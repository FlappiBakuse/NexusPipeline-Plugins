export interface TimePoint {
  instantUtc: string | null;
  rawValue: string;
  timeBasis: string;
  sourceZone: string | null;
}
export interface Activity {
  eventId: string;
  title: string;
  summary: string | null;
  kind: string | null;
  times: { start: TimePoint | null; playEnd: TimePoint | null };
  cover: { assetId: string | null; alt: string } | null;
}
export interface FeedHealth {
  cacheState: string; contentState: string; lastGoodAt: string | null; lastCheckedAt: string | null; nextCheckAt: string | null;
  diagnostics: { code: string; message: string }[];
}
export interface Feed {
  formatVersion: 3;
  snapshotId: string;
  gameId: string;
  progressionId: string;
  contentLocale: string;
  overview: {
    overviewId: string | null;
    title: string;
    number: string | null;
    start: TimePoint | null;
    end: TimePoint | null;
    cover: { assetId: string | null; alt: string } | null;
  };
  activities: Activity[];
  source: { provider: "sra"; url: string };
  health: FeedHealth;
}

export interface Settings {
  formatVersion: number;
  onboardingCompleted: boolean;
  selectedGames: string[];
  gameOrder?: string[];
  progressions: Record<string, string>;
  carouselIntervalSeconds: number;
  pauseOnInteraction: boolean;
}

export interface FeedSummary {
  gameId: string;
  progressionId: string;
  contentLocale: string;
  snapshotId: string | null;
  health: FeedHealth;
}

export interface ActivityState {
  formatVersion: 3;
  serverNowUtc: string;
  settingsRevision: number;
  refreshing: boolean;
  settings: Settings;
  selectedFeeds: FeedSummary[];
}

export interface RefreshOperation {
  operationId: string;
  status: string;
  checkedFeedCount: number; changedFeedCount: number; failedFeedCount: number; imageFailureCount: number;
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
