import type { FrontendTransport } from '@nexuspipeline/extension-sdk';
import type { ActivityFeed, ActivityPorts, ActivityState } from './ports.js';

function operationId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function transportPorts(transport: FrontendTransport): ActivityPorts {
  let details: { revision: number; selection: string; feeds: Map<string, ActivityFeed> } | undefined;
  const readState = async (signal: AbortSignal): Promise<ActivityState> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const state = await transport.invoke('read-state', {}, signal) as ActivityState;
      signal.throwIfAborted();
      if (!Number.isSafeInteger(state.revision) || !Number.isSafeInteger(state.settingsRevision) ||
          !Array.isArray(state.feeds) || !Array.isArray(state.selectedFeedIds)) throw new Error('activity_state_invalid');
      const selection = JSON.stringify([state.settingsRevision, state.selectedFeedIds]);
      let byId = details?.revision === state.revision && details.selection === selection ? details.feeds : undefined;
      if (!byId) {
        const detailed = await Promise.all(state.selectedFeedIds.map(async (feedId) => {
          const item = await transport.invoke('read-feed', { feedId }, signal) as { revision: number; feed: ActivityFeed };
          if (item.feed.id !== feedId) throw new Error('activity_feed_identity_invalid');
          return item;
        }));
        signal.throwIfAborted();
        if (detailed.some((item) => item.revision !== state.revision)) continue;
        byId = new Map(detailed.map((item) => [item.feed.id, item.feed]));
        if (!details || state.revision >= details.revision) details = { revision: state.revision, selection, feeds: byId };
      }
      return { ...state, feeds: state.feeds.map((feed) => {
        const result = byId.get(feed.id) ?? feed;
        return { ...result, events: result.events ?? [] };
      }) };
    }
    throw new Error('activity_snapshot_changed');
  };
  return {
    readState,
    async saveSettings(state, signal) {
      if (!Number.isSafeInteger(state.settingsRevision)) throw new Error('activity_settings_revision_required');
      const selected = state.selectedFeedIds.map((id) => {
        const feed = state.feeds.find((item) => item.id === id);
        if (!feed) throw new Error('activity_feed_unknown');
        return feed.game;
      });
      await transport.invoke('save-settings', { expectedRevision: state.settingsRevision, settings: {
        formatVersion: 1, selectedGames: selected, gameOrder: state.gameOrder,
        progressions: state.progressions, rotationSeconds: state.rotationSeconds, pauseOnInteraction: true
      } }, signal, operationId());
      return readState(signal);
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
      const refresh = async () => {
        if (controller.signal.aborted) return;
        if (reading) { again = true; return; }
        reading = true;
        try { const state = await readState(controller.signal); if (!controller.signal.aborted) listener(state); }
        catch { /* Failed reads retain the last published snapshot. */ }
        finally {
          reading = false;
          if (again) { again = false; void refresh(); }
        }
      };
      const unsubscribe = transport.subscribe(() => void refresh());
      const timer = setInterval(() => void refresh(), 5000);
      return () => { controller.abort(); clearInterval(timer); void unsubscribe(); };
    }
  };
}
