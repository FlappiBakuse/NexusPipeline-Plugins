export async function activityLifecycle({ page, test }) {
  await test('activity carousel discards replaced locale bindings', async () => {
    const result = await page.evaluate(async () => {
      const feed = { id: 'one', game: 'genshin-impact', server: 'CN', enabled: true, cacheState: 'fresh',
        overview: { title: '' }, events: [] };
      const second = { ...feed, id: 'two', game: 'honkai-star-rail' };
      let state = { revision: 1, settingsRevision: 1, selectedFeedIds: ['one', 'two'],
        gameOrder: ['genshin-impact', 'honkai-star-rail'], rotationSeconds: 30, pauseOnHover: true,
        pauseOnInteraction: true, feeds: [feed, second] };
      let publish, reads = 0;
      const settle = async predicate => {
        for (let attempt = 0; attempt < 80 && !predicate(); attempt++) await new Promise(resolve => setTimeout(resolve, 10));
        if (!predicate()) throw Error('Carousel did not render the controlled revision');
      };
      try {
        await window.testMount('game-activities', {
          invoke: async operation => {
            if (operation !== 'read-state') throw Error('Unexpected carousel operation ' + operation);
            reads++;
            return state;
          },
          subscribe: listener => { publish = listener; return () => {}; }
        }, 'overview.cards', 'zh-CN', true);
        const find = selector => document.querySelector('#app ' + selector);
        await settle(() => find('.activity-hit') && publish);
        const title = find('.activity-slide h3'), target = find('.activity-hit'), indicator = find('.activity-indicator');
        const initial = window.fixture.localeListenerCount;
        const labels = [title.textContent, target.getAttribute('aria-label'), indicator.getAttribute('aria-label')];
        const publishState = async next => {
          const oldReads = reads;
          state = { ...next, revision: state.revision + 1 };
          publish();
          await settle(() => reads > oldReads);
          await new Promise(resolve => setTimeout(resolve, 20));
        };
        await publishState({ ...state, selectedFeedIds: [] });
        await settle(() => find('.activity-empty'));
        const empty = find('.activity-empty'), emptyLabel = empty.textContent;
        await publishState({ ...state, selectedFeedIds: ['one', 'two'] });
        await settle(() => find('.activity-hit'));
        for (let version = 0; version < 4; version++) await publishState(state);
        const listeners = window.fixture.localeListenerCount;
        window.fixture.setLocale('en-US');
        const detached = [title.textContent, target.getAttribute('aria-label'), indicator.getAttribute('aria-label')];
        return { initial, listeners, detached: !title.isConnected && !target.isConnected && !indicator.isConnected && !empty.isConnected,
          oldLabelsRetained: JSON.stringify(detached) === JSON.stringify(labels) && empty.textContent === emptyLabel,
          currentTranslated: find('.activity-hit').getAttribute('aria-label') !== labels[1] && find('.activity-slide h3').textContent !== labels[0] };
      } finally { window.fixture?.dispose(); }
    });
    if (result.listeners !== result.initial || !result.detached || !result.oldLabelsRetained || !result.currentTranslated)
      throw Error(JSON.stringify(result));
  });
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
      let reads = 0, details = 0, subscriptions = 0, hold = false, pending, publish, unhandled = 0;
      const rejected = () => { unhandled++; };
      window.addEventListener('unhandledrejection', rejected);
      const feed = { id: 'one', game: 'Game', server: 'CN', enabled: true, cacheState: 'fresh',
        overview: { title: 'One' }, events: [] };
      const second = { ...feed, id: 'second', game: 'Second game', overview: { title: 'Other activity' } };
      let state = { revision: 1, settingsRevision: 1, selectedFeedIds: ['one', 'second'], gameOrder: ['Game', 'Second game'],
        rotationSeconds: 30, pauseOnHover: true, pauseOnInteraction: true, feeds: [feed, second] };
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
        state = { ...state, revision: 2, feeds: [{ ...feed, overview: null }, second] };
        publish(); await settle();
        const stale = document.querySelector('#app nexus-toast[role="alert"]')?.message === '刷新失败，保留原数据' &&
          document.querySelector('#app .activity-slide')?.textContent.includes('One');
        state = { ...state, feeds: [{ ...feed, overview: { title: 'Two' } }, second] };
        publish(); await settle();
        const recovered = unhandled === 0 && !document.querySelector('#app [role="alert"]') &&
          document.querySelector('#app .activity-slide')?.textContent.includes('Two');
        state = { ...state, revision: 3, gameOrder: {}, feeds: [{ ...feed, overview: { title: 'Three' } }, second] };
        publish(); await settle();
        const staleOrder = document.querySelector('#app nexus-toast[role="alert"]')?.message === '刷新失败，保留原数据' &&
          document.querySelector('#app .activity-slide')?.textContent.includes('Two');
        state = { ...state, gameOrder: ['Game', 'Second game'] };
        publish(); await settle();
        const recoveredOrder = unhandled === 0 && !document.querySelector('#app [role="alert"]') &&
          document.querySelector('#app .activity-slide')?.textContent.includes('Three');
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
        hold = false; state = { ...state, revision: 4 };
        window.fixture.show(); await settle();
        const resumed = reads === before + 1 && details === 0 && subscriptions === 1 && callbacks.size === 0;
        window.fixture.dispose();
        return { initial, reused, refreshed, stale, recovered, staleOrder, recoveredOrder, canceled, hidden, resumed,
          released: subscriptions === 0 && callbacks.size === 0 };
      } finally {
        window.fixture?.dispose(); window.setInterval = interval; window.clearInterval = clear;
        window.removeEventListener('unhandledrejection', rejected);
      }
    });
    if (Object.values(result).some(value => !value)) throw Error(JSON.stringify(result));
  });
}
