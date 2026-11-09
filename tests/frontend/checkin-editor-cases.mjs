import { choose, confirm } from './controls.mjs';

async function mountEditor(page, delayed = false) {
  await page.evaluate(async delayed => {
    const fields = {
      cn: { configured: true, source: 'manual', fieldGeneration: 3 },
      os: { configured: true, source: 'browser', fieldGeneration: 4 },
      kuro: { configured: true, source: 'browser', fieldGeneration: 5 },
    };
    const state = { revision: 1, configurationRevision: 1, timeZoneId: 'Asia/Tokyo', tasks: [],
      platforms: Object.keys(fields).map(id => ({ id, name: id, games: [{ id: 'game', name: id + ' game' }],
        browserLogin: { ready: id === 'cn', status: id === 'cn' ? 'ready' : 'notAvailable' } })),
      notificationTasks: [{ id: 'notice', name: 'Test notice', type: 'webhook', enabled: true, configured: true }] };
    window.editorReads = []; window.manualReads = []; window.editorWrites = []; window.editorCloses = [];
    window.browserCancels = []; window.browserResults = []; window.metadataReads = [];
    window.editorMetadata = { editorSessionId: 'editor-fields', fields };
    await window.testMount('game-checkin', {
      canReveal: true,
      readState: async () => state,
      openEditor: () => delayed ? new Promise(resolve => window.editorReads.push(resolve)) : Promise.resolve(window.editorMetadata),
      readEditor: () => new Promise(resolve => window.metadataReads.push(resolve)),
      leaseEditor: async () => {}, closeEditor: async id => { window.editorCloses.push(id); },
      revealCredential: (id, _session, signal) => new Promise(resolve => window.manualReads.push({ id, resolve, signal })),
      confirmReveal: async () => {},
      beginBrowserLogin: () => new Promise(resolve => window.browserResults.push(resolve)),
      cancelBrowserLogin: async id => { window.browserCancels.push(id); },
      readPublication: async () => false,
      saveTask: async (operationId, draft, session, secrets) => {
        window.editorWrites.push(structuredClone({ operationId, draft, session, secrets }));
        return { ...state, revision: 2, tasks: [{ ...draft, id: 'saved', isRunning: false }] };
      },
    }, 'route');
  }, delayed);
  await page.getByRole('button', { name: '添加签到任务', exact: true }).click();
}

function secretInput(page, id) { return page.locator(`nexus-text-input[aria-label="${id} 凭据"]`).locator('input'); }

