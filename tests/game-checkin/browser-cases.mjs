import assert from 'node:assert/strict';
import path from 'node:path';

export async function browserCases(page, checks, output, limit) {
  const check = async (name, body) => {
    if (limit !== undefined && checks.length >= limit) return;
    try { await body(); checks.push({ name, status: 'PASS' }); }
    catch (error) {
      await page.screenshot({ path: path.join(output, `failed-${checks.length + 1}.png`), fullPage: true });
      checks.push({ name, status: 'FAIL', error: String(error), body: (await page.locator('body').innerText()).slice(-2000) });
    }
    console.log(JSON.stringify({ case: name, status: checks.at(-1).status }));
  };
  const reset = async (task = false) => {
    await page.evaluate(async value => window.mountFixture(value), task);
    await page.getByRole('button', { name: '添加签到任务', exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('.checkin-heading nexus-button').disabled);
  };
  const fill = (label, value) => page.locator(`nexus-text-input[aria-label="${label}"] input`).fill(value);
  const openNew = async () => {
    await page.getByRole('button', { name: '添加签到任务', exact: true }).click();
    await page.locator('.checkin-editor').waitFor(); await fill('任务名称', 'browser-task');
  };
  const choose = async () => {
    await page.locator('nexus-select[aria-label="库街区 签到游戏"]').evaluate(element => {
      element.value = ['ww', 'pgr']; element.dispatchEvent(new CustomEvent('nexus-change', { detail: { value: ['ww', 'pgr'] }, bubbles: true }));
    });
  };
  const editor = page.locator('.checkin-editor');
  const editorButton = name => editor.getByRole('button', { name, exact: true });
  const save = () => editorButton('保存').click();
  await check('empty default and the actual read-state game choices on the remote manual page', async () => {
    await reset(); await openNew();
    const expected = await page.evaluate(() => window.state.platforms.map(platform => [platform.name + ' 签到游戏',
      platform.games.map(game => [game.id, game.name])]));
    assert.deepEqual(await editor.locator('nexus-select[aria-label$=" 签到游戏"]').evaluateAll(selects =>
      selects.map(select => [select.getAttribute('aria-label'), select.options.map(option => [option.id, option.label])])), expected);
    if (await page.getByRole('button', { name: '浏览器登录', exact: true }).count() || await page.getByRole('button', { name: '塔吉多登录', exact: true }).count()) throw Error('Remote page offered native login');
    if (!await page.evaluate(() => window.state.tasks.length === 0 && window.saves.length === 0)) throw Error('Created a default task');
  });
  await check('cancelled task editor clears visible credential and never saves', async () => {
    await reset(); await openNew(); await choose(); await fill('库街区 凭据', 'synthetic-sensitive-canary');
    await page.evaluate(() => window.fixtureSurface.setVisible(false));
    await page.locator('.checkin-editor').waitFor({ state: 'hidden' });
    if (await page.locator('nexus-text-input[aria-label="库街区 凭据"] input').inputValue() !== '') throw Error('Hidden editor retained a private draft');
    await page.evaluate(() => window.fixtureSurface.setVisible(true));
    await page.locator('.checkin-editor').waitFor({ state: 'visible' });
    await editorButton('取消').click();
    await editor.waitFor({ state: 'detached' });
    await page.waitForFunction(() => window.editors.size === 0);
    if (!await page.evaluate(() => window.saves.length === 0 && window.state.tasks.length === 0)) throw Error('Cancel published a task');
  });
  await check('multi-game multi-schedule save uses null new identity and explicit secret actions', async () => {
    await reset(); await openNew(); await choose(); await fill('库街区 凭据', 'synthetic-token');
    await page.getByRole('button', { name: '+ 添加定时', exact: true }).click();
    const time = page.locator('nexus-time-picker'); await time.scrollIntoViewIfNeeded();
    await time.getByRole('button', { name: '执行时间', exact: true }).click();
    await time.getByRole('button', { name: '增加小时', exact: true }).click();
    await time.getByRole('button', { name: '增加分钟', exact: true }).press('Enter');
    await time.getByRole('button', { name: '执行时间', exact: true }).press('Escape');
    await page.locator('.checkin-days').first().getByRole('button', { name: '日', exact: true }).click();
    await page.getByRole('button', { name: '+ 添加定时', exact: true }).click();
    await save(); await page.locator('.checkin-editor').waitFor({ state: 'detached' });
    if (!await page.evaluate(() => window.saves.length === 1 && window.saves[0].newIdWasNull && window.saves[0].task.games.kuro.length === 2 &&
      window.saves[0].task.schedules.length === 2 && window.saves[0].task.schedules[0].time === '10:01' && window.saves[0].task.schedules[0].days.includes(0) &&
      window.saves[0].actions.kuro.action === 'set' && window.saves[0].actions.kuro.hasValue &&
      window.state.platforms.filter(platform => platform.id !== 'kuro').every(platform => window.saves[0].actions[platform.id]?.action === 'keep') &&
      window.state.configurationRevision === 1)) throw Error('Task/CAS/secret intent changed');
    await page.screenshot({ path: path.join(output, 'production-wide.png'), fullPage: true });
  });
  await check('credential reveal confirms current-client duration then clears on close', async () => {
    await reset(true); await page.evaluate(() => { window.isLocal = true; window.credentialSource = 'manual'; }); await page.getByRole('button', { name: '编辑签到', exact: true }).click();
    await page.locator('.checkin-editor').waitFor();
    if (await page.locator('nexus-text-input[aria-label="库街区 凭据"] input').inputValue()) throw Error('Plaintext returned in ordinary state');
    await page.locator('.checkin-credential').filter({ has: page.locator('nexus-text-input[aria-label="库街区 凭据"]') }).getByRole('button', { name: '显示凭据', exact: true }).click();
    await page.locator('nexus-confirm-dialog dialog').waitFor();
    if (!(await page.locator('nexus-confirm-dialog p').innerText()).includes('24小时')) throw Error('Disclosure duration not stated');
    await page.locator('nexus-confirm-dialog').getByRole('button', { name: '取消', exact: true }).click();
    await page.locator('nexus-confirm-dialog').waitFor({ state: 'detached' });
    if (!await page.evaluate(() => window.calls.every(call => !['confirm-reveal', 'reveal-credential'].includes(call.operation)))) throw Error('Cancelled confirmation sent a request');
    await page.locator('.checkin-credential').filter({ has: page.locator('nexus-text-input[aria-label="库街区 凭据"]') }).getByRole('button', { name: '显示凭据', exact: true }).click();
    await page.locator('nexus-confirm-dialog').getByRole('button', { name: '确认', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('nexus-text-input[aria-label="库街区 凭据"]').value === 'synthetic-sensitive-canary');
    await page.locator('nexus-confirm-dialog').waitFor({ state: 'detached' });
    await page.locator('.checkin-editor').getByRole('button', { name: '取消', exact: true }).click(); await page.locator('.checkin-editor').waitFor({ state: 'detached' });
    if (!await page.evaluate(() => window.calls.filter(call => ['confirm-reveal', 'reveal-credential'].includes(call.operation)).map(call => call.operation).join(',') === 'confirm-reveal,reveal-credential' && window.calls.filter(call => call.operation === 'reveal-credential').every(call => !!call.operationId) && window.saves.length === 0 &&
      [...document.querySelectorAll('input')].every(input => input.value !== 'synthetic-sensitive-canary'))) throw Error('Reveal leaked after editor cleanup');
  });
  await check('remote editing never requests disclosure and explicit clear still permits manual replacement', async () => {
    await reset(true); await page.evaluate(() => { window.credentialSource = 'manual'; }); await page.getByRole('button', { name: '编辑签到', exact: true }).click();
    const eye = page.locator('.checkin-credential').filter({ has: page.locator('nexus-text-input[aria-label="库街区 凭据"]') }).getByRole('button', { name: '显示凭据', exact: true });
    if (!await eye.isDisabled()) throw Error('Remote saved-secret reveal remained enabled');
    await eye.evaluate(element => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    if (!await page.evaluate(() => window.calls.every(call => !['confirm-reveal', 'reveal-credential'].includes(call.operation)) && !window.confirmed && window.saves.length === 0 && [...document.querySelectorAll('input')].every(input => input.value !== 'synthetic-sensitive-canary'))) throw Error('Remote editing requested or revealed a secret');
    await page.getByRole('button', { name: '库街区 · 清除已保存凭据', exact: true }).click();
    await fill('库街区 凭据', 'synthetic-new-manual-token');
    if (await page.locator('nexus-text-input[aria-label="库街区 凭据"] input').inputValue() !== 'synthetic-new-manual-token') throw Error('Remote manual entry was disabled');
  });
  await check('explicit clear preserves other platforms keep actions', async () => {
    await reset(true); await page.getByRole('button', { name: '编辑签到', exact: true }).click();
    await page.getByRole('button', { name: '库街区 · 清除已保存凭据', exact: true }).click(); await save();
    await page.locator('.checkin-editor').waitFor({ state: 'detached' });
    if (!await page.evaluate(() => window.saves[0].actions.kuro.action === 'clear' && !window.saves[0].actions.kuro.hasValue &&
      Object.entries(window.saves[0].actions).filter(([id]) => id !== 'kuro').every(([, action]) => action.action === 'keep'))) throw Error('Clear was inferred from an empty value');
  });
  await check('credential conflict keeps editor and prevents silent replacement', async () => {
    await reset(); await openNew(); await choose(); await page.evaluate(() => { window.saveFailure = 'conflict'; }); await save();
    await editor.getByText('任务或凭据已更新，请重新读取。', { exact: true }).waitFor();
    assert.equal(await editorButton('保存').isEnabled(), true);
    if (!await page.evaluate(() => window.saves.length === 0 && window.state.tasks.length === 0)) throw Error('Conflict published a task');
  });
  await check('lost saved reply reads only original publication and never repeats write', async () => {
    await reset(); await openNew(); await choose(); await page.evaluate(() => { window.saveFailure = 'committedReplyLost'; }); await save();
    await editorButton('检查保存结果').click();
    await page.locator('.checkin-editor').waitFor({ state: 'detached' });
    if (!await page.evaluate(() => { const writes = window.calls.filter(call => call.operation === 'save-task'), reads = window.calls.filter(call => call.operation === 'read-publication');
      return writes.length === 1 && reads.length === 1 && writes[0].operationId === reads[0].publicationOperationId && window.state.tasks.length === 1; })) throw Error('Publication recovery changed operation identity');
  });
  await check('unresolved publication remains unknown and disables new save', async () => {
    await reset(); await openNew(); await choose(); await page.evaluate(() => { window.saveFailure = 'unknown'; }); await save();
    await editorButton('检查保存结果').click();
    await editor.getByText('保存结果仍待确认，请保留草稿并稍后检查。', { exact: true }).waitFor();
    assert.equal(await editorButton('保存').isDisabled(), true);
    if (!await page.evaluate(() => window.calls.filter(call => call.operation === 'save-task').length === 1 && window.calls.filter(call => call.operation === 'read-publication').length === 1 &&
      window.state.tasks.length === 0)) throw Error('Unknown save was replayed or presented as completed');
  });
  await check('running task still offers delete through Host quiescence command', async () => {
    await reset(true); await page.getByRole('button', { name: '立即签到', exact: true }).click();
    await page.waitForFunction(() => window.state.tasks[0].isRunning);
    await page.getByRole('button', { name: '删除签到', exact: true }).click(); await page.locator('nexus-confirm-dialog').getByRole('button', { name: '确认', exact: true }).click();
    await page.waitForFunction(() => window.state.tasks.length === 0);
    if (!await page.evaluate(() => window.calls.filter(call => call.operation === 'delete-task').length === 1)) throw Error('Delete was hidden while running');
  });
  await check('narrow editor stays within viewport', async () => {
    await reset(); await page.setViewportSize({ width: 360, height: 800 }); await openNew(); await choose();
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) throw Error('Narrow viewport overflow');
    await page.screenshot({ path: path.join(output, 'production-360.png'), fullPage: true });
  });
  await check('scope stop clears editor, visibility subscription and polling', async () => {
    await page.evaluate(async () => { window.cleanup(); await window.scope.dispose(); window.stoppedCount = window.calls.length; });
    await page.waitForTimeout(5100);
    if (!await page.evaluate(() => window.calls.length === window.stoppedCount && window.visibility.size === 0 && !document.querySelector('.checkin-editor') &&
      !document.querySelector('input[type=password]'))) throw Error('Stopped scope retained work or private fields');
  });
}
