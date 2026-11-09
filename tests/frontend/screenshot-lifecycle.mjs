export async function screenshotLifecycle({ page, test }) {
  await test('production screenshot samples without overlap and isolates concurrent and late attempts', async () => {
    const result = await page.evaluate(async () => {
      const interval = window.setInterval, clear = window.clearInterval;
      const callbacks = new Map(), fixtures = [], held = [];
      let reads = 0, releases = 0, slow = false;
      window.setInterval = (callback, delay, ...args) => {
        if (delay !== 5000) return interval(callback, delay, ...args);
        const id = interval(() => {}, 3600000); callbacks.set(id, callback); return id;
      };
      window.clearInterval = id => { callbacks.delete(id); clear(id); };
      const settle = () => new Promise(resolve => setTimeout(resolve, 70));
      const frames = new Map();
      const transport = {
        preview: async (context, provider, signal) => {
          if (provider !== 'current-task') throw Error('Wrong provider');
          reads++;
          const key = context.runId + '/' + context.attemptId;
          if (slow) return new Promise(resolve => held.push({ key, signal, resolve }));
          return frames.get(key)();
        }
      };
      const ready = stamp => ({ state: 'ready', capturedAt: stamp,
        image: { blob: window.fixturePng(), width: 1, height: 1, source: 'pc_game', release() { releases++; } } });
      try {
        frames.set('one/a', () => ({ state: 'waiting_for_game' }));
        frames.set('two/b', () => ready('2026-10-30T02:22:00Z'));
        for (const [runId, attemptId] of [['one', 'a'], ['two', 'b']]) {
          await window.testMount('live-screenshot', transport, 'execution.running.preview', 'en-US', true, { runId, attemptId });
          fixtures.push(window.fixture);
        }
        await settle();
        const distinct = fixtures[0].element.querySelector('img').hidden &&
          !fixtures[1].element.querySelector('img').hidden && callbacks.size === 2 && reads === 2;
        frames.set('one/a', () => ready('2026-10-30T01:11:00Z'));
        for (const callback of callbacks.values()) callback();
        await settle();
        const visibleFrames = fixtures.every(item => {
          const image = item.element.querySelector('img');
          return !image.hidden && image.naturalWidth === 1 && image.naturalHeight === 1;
        });
        slow = true;
        for (const callback of callbacks.values()) callback();
        for (const callback of callbacks.values()) callback();
        await settle();
        const noOverlap = held.length === 2 && reads === 6;
        fixtures[0].hide(); fixtures[1].dispose();
        const stopped = held.every(item => item.signal.aborted) && callbacks.size === 0;
        const before = releases;
        for (const pending of held) pending.resolve(ready('2026-10-30T23:59:00Z'));
        await settle();
        const late = releases === before + 2 && !fixtures[0].element.querySelector('img').hasAttribute('src');
        fixtures[0].dispose(); slow = false;
        frames.set('one/c', () => ready('2026-10-30T03:33:00Z'));
        await window.testMount('live-screenshot', transport, 'execution.running.preview', 'en-US', true,
          { runId: 'one', attemptId: 'c' });
        fixtures.push(window.fixture); await settle();
        const current = window.fixture.element.querySelector('img');
        const restored = !current.hidden && current.naturalWidth === 1 && callbacks.size === 1;
        window.fixture.dispose();
        return { distinct, visibleFrames, noOverlap, stopped, late, restored, released: callbacks.size === 0 && releases === 6 };
      } finally {
        for (const fixture of fixtures) fixture.dispose();
        window.setInterval = interval; window.clearInterval = clear;
      }
    });
    if (Object.values(result).some(value => !value)) throw Error(JSON.stringify(result));
  });
}
