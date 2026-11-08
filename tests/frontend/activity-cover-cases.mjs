export async function activityCoverCases({ page, test }) {
  await test('activity first mount includes decoded local cover without detail requests', async () => {
    const result = await page.evaluate(async () => {
      let summaries = 0, details = 0, local = 0, network = 0;
      const feed = { id: 'one', game: 'blue-archive', server: 'CN', enabled: true,
        overview: { title: 'Prepared cover', coverId: 'one-cover' } };
      const state = { revision: 1, settingsRevision: 1, selectedFeedIds: ['one'],
        gameOrder: ['blue-archive'], rotationSeconds: 30, feeds: [feed] };
      await window.testMount('game-activities', {
        invoke: async operation => {
          if (operation === 'read-state') { summaries++; return state; }
          details++; throw Error('Details must remain lazy');
        },
        image: async operation => {
          if (operation === 'read-cached-cover') local++; else network++;
          return { blob: window.fixturePng(), release() {} };
        }, subscribe: () => () => {}
      }, 'overview.cards', 'zh-CN', true);
      const image = document.querySelector('.activity-cover');
      return { summaries, details, local, network, width: image?.naturalWidth, hidden: image?.hidden };
    });
    if (result.summaries !== 1 || result.details !== 0 || result.local !== 1 || result.network !== 0 ||
      result.width !== 1 || result.hidden) throw Error(JSON.stringify(result));
  });
  await test('activity cover recovery and centered toolbar', async () => {
    await page.evaluate(async () => {
      window.coverAttempts = 0;
      const feed = { id: 'one', game: 'blue-archive', server: 'CN', enabled: true,
        overview: { title: 'Recoverable cover', coverId: 'one-cover' }, events: [] };
      const empty = { ...feed, id: 'empty', overview: { title: 'No source cover' } };
      const state = { revision: 1, settingsRevision: 1, selectedFeedIds: ['one', 'empty'],
        gameOrder: ['blue-archive'], rotationSeconds: 30, feeds: [feed, empty] };
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 4;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await window.testMount('game-activities', {
        invoke: async (operation, input) => operation === 'read-feed'
          ? { revision: 1, feed: input.feedId === 'one' ? feed : empty } : state,
        image: async operation => {
          if (operation === 'read-cached-cover') throw Error('activity_cover_not_cached');
          if (++window.coverAttempts === 1) throw Error('controlled first download failure');
          return { blob, release() {} };
        }, subscribe: () => () => {}
      }, 'overview.cards', 'zh-CN', true);
    });
    await page.waitForFunction(() => window.coverAttempts === 1);
    if (await page.locator('.activity-cover').first().isVisible()) throw Error('A failed cover must keep its background');
    await page.getByRole('button', { name: '刷新', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.activity-cover')?.naturalWidth === 4);
    if (await page.locator('.activity-cover').nth(1).isVisible()) throw Error('An absent source cover must not show a broken image');
    const firstAttempts = await page.evaluate(() => window.coverAttempts);
    await page.getByRole('button', { name: '刷新', exact: true }).click();
    if (await page.evaluate(() => window.coverAttempts) !== firstAttempts) throw Error('A loaded cover was downloaded again');
    for (const name of ['放大卡片', '暂停轮播', '刷新', '活动设置']) {
      const button = page.getByRole('button', { name, exact: true }); await button.hover();
      const offset = await button.evaluate(element => {
        const glyph = element.getRootNode().host.querySelector('[slot=icon]').getBoundingClientRect();
        const box = element.getBoundingClientRect();
        return { x: Math.abs(glyph.x + glyph.width / 2 - box.x - box.width / 2),
          y: Math.abs(glyph.y + glyph.height / 2 - box.y - box.height / 2) };
      });
      if (offset.x > 0.5 || offset.y > 0.5) throw Error(name + ': ' + JSON.stringify(offset));
    }
    for (const direction of ['previous', 'next']) {
      const size = await page.locator('.activity-' + direction + ' [slot=icon] svg').boundingBox();
      if (!size || size.height < size.width * 1.5) throw Error('Navigation must use tall narrow SVG chevrons');
    }
    const cached = await page.evaluate(() => {
      const image = document.querySelector('.activity-cover');
      window.fixture.hide(); window.fixture.show();
      return { width: image.naturalWidth, hidden: image.hidden, attempts: window.coverAttempts };
    });
    if (cached.width !== 4 || cached.hidden || cached.attempts !== firstAttempts)
      throw Error('Returning to overview did not display the loaded cover immediately: ' + JSON.stringify(cached));
  });
  await test('activity cover recovers after hide show during download', async () => {
    await page.evaluate(async () => {
      window.coverAttempts = 0;
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 4;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const feed = { id: 'one', game: 'blue-archive', server: 'CN', enabled: true,
        overview: { title: 'Delayed cover', coverId: 'delayed' }, events: [] };
      const state = { revision: 1, settingsRevision: 1, selectedFeedIds: ['one'],
        gameOrder: ['blue-archive'], rotationSeconds: 30, feeds: [feed] };
      await window.testMount('game-activities', {
        invoke: async operation => operation === 'read-feed' ? { revision: 1, feed } : state,
        image: async operation => {
          if (operation === 'read-cached-cover') throw Error('activity_cover_not_cached');
          if (++window.coverAttempts === 1) await new Promise(resolve => { window.releaseCover = resolve; });
          return { blob, release() {} };
        }, subscribe: () => () => {}
      }, 'overview.cards', 'zh-CN', true);
    });
    await page.waitForFunction(() => window.coverAttempts === 1);
    await page.evaluate(() => { window.fixture.hide(); window.fixture.show(); });
    await page.waitForFunction(() => document.querySelector('.activity-cover')?.naturalWidth === 4);
    await page.evaluate(() => window.releaseCover());
    if (await page.locator('.activity-cover').isHidden()) throw Error('The cancelled download replaced the current visible cover');
  });

}
