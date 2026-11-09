import path from 'node:path';

export async function browserCases(page, checks, output) {
  async function test(name, action) {
    try { await action(); checks.push({ name, status: 'PASS' }); }
    catch (error) { checks.push({ name, status: 'FAIL', error: String(error), body: (await page.locator('body').innerText()).slice(-3000) }); }
  }
  await page.evaluate(async () => {
    (await import('/ui.js')).registerElements();
    const { ExtensionScope } = await import('/sdk.js');
    const { createFrontend } = await import('/plugin.js');
    const fixture = await (await fetch('/model.json')).json();
    window.saved = []; window.calls = []; window.releases = 0; window.listeners = new Set();
    window.current = fixture.state; window.feedMap = new Map(fixture.feeds.map(item => [item.feed.id, item.feed]));
    const transport = {
      connectionKind: 'remote',
      async invoke(operation, input, signal, operationId) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        window.calls.push({ operation, input, operationId });
        if (operation === 'read-state') return structuredClone(window.current);
        if (operation === 'read-feed') return { revision: window.current.revision, feed: structuredClone(window.feedMap.get(input.feedId)) };
        if (operation === 'save-settings') {
          if (!operationId || input.expectedRevision !== window.current.settingsRevision) throw Error('revision_conflict');
          window.saved.push(input);
          const settings = input.settings;
          window.current = { ...window.current, ...settings, settingsRevision: window.current.settingsRevision + 1, revision: window.current.revision + 1,
            selectedFeedIds: settings.selectedGames.map(game => window.current.feeds.find(feed => feed.game === game && feed.progressionId === (settings.progressions[game] ?? 'default')).id) };
          for (const feed of window.feedMap.values()) feed.enabled = window.current.selectedFeedIds.includes(feed.id);
          return structuredClone(window.current);
        }
        if (operation === 'refresh-all') { if (!operationId) throw Error('missing_operation'); return structuredClone(window.current); }
        throw Error('unexpected_operation_' + operation);
      },
      async image(operation, assetId, signal) {
        if (!['read-cover', 'read-cached-cover'].includes(operation) || !/^[a-f0-9]{64}$/.test(assetId)) throw Error('invalid_cover_reference');
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const blob = new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'), x => x.charCodeAt(0))], { type: 'image/png' });
        return { blob, width: 1, height: 1, release() { window.releases++; } };
      },
      subscribe(listener) { window.listeners.add(listener); return () => window.listeners.delete(listener); }
    };
    window.scope = new ExtensionScope(); const registered = [];
    await createFrontend(transport).activate({ extensionId: 'game-activities', scope: window.scope, locale: 'zh-CN', appearance: 'dark', translate: key => key,
      onLocaleChanged: () => () => {}, registerSurface: item => registered.push(item), registerRoute() {}, registerStyle() {} });
    const contribution = registered.find(item => item.target === 'overview.cards');
    const element = document.querySelector('#app');
    window.cleanup = await contribution.mount({ element, context: { surfaceId: 'overview.cards', instanceId: 'fixture' },
      scope: window.scope, signal: window.scope.signal, visible: true, onVisibilityChanged() { return () => {}; }, setAppearance() {} });
  });
  await test('production transport composes backend metadata and detailed feed', async () => {
    await page.locator('.activity-slide[aria-hidden=false]').waitFor();
    await page.waitForFunction(() => window.releases > 0);
    const expected = await page.evaluate(() => {
      const [id] = window.current.selectedFeedIds;
      return { id, title: window.feedMap.get(id).events[0].title };
    });
    await page.locator('.activity-slide[aria-hidden=false] .activity-hit').click();
    await page.locator('.activity-event').getByText(expected.title, { exact: true }).waitFor({ state: 'attached' });
    if (!await page.evaluate(id => window.calls.some(call => call.operation === 'read-feed' && call.input.feedId === id), expected.id))
      throw Error('Missing detailed feed request for the selected feed');
    if (await page.locator('nexus-modal a').count()) throw Error('Announcement link rendered');
    await page.keyboard.press('Escape'); await page.locator('nexus-modal').waitFor({ state: 'detached' });
  });
  await test('cancel leaves preferences untouched; dormant progression controls subsequent subscription', async () => {
    await page.getByRole('button', { name: '活动设置', exact: true }).click();
    await page.getByRole('spinbutton', { name: '轮播频率（秒）', exact: true }).fill('45');
    await page.keyboard.press('Escape'); await page.locator('nexus-modal').waitFor({ state: 'detached' });
    if (await page.evaluate(() => window.saved.length)) throw Error('Cancelled settings committed');
    await page.getByRole('button', { name: '活动设置', exact: true }).click();
    const row = page.locator('[data-item-id="neverness-to-everness"]');
    if (!await row.locator('nexus-select').evaluate(item => item.value === 'global')) throw Error('Dormant progression lost');
    await row.getByRole('switch').click();
    await page.locator('nexus-modal').getByRole('button', { name: '保存', exact: true }).click();
    await page.locator('nexus-modal').waitFor({ state: 'detached' });
    if (!await page.evaluate(() => window.saved.length === 1 && window.saved[0].expectedRevision === 1 &&
      window.saved[0].settings.progressions['neverness-to-everness'] === 'global' && window.current.selectedFeedIds.includes('neverness-to-everness/global'))) throw Error('CAS or progression save changed');
  });
  await test('narrow viewport keeps production carousel inside viewport', async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.waitForTimeout(100);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) throw Error('Narrow overflow');
    await page.screenshot({ path: path.join(output, 'production-360.png'), fullPage: true });
  });
  await test('scope cleanup removes transport subscription and polling', async () => {
    await page.evaluate(async () => { window.cleanup(); await window.scope.dispose(); window.countAtStop = window.calls.length; });
    await page.waitForTimeout(5100);
    if (!await page.evaluate(() => window.listeners.size === 0 && window.calls.length === window.countAtStop && !document.querySelector('.activity-cover[src]'))) throw Error('Scope retained work or image URLs');
  });
}
