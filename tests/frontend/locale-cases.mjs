import path from 'node:path';

export async function runLocaleCases({ page, test, reportRoot }) {
  await test('English screenshot states', async () => {
    await page.evaluate(async () => {
      await window.testMount('live-screenshot', { readFrame: async () => ({ state: 'waiting_for_game', source: 'pc_game' }) },
        'execution.running.preview', 'en-US');
    });
    await page.getByText('Live preview').waitFor();
    await page.getByText('Waiting for game window…').waitFor();
    await page.getByText('PC game').waitFor();
    await page.evaluate(() => window.fixture.setLocale('zh-CN'));
    await page.getByText('实时画面', { exact: true }).waitFor();
    await page.getByText('正在等待游戏窗口…').waitFor();
    await page.evaluate(() => window.fixture.setLocale('en-US'));
    await page.getByText('Waiting for game window…').waitFor();
    await page.screenshot({ path: path.join(reportRoot, 'locale-screenshot-1280.png'), fullPage: true });
    await page.evaluate(() => {
      if (window.fixture.localeListenerCount !== 1) throw new Error('Mounted translations did not share one locale subscription');
      window.fixture.cleanup();
      if (window.fixture.localeListenerCount !== 0) throw new Error('Released surface retained its locale subscription');
    });
  });
  await test('English wallpaper settings', async () => {
    await page.evaluate(async () => {
      const state = { revision: 1, enabled: true, effectiveEnabled: true, assets: [], order: [],
        selectedId: null, currentId: null, rotation: { mode: 'off', intervalMinutes: 5 },
        effects: { blurPx: 0, dimPercent: 0, surfaceTransparencyPercent: 0, secondaryTransparency: false } };
      await window.testMount('custom-wallpaper', { connectionKind: async () => 'local', readState: async () => state,
        advanceRotation: async () => state, subscribe: () => () => {}, clearAppearance: () => {},
        setAppearance: () => {}, saveSettings: async () => state, readAsset: async () => window.fixturePng() },
      'settings.panels', 'en-US');
    });
    await page.locator('.wallpaper-settings>summary').click();
    await page.getByText('Rotation mode').waitFor();
    await page.getByText('No wallpapers added yet.').waitFor();
    const interval = page.getByRole('spinbutton', { name: 'Rotation interval (minutes)', exact: true });
    await interval.fill('0');
    await interval.blur();
    await page.evaluate(() => window.fixture.setLocale('zh-CN'));
    await page.getByText('轮换方式', { exact: true }).waitFor();
    if (await page.getByRole('spinbutton', { name: '轮换间隔（分钟）', exact: true }).inputValue() !== '0')
      throw new Error('Locale switch discarded invalid wallpaper interval text');
    await page.evaluate(() => window.fixture.setLocale('en-US'));
    if (await interval.inputValue() !== '0') throw new Error('Round-trip locale discarded interval text');
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(reportRoot, 'locale-wallpaper-1280.png'), fullPage: true });
  });
  await test('English activities carousel and settings', async () => {
    await page.evaluate(async () => {
      const state = { revision: 1, selectedFeedIds: ['one'], rotationSeconds: 30,
        pauseOnHover: true, pauseWhenHidden: true, pauseOnInteraction: true, displayZone: 'UTC',
        feeds: [{ id: 'one', game: 'Game', server: 'Global', contentLocale: 'en-US', enabled: true,
          overview: { title: 'Event', end: { instantUtc: '2030-01-01T00:00:00Z' } }, events: [] }] };
      await window.testMount('game-activities', { readState: async () => state, subscribe: () => () => {},
        saveSettings: async () => state, refreshAll: async () => state, readCover: async () => window.fixturePng() },
      'overview.cards', 'en-US');
    });
    await page.locator('nexus-card[aria-label="Game activities"]').waitFor();
    await page.getByRole('button', { name: 'Expand card', exact: true }).waitFor();
    await page.getByText('Period ends', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Activity settings', exact: true }).click();
    await page.getByRole('heading', { name: 'Activity settings', exact: true }).waitFor();
    await page.getByRole('spinbutton', { name: 'Carousel frequency (seconds)', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(reportRoot, 'locale-activities-1280.png'), fullPage: true });
  });
  await test('English check-in editor', async () => {
    await page.evaluate(async () => {
      const state = { revision: 1, timeZoneId: 'Asia/Shanghai', tasks: [],
        platforms: [{ id: 'test', name: 'Test platform', games: [{ id: 'game', name: 'Game' }] }],
        notificationTasks: [] };
      await window.testMount('game-checkin', { readState: async () => state,
        openEditor: async () => ({ editorSessionId: 'en-editor', fields: { test: { configured: false, fieldGeneration: 1 } } }),
        leaseEditor: async () => {}, closeEditor: async () => {} }, 'route', 'en-US');
    });
    await page.getByRole('heading',{name:'Check-in',level:1,exact:true}).waitFor();
    await page.getByText('Add check-in task').click();
    await page.getByText('Automatic game check-in').waitFor();
    await page.getByText('+ Add schedule').click();
    if (!await page.locator('.checkin-schedule-card').evaluate(element => element.open)) throw Error('New schedule must start expanded');
    await page.getByText('Run time',{exact:true}).waitFor();
    await page.getByText('Enable notifications').waitFor();
    const name = page.getByRole('textbox', { name: 'Task name', exact: true });
    await name.fill('Locale draft');
    const original = await name.elementHandle();
    await page.evaluate(() => window.fixture.setLocale('zh-CN'));
    await page.getByText('游戏自动签到', { exact: true }).waitFor();
    const translatedName = page.getByRole('textbox', { name: '任务名称', exact: true });
    if (await translatedName.inputValue() !== 'Locale draft') throw new Error('Locale switch lost ordinary task draft');
    if (!(await translatedName.evaluate((node, expected) => node === expected, original)))
      throw new Error('Locale switch replaced the task input');
    await page.evaluate(() => window.fixture.setLocale('en-US'));
    await page.getByText('Automatic game check-in', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(reportRoot, 'locale-checkin-1280.png'), fullPage: true });
  });
  await test('English Maa schema editor', async () => {
    await page.evaluate(async () => {
      const profile = { profileId: 'en-profile', revision: '', packageRoot: 'D:/project',
        interfacePath: 'interface.json', nativeDirectory: '', language: 'en_us',
        controller: 'win', resource: 'main', taskOccurrences: [], options: {},
        resourceOptions: {}, controllerOptions: {}, windowSelection: 'exact_process',
        windowExecutable: '', windowHandle: 0, windowProcessId: 0, windowWaitMilliseconds: 10000,
        adbPath: '', adbSerial: '' };
      const schema = { projectName: 'Project', projectVersion: '1',
        controllers: [{ name: 'win', label: 'Win32', type: 'Win32' }],
        resources: [{ name: 'main', label: 'Main' }], tasks: [], options: {}, presets: [] };
      await window.testMount('maa-framework', { readEditor: async () => ({ providerId: 'maa-framework', mode: 'script', profile }),
        discover: async () => ({ interfaceCandidates: ['interface.json'], candidates: [], schema }),
        inspect: async () => ({ schema }), preview: async () => ({}), publishDraft: () => {} },
      'automation.script.editor', 'en-US');
    });
    await page.getByText('Advanced settings').click();
    await page.getByRole('textbox',{name:'Interface relative path',exact:true}).waitFor();
    await page.getByText('Add task occurrence',{exact:true}).waitFor();
    await page.getByText('Runtime window selection',{exact:true}).waitFor();
    await page.screenshot({ path: path.join(reportRoot, 'locale-maa-1280.png'), fullPage: true });
  });
}
