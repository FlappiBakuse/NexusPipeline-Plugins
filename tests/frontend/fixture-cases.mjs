import { choose, confirm } from './controls.mjs';
export async function runAdditionalCases({ page, test, reportRoot }) {
  await test('wallpaper appearance mount hide resume and dispose', async () => {
    const result = await page.evaluate(async () => {
      const state = { revision: 1, enabled: true, effectiveEnabled: true,
        assets: [{ id: 'a', name: 'A', sizeBytes: 1, palette: {
          '--accent': 'hsl(0 100% 50%)', '--accent-strong': 'hsl(120 100% 50%)',
          '--wallpaper-card-dark': 'hsl(240 100% 50%)', '--wallpaper-card-light': '#ffffff',
        } }], order: ['a'], currentId: 'a',
        rotation: { mode: 'off', intervalMinutes: 1 },
        effects: { blurPx: 4, dimPercent: 25, surfaceTransparencyPercent: 20, secondaryTransparency: true } };
      let reads = 0;
      let created = 0;
      let revoked = 0;
      const create = URL.createObjectURL;
      const revoke = URL.revokeObjectURL;
      URL.createObjectURL = (...args) => { created++; return create(...args); };
      URL.revokeObjectURL = (...args) => { revoked++; return revoke(...args); };
      try {
        await window.testMount('custom-wallpaper', {
          connectionKind: async () => 'remote', readState: async () => state,
          readAsset: async () => { reads++; return window.fixturePng(); },
          advanceRotation: async () => state, subscribe: () => () => {},
        }, 'application.appearance');
        await new Promise(resolve => setTimeout(resolve, 60));
        const shown = !!window.fixture.element.querySelector('.wallpaper-appearance-image')?.style.backgroundImage;
        const theme = structuredClone(window.fixtureAppearance);
        const initialReads = reads;
        window.fixture.hide();
        const hidden = !window.fixture.element.querySelector('.wallpaper-appearance-image')?.style.backgroundImage;
        const retained = Object.entries(theme).every(([key, value]) => window.fixtureAppearance?.[key] === value);
        const hiddenReads = reads;
        await new Promise(resolve => setTimeout(resolve, 50));
        window.fixture.show();
        await new Promise(resolve => setTimeout(resolve, 60));
        const resumed = !!window.fixture.element.querySelector('.wallpaper-appearance-image')?.style.backgroundImage;
        window.fixture.cleanup();
        const restored = window.fixtureAppearance === null;
        window.fixture.dispose();
        return { shown, hidden, resumed, theme, retained, restored,
          reads, initialReads, hiddenReads, created, revoked,
          detached: !document.querySelector('.wallpaper-appearance') };
      } finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
    });
    if (!result.shown || !result.hidden || !result.resumed || !result.retained || !result.restored ||
      result.theme?.accent !== '#ff0000' || result.theme?.accentStrong !== '#00ff00' ||
      result.theme?.cardDark !== '#0000ff' || result.theme?.cardOpacity !== 0.8 ||
      !result.theme?.secondaryTransparent || result.initialReads < 1 ||
      result.hiddenReads !== result.initialReads || result.reads !== result.initialReads ||
      result.created !== result.revoked || !result.detached)
      throw new Error(`Wallpaper appearance lifecycle mismatch: ${JSON.stringify(result)}`);
  });

  await test('wallpaper prepares local image before appearance mount', async () => {
    const result = await page.evaluate(async () => {
      const state = { revision: 1, enabled: true, effectiveEnabled: true,
        assets: [{ id: 'a', name: 'A', sizeBytes: 1 }], order: ['a'], currentId: 'a',
        rotation: { mode: 'off', intervalMinutes: 1 },
        effects: { blurPx: 0, dimPercent: 0, surfaceTransparencyPercent: 0, secondaryTransparency: false } };
      let release;
      let created = 0;
      const create = URL.createObjectURL;
      URL.createObjectURL = (...args) => { created++; return create(...args); };
      try {
        const mounting = window.testMount('custom-wallpaper', {
          connectionKind: async () => 'remote', readState: async () => state,
          readAsset: () => new Promise(resolve => { release = resolve; }),
          advanceRotation: async () => state, subscribe: () => () => {},
        }, 'application.appearance');
        for (let index = 0; index < 30 && !release; index++)
          await new Promise(resolve => setTimeout(resolve, 10));
        if (!release) throw Error('Asset read did not begin');
        const withheld = !document.querySelector('.wallpaper-appearance-image');
        release(window.fixturePng());
        await mounting;
        const ready = !!document.querySelector('.wallpaper-appearance-image')?.style.backgroundImage;
        window.fixture.dispose();
        return { created, withheld, ready };
      } finally { URL.createObjectURL = create; }
    });
    if (!result.withheld || !result.ready || !result.created) throw new Error(`Wallpaper preparation mismatch: ${JSON.stringify(result)}`);
  });
  await test('screenshot rejects oversized dimensions before preview', async () => {
    await page.evaluate(async () => {
      const bytes = new Uint8Array(24);
      bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
      new DataView(bytes.buffer).setUint32(16, 100000);
      new DataView(bytes.buffer).setUint32(20, 100000);
      await window.testMount('live-screenshot', { readFrame: async () => ({ state: 'ready',
        blob: new Blob([bytes], { type: 'image/png' }) }) }, 'execution.running.preview');
    });
    await page.getByText('暂时无法获取游戏窗口画面').waitFor();
    if (await page.locator('.screenshot-image[src]').count()) throw new Error('Oversized frame reached DOM');
  });
  await test('wallpaper remote startup and due refresh', async () => {
    const result = await page.evaluate(async () => {
      let reads = 0;
      let advances = 0;
      const state = { revision: 1, enabled: true, effectiveEnabled: true,
        assets: [{ id: 'a', name: 'A', sizeBytes: 1 }], order: ['a'], currentId: 'a',
        rotation: { mode: 'timer', intervalMinutes: 1,
          nextSwitchAt: new Date(Date.now() - 1000).toISOString() },
        effects: { blurPx: 0, dimPercent: 0, surfaceTransparencyPercent: 0, secondaryTransparency: true } };
      await window.testMount('custom-wallpaper', {
        connectionKind: async () => 'remote', readState: async () => { reads++; return state; },
        advanceRotation: async () => { advances++; return state; },
        subscribe: () => () => {}, readAsset: async () => window.fixturePng(),
        setAppearance: () => {}, clearAppearance: () => {},
      }, 'settings.panels');
      await new Promise(resolve => setTimeout(resolve, 1200));
      return { reads, advances };
    });
    if (result.advances !== 0 || result.reads < 2)
      throw new Error(`Remote startup/due refresh mismatch: ${JSON.stringify(result)}`);
  });

  await test('wallpaper overdue retry bound and subscription recovery', async () => {
    const result = await page.evaluate(async () => {
      const nativeTimeout = window.setTimeout;
      window.setTimeout = (callback, delay, ...args) =>
        nativeTimeout(callback, delay === 1000 ? 1 : delay, ...args);
      let reads = 0;
      let push;
      const state = { revision: 1, enabled: true, effectiveEnabled: true,
        assets: [{ id: 'a', name: 'A', sizeBytes: 1 }], order: ['a'], currentId: 'a',
        rotation: { mode: 'timer', intervalMinutes: 1,
          nextSwitchAt: new Date(Date.now() - 1000).toISOString() },
        effects: { blurPx: 0, dimPercent: 0, surfaceTransparencyPercent: 0, secondaryTransparency: true } };
      await window.testMount('custom-wallpaper', {
        connectionKind: async () => 'remote',
        readState: async () => { if (reads++ === 0) return state; throw Error('offline'); },
        advanceRotation: async () => state, subscribe: listener => { push = listener; return () => {}; },
        readAsset: async () => window.fixturePng(), setAppearance: () => {}, clearAppearance: () => {},
      }, 'settings.panels');
      const initialReads = reads;
      await new Promise(resolve => nativeTimeout(resolve, 120));
      const bounded = reads - initialReads;
      await new Promise(resolve => nativeTimeout(resolve, 120));
      const stopped = reads === initialReads + bounded;
      push({ ...state, revision: 2, rotation: { ...state.rotation, mode: 'off' } });
      await new Promise(resolve => nativeTimeout(resolve, 10));
      window.setTimeout = nativeTimeout;
      return { bounded, stopped, recovered: !window.fixture.element.textContent.includes('壁纸读取失败') };
    });
    if (result.bounded < 1 || result.bounded > 8 || !result.stopped || !result.recovered)
      throw new Error(`Overdue retry/recovery mismatch: ${JSON.stringify(result)}`);
  });

  await test('activities stale cache and late cover', async () => {
    const result = await page.evaluate(async () => {
      let release;
      let created = 0;
      const original = URL.createObjectURL;
      URL.createObjectURL = (...args) => { created++; return original(...args); };
      const state = { revision: 1, selectedFeedIds: ['one'], rotationSeconds: 30,
        pauseOnHover: true, pauseWhenHidden: true, pauseOnInteraction: true,
        refreshOperation: { status: 'partial', checkedFeedCount: 2, changedFeedCount: 1,
          failedFeedCount: 1, imageFailureCount: 0 },
        feeds: [{ id: 'one', game: 'Game', server: 'CN', progressionId: 'cn',
          contentLocale: 'zh-CN', enabled: true, cacheState: 'stale', lastGoodAt: '2026-10-20',
          overview: { title: 'Cached Event', coverId: 'cover' }, events: [] }] };
      await window.testMount('game-activities', { readState: async () => state,
        saveSettings: async next => next, refreshAll: async () => state,
        readCover: () => new Promise(resolve => { release = resolve; }), subscribe: () => () => {},
      }, 'overview.cards');
      await new Promise(resolve => setTimeout(resolve, 30));
      const cacheVisible = window.fixture.element.querySelector('.activity-slide[aria-hidden=false] h3')?.textContent === 'Cached Event'
        && window.fixture.element.querySelector('[role=alert]')?.textContent === '部分失败，保留原数据';
      window.fixture.hide();
      release(new Blob(['late']));
      await new Promise(resolve => setTimeout(resolve, 20));
      URL.createObjectURL = original;
      return { cacheVisible, created };
    });
    if (!result.cacheVisible || result.created) throw new Error(`Cache/late cover mismatch: ${JSON.stringify(result)}`);
  });

  await test('checkin reorder run delete and editor lease', async () => {
    await page.evaluate(async () => {
      const task = id => ({ id, name: id, remark: '', enabled: true, games: {}, schedules: [],
        notification: { enabled: false, notificationTaskIds: [] }, isRunning: false,
        nextRunAt: null, recentRun: null });
      let state = { revision: 1, timeZoneId: 'Asia/Shanghai', tasks: [task('First'), task('Second')],
        platforms: [], notificationTasks: [] };
      window.checkinOperations = [];
      window.originalInterval = window.setInterval;
      window.setInterval = (callback, delay, ...args) => {
        if (delay === 60_000) window.triggerLease = callback;
        return window.originalInterval(callback, delay, ...args);
      };
      const update = () => ({ ...state, revision: ++state.revision });
      await window.testMount('game-checkin', {
        readState: async () => state,
        reorderTasks: async ids => { window.checkinOperations.push(['reorder', ...ids]);
          state = { ...update(), tasks: ids.map(id => state.tasks.find(item => item.id === id)) }; return state; },
        runTask: async id => { window.checkinOperations.push(['run', id]); return update(); },
        deleteTask: async id => { window.checkinOperations.push(['delete', id]);
          state = { ...update(), tasks: state.tasks.filter(item => item.id !== id) }; return state; },
        openEditor: async () => ({ editorSessionId: 'lease', fields: {} }),
        readEditor: async () => ({ editorSessionId: 'lease', fields: {} }),
        leaseEditor: async id => { window.checkinOperations.push(['lease', id]); },
        closeEditor: async id => { window.checkinOperations.push(['close', id]); },
        saveTask: async () => state, revealCredential: async () => ({ value: '', remainingSeconds: 1 }),
        confirmReveal: async () => {}, beginBrowserLogin: async () => ({ candidateId: '' }),
        cancelBrowserLogin: async () => {}, prepareTajiduo: async () => ({ operationId: '' }),
        sendTajiduoCode: async () => {}, loginTajiduo: async () => ({ candidateId: '', platformId: '' }),
        cancelTajiduo: async () => {},
      }, 'route');
    });
    await page.getByText('First', { exact: false }).first().waitFor();
    await page.locator('nexus-sortable-list nexus-drag-handle').last().press('ArrowUp');
    await page.getByText('立即签到').first().click();
    await page.getByText('删除签到').first().click();
    await confirm(page);
    await page.getByText('添加签到任务').click();
    await page.locator('.checkin-editor').waitFor();
    await page.evaluate(() => {
      window.setInterval = window.originalInterval;
      window.triggerLease();
    });
    await page.locator('.checkin-editor').getByText('取消').click();
    const operations = await page.evaluate(() => window.checkinOperations);
    if (!['reorder', 'run', 'delete', 'lease', 'close'].every(name => operations.some(item => item[0] === name)))
      throw new Error(`Missing checkin operation: ${JSON.stringify(operations)}`);
  });

  await test('maa interface choice and root invalidation', async () => {
    await page.evaluate(async () => {
      const profile = { profileId: 'saved', revision: '', packageRoot: 'D:/old',
        interfacePath: 'interface.json', nativeDirectory: 'native', nativeVersion: '1',
        language: 'zh_cn', controller: 'adb', resource: 'main', taskOccurrences: [], options: {},
        resourceOptions: {}, controllerOptions: {}, windowSelection: 'exact_process',
        windowHandle: 12, windowProcessId: 44, windowExecutable: 'old.exe',
        windowWaitMilliseconds: 10000, adbPath: 'adb.exe', adbSerial: 'serial',
        sourceBinding: { sourceKind: 'mxu', sourceInstanceId: 'one' },
        sourceSnapshot: { saved: true }, dependencyLock: { saved: true },
        runtimeInputs: { saved: true }, authorizedFingerprint: 'old-authority' };
      const schema = { projectName: 'Maa Root', projectVersion: '1',
        controllers: [{ name: 'adb', label: 'ADB', type: 'Adb' }],
        resources: [{ name: 'main', label: 'Main' }], tasks: [], options: {}, presets: [] };
      window.maaDraft = null;
      await window.testMount('maa-framework', {
        readEditor: async () => ({ providerId: 'maa-framework', mode: 'script', packageRoot: 'D:/new', profile }),
        discover: async () => ({ interfaceCandidates: ['interface.json', 'alt.json'],
          candidates: [{ id: 'source', name: 'Source', kind: 'mxu', instanceId: 'one' }], schema }),
        inspect: async () => ({ schema }), preview: async () => ({}), applyPreset: async value => value,
        findWindows: async () => [], previewImport: async () => ({ details: {} }),
        publishDraft: (_context, value) => { window.maaDraft = value; },
        saveBinding: async () => {},
      }, 'automation.script.editor');
    });
    await page.getByText('请先选择项目接口，再继续编辑配置。').waitFor();
    await choose(page.getByText('项目接口').locator('..').locator('nexus-select'), 'alt.json');
    await page.getByText('高级设置').click();
    await page.getByText('Controller', { exact: true }).waitFor();
    const draft = await page.evaluate(() => window.maaDraft);
    if (draft?.packageRoot !== 'D:/new' || draft?.interfacePath !== 'alt.json' || draft?.sourceBinding !== null || draft?.dependencyLock !== null
      || draft?.authorizedFingerprint !== '' || draft?.windowHandle !== 0)
      throw new Error(`Maa root authority survived change: ${JSON.stringify(draft)}`);
  });

  await test('activities failed immediate save restores confirmed values', async () => {
    await page.evaluate(async () => {
      window.activityWrites = 0;
      const state = { revision: 1, settingsRevision: 1, selectedFeedIds: ['cn'], rotationSeconds: 30,
        gameOrder: ['genshin-impact'], progressions: { 'genshin-impact': 'cn' },
        pauseOnHover: true, pauseWhenHidden: true, feeds: [
          { id: 'cn', game: 'genshin-impact', server: 'CN', progressionId: 'cn', contentLocale: 'zh-CN',
            enabled: true, overview: { title: 'CN' }, events: [] },
          { id: 'jp', game: 'genshin-impact', server: 'JP', progressionId: 'jp', contentLocale: 'ja-JP',
            enabled: true, overview: { title: 'JP' }, events: [] }],
        progressionOptions: { 'genshin-impact': [{ value: 'cn', label: 'CN' }, { value: 'jp', label: 'JP' }] } };
      await window.testMount('game-activities', { readState: async () => state,
        saveSettings: async () => { window.activityWrites++; throw Error('fixture save failed'); },
        refreshAll: async () => state, readCover: async () => new Blob(), subscribe: () => () => {},
      }, 'overview.cards');
    });
    await page.getByRole('button', { name: '活动设置', exact: true }).click();
    const selection = page.locator('nexus-select[aria-label="原神 内容进度"]');
    await choose(selection, 'jp');
    await page.getByText('fixture save failed').waitFor();
    if (await selection.evaluate(element => element.value) !== 'cn' || await page.locator('dialog[open]').count() !== 1)
      throw new Error('Failed setting did not restore its confirmed value or retain the error surface');
    await page.locator('nexus-modal').getByRole('button', { name: '取消', exact: true }).click();
    await page.locator('nexus-modal').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '活动设置', exact: true }).click();
    if (await page.locator('nexus-select[aria-label="原神 内容进度"]').evaluate(element => element.value) !== 'cn')
      throw new Error('Activity setting reopened with an uncommitted value');
    if (await page.evaluate(() => window.activityWrites) !== 1) throw new Error('Cancelling an unchanged activity setting wrote settings');
  });

  await test('checkin failed save retains draft through hide and retry', async () => {
    await page.evaluate(async () => {
      let state = { revision: 1, timeZoneId: 'Asia/Shanghai', tasks: [], platforms: [], notificationTasks: [] };
      window.checkinSaves = 0;
      window.checkinReads = 0;
      await window.testMount('game-checkin', { readState: async () => { window.checkinReads++; return state; },
        openEditor: async () => ({ editorSessionId: 'draft', fields: {} }),
        readEditor: async () => ({ editorSessionId: 'draft', fields: {} }),
        leaseEditor: async () => {}, closeEditor: async () => {},
        saveTask: async (_operationId, draft) => { if (++window.checkinSaves === 1) throw Error('fixture conflict');
          state = { ...state, revision: 2, tasks: [{ ...draft, id: 'saved', isRunning: false }] }; return state; },
        deleteTask: async () => state, reorderTasks: async () => state, runTask: async () => state,
        revealCredential: async () => ({ value: '', remainingSeconds: 1 }), confirmReveal: async () => {},
        beginBrowserLogin: async () => ({ candidateId: '' }), cancelBrowserLogin: async () => {},
        prepareTajiduo: async () => ({ operationId: '' }), sendTajiduoCode: async () => {},
        loginTajiduo: async () => ({ candidateId: '', platformId: '' }), cancelTajiduo: async () => {},
      }, 'route');
    });
    await page.getByText('添加签到任务').click();
    const name = page.locator('.checkin-editor nexus-text-input').first().locator('input');
    await name.fill('冲突后保留');
    await page.getByRole('switch', { name: '启用此任务', exact: true }).click();
    await page.locator('.checkin-editor').getByText('保存', { exact: true }).click();
    await page.getByText('fixture conflict').waitFor();
    await page.evaluate(() => window.fixture.hide());
    const reads = await page.evaluate(() => window.checkinReads);
    await page.waitForTimeout(100);
    if (await page.evaluate(() => window.checkinReads) !== reads) throw new Error('Hidden checkin polled');
    await page.evaluate(() => window.fixture.show());
    if (await name.inputValue() !== '冲突后保留') throw new Error('Hidden draft was lost');
    await page.locator('.checkin-editor').getByText('保存', { exact: true }).click();
    await page.getByText('冲突后保留').waitFor();
    if (await page.evaluate(() => window.checkinSaves) !== 2) throw new Error('Checkin retry did not save');
  });
  const { runLocaleCases } = await import('./locale-cases.mjs');
  await runLocaleCases({ page, test, reportRoot });
  const { checkinEditorCases } = await import('./checkin-editor-cases.mjs');
  await checkinEditorCases({ page, test });
  const { maaEditorCases } = await import('./maa-editor-cases.mjs');
  await maaEditorCases({ page, test });
  const { maaScriptCases } = await import('./maa-script-cases.mjs');
  await maaScriptCases({ page, test });
}