export async function checkinEditorCases({ page, test }) {
  await test('checkin unknown save retains operation through hide and checks without replay', async () => {
    await mountEditor(page);
    await page.getByRole('textbox', { name: '任务名称', exact: true }).fill('Unknown save');
    await choose(page.locator('nexus-select[aria-label="cn 签到游戏"]'), 'game'); await page.keyboard.press('Escape');
    await page.evaluate(() => {
      window.unknownWrites = []; window.publicationReads = []; window.publicationCommitted = false;
      window.fixture.ports.saveTask = async (operationId, draft) => {
        window.unknownWrites.push({ operationId, draft: structuredClone(draft) });
        throw Object.assign(new Error('controlled response lost'), { uncertain: true });
      };
      window.fixture.ports.readPublication = async id => { window.publicationReads.push(id); return window.publicationCommitted; };
    });
    const editor = page.locator('.checkin-editor');
    await editor.getByRole('button', { name: '保存', exact: true }).click();
    await page.waitForFunction(() => window.unknownWrites.length === 1);
    if (!await editor.getByRole('button', { name: '保存', exact: true }).isDisabled()) throw Error('Unknown write allowed another save');
    await page.evaluate(() => { window.fixture.hide(); window.fixture.show(); });
    if (await page.getByRole('textbox', { name: '任务名称', exact: true }).inputValue() !== 'Unknown save') throw Error('Unknown draft lost on hide');
    await editor.getByRole('button', { name: '检查保存结果', exact: true }).click();
    await page.waitForFunction(() => window.publicationReads.length === 1);
    if (!await page.evaluate(() => window.unknownWrites.length === 1 && window.publicationReads[0] === window.unknownWrites[0].operationId)) throw Error('Check replaced or replayed the operation');
    await page.evaluate(() => { window.publicationCommitted = true; });
    await editor.getByRole('button', { name: '检查保存结果', exact: true }).click();
    await editor.waitFor({ state: 'detached' });
    if (!await page.evaluate(() => window.unknownWrites.length === 1 && window.publicationReads.length > 0 &&
      window.publicationReads.every(id => id === window.unknownWrites[0].operationId))) throw Error('Committed reconciliation sent another save');
  });
  await test('checkin pending hidden editor never opens a top layer and retains ordinary draft', async () => {
    await mountEditor(page, true);
    await page.waitForFunction(() => window.editorReads.length === 1);
    await page.evaluate(() => { window.fixture.hide(); window.editorReads[0](window.editorMetadata); });
    const editor = page.locator('.checkin-editor'); await editor.waitFor({ state: 'attached' });
    if (!await editor.evaluate(element => element.hidden && !element.shadowRoot.querySelector('dialog').open)
      || await page.evaluate(() => window.manualReads.length)) throw Error('A hidden pending editor exposed its surface or requested plaintext');
    await page.evaluate(() => window.fixture.show());
    await page.getByRole('textbox', { name: '任务名称', exact: true }).fill('Ordinary draft');
    await secretInput(page, 'cn').fill('synthetic-input-only');
    await page.evaluate(() => window.fixture.hide());
    if (await secretInput(page, 'cn').inputValue()) throw Error('Hidden editor retained plaintext');
    await page.evaluate(() => window.fixture.show());
    if (await page.getByRole('textbox', { name: '任务名称', exact: true }).inputValue() !== 'Ordinary draft'
      || await secretInput(page, 'cn').inputValue()) throw Error('Resume discarded ordinary fields or restored plaintext');
    await editor.getByRole('button', { name: '取消', exact: true }).click();
    await editor.waitFor({ state: 'detached' });
    if (!await page.evaluate(() => window.editorCloses.includes('editor-fields'))) throw Error('Editor session was not released');
  });

  await test('checkin late manual reads and login metadata cannot replace user edits', async () => {
    await mountEditor(page);
    await page.getByRole('button', { name: '显示凭据', exact: true }).first().click();
    await confirm(page);
    await page.waitForFunction(() => window.manualReads.length === 1);
    await secretInput(page, 'cn').fill('synthetic-new-input');
    await page.evaluate(() => window.manualReads[0].resolve({ value: 'synthetic-old-read', remainingSeconds: 60 }));
    if (await secretInput(page, 'cn').inputValue() !== 'synthetic-new-input') throw Error('Late manual read replaced current input');
    await page.getByRole('button', { name: '浏览器登录', exact: true }).click();
    await page.waitForFunction(() => window.browserResults.length === 1);
    await page.evaluate(() => window.browserResults[0]({ candidateId: 'synthetic-candidate', fieldGeneration: 3 }));
    await page.waitForFunction(() => window.metadataReads.length === 1);
    await secretInput(page, 'cn').fill('synthetic-final-input');
    await page.evaluate(() => window.metadataReads[0](window.editorMetadata));
    await page.waitForFunction(() => window.browserCancels.length > 0);
    await page.getByRole('textbox', { name: '任务名称', exact: true }).fill('Credential race');
    await choose(page.locator('nexus-select[aria-label="cn 签到游戏"]'), 'game');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'os · 清除已保存凭据', exact: true }).click();
    await page.locator('.checkin-editor').getByRole('button', { name: '保存', exact: true }).click();
    await page.waitForFunction(() => window.editorWrites.length === 1);
    const saved = await page.evaluate(() => window.editorWrites[0]);
    if (saved.secrets.cn.action !== 'set' || saved.secrets.cn.value !== 'synthetic-final-input'
      || saved.secrets.cn.candidateId || saved.secrets.os.action !== 'clear' || saved.secrets.os.fieldGeneration !== 4
      || saved.secrets.kuro.action !== 'keep' || saved.secrets.kuro.fieldGeneration !== 5
      || JSON.stringify(saved.draft).includes('synthetic-')) throw Error('Secret intents or ordinary draft separation failed');
  });

  await test('checkin manual reveal expires while game schedule and notification choices save', async () => {
    await mountEditor(page);
    await page.getByRole('button', { name: '显示凭据', exact: true }).first().click();
    await confirm(page);
    await page.waitForFunction(() => window.manualReads.length === 1);
    await page.evaluate(() => window.manualReads[0].resolve({ value: 'synthetic-readable', remainingSeconds: 1 }));
    await page.waitForFunction(() => document.querySelector('nexus-text-input[aria-label="cn 凭据"]').value === 'synthetic-readable');
    if (await secretInput(page, 'cn').getAttribute('type') !== 'text') throw Error('Confirmed read did not reveal the current value');
    await page.getByRole('button', { name: '隐藏凭据', exact: true }).first().click();
    if (await secretInput(page, 'cn').getAttribute('type') !== 'password') throw Error('Eye action did not mask the current value');
    await page.waitForFunction(() => !document.querySelector('nexus-text-input[aria-label="cn 凭据"]').value);
    await page.getByRole('textbox', { name: '任务名称', exact: true }).fill('Complete schedule');
    await choose(page.locator('nexus-select[aria-label="cn 签到游戏"]'), 'game');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '+ 添加定时', exact: true }).click();
    if (!await page.locator('.checkin-schedule-card').evaluate(element => element.open)) throw Error('New schedule must start expanded');
    await page.locator('.checkin-days').getByRole('button', { name: '日', exact: true }).click();
    await page.getByRole('switch', { name: '启用通知', exact: true }).click();
    await choose(page.locator('nexus-select[aria-label="通知任务"]'), 'notice');
    await page.keyboard.press('Escape');
    await page.locator('.checkin-editor').getByRole('button', { name: '保存', exact: true }).click();
    await page.waitForFunction(() => window.editorWrites.length === 1);
    const saved = await page.evaluate(() => window.editorWrites[0]);
    if (saved.draft.games.cn[0] !== 'game' || !saved.draft.schedules[0].days.includes(0)
      || saved.draft.schedules[0].days.length !== 6
      || saved.draft.schedules[0].time !== '09:00' || !saved.draft.notification.enabled
      || saved.draft.notification.notificationTaskIds[0] !== 'notice' || saved.secrets.cn.action !== 'keep')
      throw Error('Ordinary editor values or unchanged secret intent were not preserved');
  });

  await test('checkin invalid names and schedule weekdays are rejected before writes', async () => {
    await mountEditor(page);
    const save = page.locator('.checkin-editor').getByRole('button', { name: '保存', exact: true });
    await save.click(); await page.getByText('请输入不超过 100 个字符的任务名称', { exact: true }).waitFor();
    await page.getByRole('textbox', { name: '任务名称', exact: true }).fill('Invalid weekdays');
    await choose(page.locator('nexus-select[aria-label="cn 签到游戏"]'), 'game');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '+ 添加定时', exact: true }).click();
    if (!await page.locator('.checkin-schedule-card').evaluate(element => element.open)) throw Error('New schedule must start expanded');
    for (const day of ['一', '二', '三', '四', '五'])
      await page.locator('.checkin-days').getByRole('button', { name: day, exact: true }).click();
    await save.click(); await page.getByText('请检查计划时间和执行星期', { exact: true }).waitFor();
    if (await page.evaluate(() => window.editorWrites.length)) throw Error('Invalid editor values reached the save port');
  });
}
