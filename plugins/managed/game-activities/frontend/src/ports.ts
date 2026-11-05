export interface TimePoint {
  readonly instantUtc: string | null;
  readonly rawValue: string;
  readonly timeBasis: string;
  readonly sourceZone: string | null;
}

export interface ActivityEvent {
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly coverId?: string;
  readonly link?: string;
  readonly kind?: string;
  readonly start?: TimePoint | null;
  readonly playEnd?: TimePoint | null;
}

export interface ActivityFeed {
  readonly id: string;
  readonly game: string;
  readonly server: string;
  readonly progressionId: string;
  readonly contentLocale: string;
  readonly enabled: boolean;
  readonly overview: {
    readonly title: string;
    readonly number?: string;
    readonly coverId?: string;
    readonly start?: TimePoint | null;
    readonly end?: TimePoint | null;
  };
  readonly refreshedAt?: string;
  readonly events: readonly ActivityEvent[];
  readonly cacheState?: 'fresh' | 'stale' | 'missing' | 'failed';
  readonly lastGoodAt?: string;
  readonly diagnostics?: readonly string[];
  readonly lastCheckedAt?: string;
  readonly nextCheckAt?: string;
}

export interface ActivityState {
  readonly revision: number;
  readonly settingsRevision?: number;
  readonly feeds: readonly ActivityFeed[];
  readonly selectedFeedIds: readonly string[];
  readonly rotationSeconds: number;
  readonly pauseOnHover: boolean;
  readonly pauseWhenHidden: boolean;
  readonly gameOrder?: readonly string[];
  readonly pauseOnInteraction?: boolean;
  readonly refreshStatus?: 'idle' | 'partial' | 'failed';
  readonly refreshing?: boolean;
  readonly refreshOperation?: {
    readonly status: 'queued' | 'running' | 'partial' | 'failed' | 'succeeded';
    readonly checkedFeedCount: number;
    readonly changedFeedCount: number;
    readonly failedFeedCount: number;
    readonly imageFailureCount: number;
  };
  readonly serverNowUtc?: string;
  readonly displayZone?: string;
  readonly progressionOptions?: Readonly<Record<string, readonly { value: string; label: string }[]>>;
  readonly progressions?: Readonly<Record<string, string>>;
}

export interface ActivityPorts {
  readState(signal: AbortSignal): Promise<ActivityState>;
  saveSettings(state: ActivityState, signal: AbortSignal): Promise<ActivityState>;
  refreshAll(signal: AbortSignal): Promise<ActivityState>;
  readCover(coverId: string, signal: AbortSignal): Promise<Blob>;
  subscribe(listener: (state: ActivityState) => void): () => void;
}
