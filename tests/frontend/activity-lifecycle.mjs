export async function activityLifecycle({ page, test }) {
  await test('production activities pause hidden reads and reuse revision details', async () => {
    const result = await page.evaluate(async () => {
      const interval = window.setInterval, clear = window.clearInterval;
      const callbacks = new Map();
      window.setInterval = (callback, delay, ...args) => {
        if (delay !== 5000) return interval(callback, delay, ...args);
        const id = interval(() => {}, 3600000); callbacks.set(id, callback); return id;
      };
      window.clearInterval = id => { callbacks.delete(id); clear(id); };
      const settle = () => new Promise(resolve => setTimeout(resolve, 40));
      let reads = 0, details = 0, subscriptions = 0, hold = false, pending, publish;
      const feed = { id: 'one', game: 'Game', server: 'CN', enabled: true, cacheState: 'fresh',
        overview: { title: 'One' }, events: [] };
      let state = { revision: 1, settingsRevision: 1, selectedFeedIds: ['one'], gameOrder: ['Game'],
        rotationSeconds: 30, pauseOnHover: true, pauseOnInteraction: true, feeds: [feed] };
      try {
        await window.testMount('game-activities', {
          invoke: async (operation, input, signal) => {
            if (operation === 'read-state') {
              reads++;
              if (hold) return new Promise(resolve => { pending = { signal, resolve }; });
              return state;
            }
            if (operation === 'read-feed') { details++; return { revision: state.revision, feed }; }
            throw Error('Unexpected operation: ' + operation);
          },
          subscribe: listener => { publish = listener; subscriptions++; return () => { subscriptions--; }; }
        }, 'overview.cards', 'zh-CN', true);
        await settle();
        const initial = reads === 1 && details === 0 && subscriptions === 1 && callbacks.size === 0;
        for (const callback of callbacks.values()) callback();
        await settle();
        const reused = reads === 1 && details === 0;
        publish();
        await settle();
        const refreshed = reads === 2 && details === 0;
        hold = true;
        publish();
        await settle();
        if (!pending) throw Error('Controlled read did not begin');
        window.fixture.hide();
        const canceled = pending.signal.aborted;
        const before = reads;
        pending.resolve({ ...state, revision: 99 });
        await settle();
        const hidden = callbacks.size === 0 && subscriptions === 0 && reads === before && details === 0;
        hold = false; state = { ...state, revision: 2 };
        window.fixture.show(); await settle();
        const resumed = reads === before + 1 && details === 0 && subscriptions === 1 && callbacks.size === 0;
        window.fixture.dispose();
        return { initial, reused, refreshed, canceled, hidden, resumed,
          released: subscriptions === 0 && callbacks.size === 0 };
      } finally {
        window.fixture?.dispose(); window.setInterval = interval; window.clearInterval = clear;
      }
    });
    if (Object.values(result).some(value => !value)) throw Error(JSON.stringify(result));
  });
}
