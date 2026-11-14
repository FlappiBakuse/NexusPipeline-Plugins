import { mountEditor as mountCheckin } from './checkin-editor-cases.mjs';
import { mountEditor as mountMaa } from './maa-editor-cases.mjs';
import { choose, confirm } from './controls.mjs';

export async function draftLifecycleCases({ page, test }) {
  await test('checkin draft lifecycle retains secrets and original unknown operation', async () => {
    await mountCheckin(page);
    await page.locator('.checkin-editor').getByRole('button', { name: '关闭', exact: true }).click();
    await page.locator('.checkin-editor').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '添加签到任务', exact: true }).click();
    if (await page.locator('.draft-restored:visible').count()) throw Error('An untouched new task became a draft');
    const secret = await page.evaluate(() => crypto.randomUUID());
    const input = () => page.locator('nexus-text-input[aria-label="cn 凭据"]').locator('input');
    await page.getByRole('textbox', { name: '任务名称', exact: true }).fill('Retained task');
    await input().fill(secret);
    await page.locator('.checkin-editor').getByRole('button', { name: '关闭', exact: true }).click();
    await page.locator('.checkin-editor').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '添加签到任务', exact: true }).click();
    if (await input().inputValue() !== secret || await input().getAttribute('type') !== 'password'
      || await page.getByRole('textbox', { name: '任务名称', exact: true }).inputValue() !== 'Retained task')
      throw Error('Closed checkin editor lost ordinary or protected input');
    await page.evaluate(() => window.fixture.remount());
    await page.getByRole('button', { name: '添加签到任务', exact: true }).click();
    if (await input().inputValue() !== secret) throw Error('Checkin page remount lost the protected draft');
    await page.locator('.checkin-editor').getByRole('button', { name: '取消', exact: true }).click();
    await page.locator('.checkin-editor').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '添加签到任务', exact: true }).click();
    if (await input().inputValue() || await page.getByRole('textbox', { name: '任务名称', exact: true }).inputValue())
      throw Error('Checkin cancellation did not start a fresh draft');
    await page.getByRole('textbox', { name: '任务名称', exact: true }).fill('Unknown operation');
    await input().fill(secret);
    await choose(page.locator('nexus-select[aria-label="cn 签到游戏"]'), 'game'); await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const save = window.fixture.ports.saveTask;
      window.fixture.ports.saveTask = async (...args) => { await save(...args); throw Object.assign(Error('lost reply'), { uncertain: true }); };
    });
    await page.locator('.checkin-editor').getByRole('button', { name: '保存', exact: true }).click();
    await page.getByRole('button', { name: '检查保存结果', exact: true }).waitFor();
    await page.evaluate(() => window.fixture.remount());
    await page.getByRole('button', { name: '添加签到任务', exact: true }).click();
    if (await input().inputValue() !== secret || !await page.locator('.checkin-editor').getByRole('button', { name: '保存', exact: true }).isDisabled())
      throw Error('Unknown checkin save lost its secret or write lock');
    await page.evaluate(() => { window.fixture.ports.readPublication = async () => true; });
    await page.getByRole('button', { name: '检查保存结果', exact: true }).click();
    await page.locator('.checkin-editor').waitFor({ state: 'detached' });
    if (await page.evaluate(() => window.editorWrites.length) !== 1) throw Error('Checkin result inspection replayed a save');
    await page.getByRole('button', { name: '添加签到任务', exact: true }).click();
    if (await input().inputValue()) throw Error('Confirmed checkin publication retained the submitted secret');
  });

  await test('checkin existing draft lifecycle highlights changed inputs and switches', async () => {
    await page.evaluate(async () => {
      const task = { id: 'existing-task', name: 'Saved task', remark: 'Saved note', enabled: true,
        games: {}, schedules: [], notification: { enabled: false, notificationTaskIds: [] }, isRunning: false, nextRunAt: null, recentRun: null };
      const state = { revision: 1, configurationRevision: 1, timeZoneId: 'Asia/Tokyo',
        tasks: [task], platforms: [], notificationTasks: [] };
      await window.testMount('game-checkin', { readState: async () => state, subscribe: () => () => {},
        openEditor: async () => ({ editorSessionId: 'existing-editor', task, fields: {} }),
        readEditor: async () => ({ editorSessionId: 'existing-editor', task, fields: {} }),
        closeEditor: async () => {} }, 'route');
    });
    const open = () => page.getByRole('button', { name: '编辑签到', exact: true }).click();
    await open();
    const name = () => page.getByRole('textbox', { name: '任务名称', exact: true });
    if (await page.locator('.draft-restored:visible').count()) throw Error('A first editing session showed a recovery reminder');
    await name().fill('Changed task');
    if (await page.locator('.checkin-editor [data-unsaved=true]').count()) throw Error('First-session input was highlighted');
    const enabled = () => page.getByRole('switch', { name: '启用此任务', exact: true });
    await enabled().click();
    if (await page.locator('.checkin-editor [data-unsaved=true]').count()) throw Error('First-session switch was highlighted');
    await page.locator('.checkin-editor').getByRole('button', { name: '关闭', exact: true }).click();
    await page.locator('.checkin-editor').waitFor({ state: 'detached' }); await open();
    await page.locator('.draft-restored:visible').waitFor();
    if (await page.locator('.checkin-editor [data-unsaved=true]').count() !== 2) throw Error('Restored fields were not highlighted');
    if (await name().inputValue() !== 'Changed task' || await enabled().getAttribute('aria-checked') !== 'false')
      throw Error('Restoring an existing task lost the edited values');
    await name().fill('Saved task'); await enabled().click();
    await page.waitForFunction(() => !document.querySelector('.checkin-editor [data-unsaved=true]'));
    await page.locator('.checkin-editor').getByRole('button', { name: '取消', exact: true }).click();
    await page.locator('.checkin-editor').waitFor({ state: 'detached' }); await open();
    if (await page.locator('.draft-restored:visible').count()) throw Error('Cancellation retained a recovery reminder');
  });

  await test('checkin login draft lifecycle preserves input while closing authentication resources', async () => {
    await page.evaluate(async () => {
      const metadata = { editorSessionId: 'login-draft', fields: { tajiduo: { configured: false, fieldGeneration: 0 } } };
      const state = { revision: 1, configurationRevision: 1, timeZoneId: 'Asia/Tokyo', tasks: [], notificationTasks: [],
        platforms: [{ id: 'tajiduo', name: 'tajiduo', games: [{ id: 'nte', name: 'nte' }], browserLogin: { ready: true, status: 'ready' } }] };
      window.loginDraftCancels = 0; window.loginDraftSubmits = 0;
      await window.testMount('game-checkin', { canReveal: true, readState: async () => state, subscribe: () => () => {},
        openEditor: async () => metadata, readEditor: async () => metadata, closeEditor: async () => {},
        prepareTajiduo: async () => ({ operationId: crypto.randomUUID() }),
        cancelTajiduo: async () => { window.loginDraftCancels++; },
        loginTajiduo: async () => { window.loginDraftSubmits++; throw Error('unexpected login'); } }, 'route');
    });
    await page.getByRole('button', { name: '添加签到任务', exact: true }).click();
    const open = () => page.getByRole('button', { name: '塔吉多登录', exact: true }).click();
    const modal = () => page.locator('.checkin-login-modal');
    const secret = await page.evaluate(() => crypto.randomUUID());
    await open();
    await modal().getByRole('textbox', { name: '手机号', exact: true }).fill('12345678901');
    await modal().getByRole('textbox', { name: '短信验证码', exact: true }).fill(secret);
    await modal().getByRole('button', { name: '关闭', exact: true }).click();
    await modal().waitFor({ state: 'detached' }); await open();
    if (await modal().getByRole('textbox', { name: '手机号', exact: true }).inputValue() !== '12345678901'
      || await modal().getByRole('textbox', { name: '短信验证码', exact: true }).inputValue() !== secret)
      throw Error('Closing authentication discarded its protected input draft');
    await modal().getByRole('button', { name: '取消', exact: true }).click();
    await modal().waitFor({ state: 'detached' }); await open();
    if (await modal().getByRole('textbox', { name: '手机号', exact: true }).inputValue()
      || await modal().getByRole('textbox', { name: '短信验证码', exact: true }).inputValue()
      || !await page.evaluate(() => window.loginDraftCancels >= 2 && window.loginDraftSubmits === 0))
      throw Error('Authentication cancel did not clear drafts or closing retained an active authentication operation');
  });

  await test('Maa draft lifecycle retains invalid input secrets and unknown save', async () => {
    await mountMaa(page);
    await page.evaluate(() => window.fixture.remount());
    if (await page.locator('.draft-restored:visible').count()) throw Error('An untouched Maa configuration became a draft');
    await page.getByRole('button', { name: '读取项目', exact: true }).click();
    const secret = await page.evaluate(() => crypto.randomUUID());
    const input = () => page.locator('nexus-text-input[aria-label="Credentials / secret"]').locator('input');
    const json = () => page.locator('nexus-text-area[aria-label="资源层选项覆盖（JSON）"]').locator('textarea');
    await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).fill('Retained user');
    await input().fill(secret); await json().fill('[]');
    await page.evaluate(() => { window.fixture.hide(); window.fixture.show(); });
    if (await input().inputValue() !== secret || await input().getAttribute('type') !== 'password')
      throw Error('Maa visibility discarded a protected draft');
    await page.evaluate(() => window.fixture.remount());
    if (await json().inputValue() !== '[]' || await input().inputValue() !== secret
      || await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).inputValue() !== 'Retained user')
      throw Error('Maa remount discarded ordinary, invalid or protected input');
    await json().fill('{}');
    await page.getByRole('button', { name: '使用新密钥草稿', exact: true }).click();
    await page.waitForFunction(() => !!window.maaDraft?.options.credentials.secret?.$maaSecret);
    if (await page.evaluate(value => JSON.stringify(window.maaDraft).includes(value), secret)) throw Error('Maa ordinary draft contains a secret');
    await page.getByRole('button', { name: '只读执行预览', exact: true }).click();
    await page.waitForFunction(() => window.maaPreviews.length === 1);
    await page.evaluate(() => { window.maaUnknown = true; window.maaPreviews[0].resolve({ ready: true }); });
    await page.locator('.maa-output').filter({ hasText: '"ready": true' }).waitFor();
    await page.getByRole('button', { name: '保存用户配置', exact: true }).click(); await confirm(page);
    await page.waitForFunction(() => window.maaWrites.length === 1);
    await page.evaluate(() => window.fixture.remount());
    if (await input().inputValue() !== secret || !await page.getByRole('button', { name: '保存用户配置', exact: true }).isDisabled())
      throw Error('Maa unknown save lost its secret draft or original operation lock');
    await page.evaluate(() => { window.fixture.ports.readSave = async () => true; });
    await page.getByRole('button', { name: '读取原保存结果', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('nexus-text-input[aria-label="Credentials / secret"]').value);
    if (await page.evaluate(() => window.maaWrites.length) !== 1) throw Error('Maa inspection replayed the original save');
    await input().fill(secret);
    await page.evaluate(async () => { window.fixture.cancelDrafts(); await window.fixture.remount(); });
    await page.getByRole('button', { name: '读取项目', exact: true }).click();
    if (await input().inputValue()) throw Error('Maa parent cancellation retained a secret draft');
  });

  await test('activity settings apply immediately and Cancel restores the current opening', async () => {
    await page.evaluate(async () => {
      let state = { revision: 1, settingsRevision: 1, selectedFeedIds: ['gi'], gameOrder: ['genshin-impact'],
        rotationSeconds: 30, pauseOnHover: true, pauseWhenHidden: true, progressions: {},
        feeds: [{ id: 'gi', game: 'genshin-impact', server: 'cn', progressionId: 'cn', contentLocale: 'zh-CN',
          enabled: true, overview: { title: 'Immediate activity' }, events: [] }] };
      window.activitySettingWrites = [];
      await window.testMount('game-activities', { readState: async () => state, subscribe: () => () => {},
        refreshAll: async () => state, readCover: async () => window.fixturePng(),
        saveSettings: async (value, _signal, operationId) => {
          window.activitySettingWrites.push({ value, operationId });
          if (window.holdActivitySave) await new Promise(resolve => { window.releaseActivitySave = resolve; });
          state = { ...value, revision: state.revision + 1, settingsRevision: state.settingsRevision + 1 };
          window.activitySettingState = state; return state;
        } }, 'overview.cards');
    });
    const open = () => page.getByRole('button', { name: '活动设置', exact: true }).click();
    const interval = () => page.locator('nexus-number-input[aria-label="轮播频率（秒）"]').locator('input');
    await open(); await interval().fill('45'); await interval().press('Tab');
    await page.waitForFunction(() => window.activitySettingState?.rotationSeconds === 45).catch(async reason => {
      throw Error('Completed activity input was not saved: ' + JSON.stringify(await page.evaluate(() => ({
        submitted: window.activitySettingWrites.map(item => item.value.rotationSeconds),
        shown: document.querySelector('nexus-number-input').value,
        invalid: document.querySelector('nexus-number-input').getAttribute('aria-invalid'),
        error: document.querySelector('.activity-error')?.textContent
      }))) + ' ' + reason.message);
    });
    await page.locator('nexus-modal').getByRole('button', { name: '关闭', exact: true }).click();
    await page.locator('nexus-modal').waitFor({ state: 'detached' }); await open();
    if (await interval().inputValue() !== '45' || await page.locator('.draft-restored').count())
      throw Error('Activity close did not retain committed settings independently of drafts');
    await page.evaluate(() => { window.holdActivitySave = true; });
    await interval().fill('60'); await interval().press('Tab');
    await page.waitForFunction(() => !!window.releaseActivitySave).catch(async reason => {
      throw Error('A pending activity save was not started: ' + JSON.stringify(await page.evaluate(() => ({
        submitted: window.activitySettingWrites.map(item => item.value.rotationSeconds),
        shown: document.querySelector('nexus-number-input').value,
        error: document.querySelector('.activity-error')?.textContent
      }))) + ' ' + reason.message);
    });
    await page.locator('nexus-modal').getByRole('button', { name: '取消', exact: true }).click();
    await page.evaluate(() => { window.holdActivitySave = false; window.releaseActivitySave(); });
    await page.locator('nexus-modal').waitFor({ state: 'detached' });
    if (await page.evaluate(() => window.activitySettingState.rotationSeconds) !== 45)
      throw Error('Activity Cancel did not persist the opening baseline');
    await page.evaluate(() => window.fixture.remount()); await open();
    if (await interval().inputValue() !== '45') throw Error('Activity remount lost committed settings');
    const widths = await page.locator('nexus-modal [slot=footer] nexus-button').evaluateAll(elements =>
      elements.map(element => Number.parseFloat(getComputedStyle(element).minWidth)));
    if (widths.length !== 2 || widths.some(width => width < 79.5)) throw Error('Secondary action width is inconsistent');
  });

  await test('wallpaper failures restore confirmed settings and lost replies are read without replay', async () => {
    await page.evaluate(async () => {
      let state = { revision: 1, enabled: false, effectiveEnabled: false, assets: [], order: [],
        rotation: { mode: 'off', intervalMinutes: 60 }, effects: { blurPx: 0, dimPercent: 0, surfaceTransparencyPercent: 20, secondaryTransparency: true } };
      window.wallpaperMode = 'fail'; window.wallpaperSends = []; window.wallpaperCommits = 0; window.wallpaperReads = [];
      const results = new Map();
      await window.testMount('custom-wallpaper', { connectionKind: async () => 'local', readState: async () => state,
        subscribe: () => () => {}, readAsset: async () => window.fixturePng(),
        readSettingsResult: async id => { window.wallpaperReads.push(id); return results.has(id); },
        saveSettings: async (patch, revision, _signal, operationId) => {
          window.wallpaperSends.push(operationId);
          if (window.wallpaperMode === 'fail') throw Error('save failed');
          state = { ...state, ...patch, revision: revision + 1 }; results.set(operationId, state); window.wallpaperCommits++;
          throw Object.assign(Error('reply lost'), { uncertain: true });
        } }, 'settings.panels');
    });
    const open = () => page.locator('.wallpaper-settings').getByRole('button').first().click();
    const toggle = () => page.getByRole('switch', { name: '启用自定义壁纸', exact: true });
    await open(); await toggle().click();
    await page.waitForFunction(() => window.wallpaperSends.length === 1);
    await page.waitForFunction(() => document.querySelector('nexus-switch-setting').value === false);
    await page.evaluate(() => window.fixture.remount()); await open();
    if (await toggle().getAttribute('aria-checked') !== 'false') throw Error('Wallpaper recovered an uncommitted draft');
    if (await page.getByRole('button', { name: /按原操作重试|取消|重试保存/ }).count())
      throw Error('Wallpaper retained draft lifecycle actions');
    await page.evaluate(() => { window.wallpaperMode = 'unknown'; }); await toggle().click();
    await page.waitForFunction(() => window.wallpaperReads.length > 0 && document.querySelector('nexus-switch-setting').value === true);
    if (!await page.evaluate(() => window.wallpaperSends.length === 2 && window.wallpaperCommits === 1 &&
      window.wallpaperReads.every(id => id === window.wallpaperSends[1])))
      throw Error('Wallpaper confirmation repeated a write or changed operation identity');
    await page.evaluate(() => window.fixture.remount()); await open();
    if (await toggle().getAttribute('aria-checked') !== 'true') throw Error('Committed wallpaper setting did not survive remount');
  });

}
