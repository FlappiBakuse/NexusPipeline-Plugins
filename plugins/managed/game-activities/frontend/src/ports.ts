import type { FrontendTransport } from '@nexuspipeline/extension-sdk';

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
  readFeed?(feedId: string, signal: AbortSignal): Promise<ActivityFeed>;
  readCachedCover?(coverId: string, signal: AbortSignal): Promise<Blob>;
  readSettingsResult?(operationId: string, signal: AbortSignal): Promise<boolean>;
  saveSettings(state: ActivityState, signal: AbortSignal, operationId?: string): Promise<ActivityState>;
  refreshAll(signal: AbortSignal): Promise<ActivityState>;
  readCover(coverId: string, signal: AbortSignal): Promise<Blob>;
  subscribe(listener: (state: ActivityState) => void): () => void;
}

function operationId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function transportPorts(transport: FrontendTransport): ActivityPorts {
  const decode = (input: unknown): ActivityState => {
    const state = input as ActivityState;
    if (!Number.isSafeInteger(state.revision) || !Number.isSafeInteger(state.settingsRevision) ||
      !Array.isArray(state.feeds) || !Array.isArray(state.selectedFeedIds)) throw new Error('activity_state_invalid');
    return { ...state, feeds: state.feeds.map(feed => ({ ...feed, events: feed.events ?? [] })) };
  };
  const readState = async (signal: AbortSignal): Promise<ActivityState> => {
    const value = await transport.invoke('read-state', {}, signal);
    signal.throwIfAborted(); return decode(value);
  };

  return {
    readState,
    async readSettingsResult(operationId, signal) {
      const result = await transport.invoke('read-settings-result', { operationId }, signal) as { operationId: string; committed: boolean };
      if (result.operationId !== operationId || typeof result.committed !== 'boolean') throw Error('activity_result_unbound');
      return result.committed;
    },
    async readFeed(feedId, signal) {
      const result = await transport.invoke('read-feed', { feedId }, signal) as { feed: ActivityFeed };
      if (result.feed.id !== feedId || !Array.isArray(result.feed.events)) throw new Error('activity_feed_identity_invalid');
      return result.feed;
    },
    async readCachedCover(id, signal) {
      const image = await transport.image('read-cached-cover', id, signal);
      try { return image.blob.slice(0, image.blob.size, image.blob.type); }
      finally { image.release(); }
    },
    async saveSettings(state, signal, id = operationId()) {
      if (!Number.isSafeInteger(state.settingsRevision)) throw new Error('activity_settings_revision_required');
      const selected = state.selectedFeedIds.map((id) => {
        const feed = state.feeds.find((item) => item.id === id);
        if (!feed) throw new Error('activity_feed_unknown');
        return feed.game;
      });
      const result = await transport.invoke('save-settings', { expectedRevision: state.settingsRevision, settings: {
        formatVersion: 1, selectedGames: selected, gameOrder: state.gameOrder,
        progressions: state.progressions, rotationSeconds: state.rotationSeconds, pauseOnInteraction: true
      } }, signal, id);
      try { signal.throwIfAborted(); return decode(result); }
      catch (error) { throw Object.assign(error instanceof Error ? error : new Error('activity_save_outcome_unknown'), { uncertain: true }); }
    },
    async refreshAll(signal) {
      await transport.invoke('refresh-all', {}, signal, operationId());
      return readState(signal);
    },
    async readCover(id, signal) {
      const image = await transport.image('read-cover', id, signal);
      try { return image.blob.slice(0, image.blob.size, image.blob.type); }
      finally { image.release(); }
    },
    subscribe(listener) {
      const controller = new AbortController();
      let reading = false, again = false;
      let publishedRevision: number | undefined;
      const refresh = async () => {
        if (controller.signal.aborted) return;
        if (reading) { again = true; return; }
        reading = true;
        try {
          const state = await readState(controller.signal);
          if (!controller.signal.aborted && state.revision !== publishedRevision) {
            publishedRevision = state.revision;
            listener(state);
          }
        }
        catch { /* Failed reads retain the last published snapshot. */ }
        finally {
          reading = false;
          if (again) { again = false; void refresh(); }
        }
      };
      const unsubscribe = transport.subscribe(() => void refresh());
      return () => { controller.abort(); void unsubscribe(); };
    }
  };
}
