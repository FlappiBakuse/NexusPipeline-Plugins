import path from 'node:path';

export async function browserCases(page, checks, output, limit = 12) {
  const check = async (name, body) => {
    if (checks.length >= limit) return;
    try { await body(); checks.push({ name, status: 'PASS' }); }
    catch (error) {
      const diagnostics = await page.evaluate(() => {
        const inspect = element => { const rect = element.getBoundingClientRect(); return { tag: element.localName,
          label: element.getAttribute('aria-label'), hidden: element.hidden, inert: element.inert, open: element.open,
          display: getComputedStyle(element).display, visibility: getComputedStyle(element).visibility, width: rect.width, height: rect.height,
          popover: element.hasAttribute('popover') ? element.matches(':popover-open') : undefined }; };
        const values = [];
        function visit(root) { for (const element of root.querySelectorAll('*')) {
          if (element.matches('nexus-confirm-dialog,nexus-time-picker,dialog,.popup') || element.matches('button[data-unit]')) values.push(inspect(element));
          if (element.shadowRoot) visit(element.shadowRoot);
        } }
        visit(document); return { controls: values, timeEvents: window.timeEvents, timeStates: window.timeStates };
      });
      await page.screenshot({ path: path.join(output, `failed-${checks.length + 1}.png`), fullPage: true });
      checks.push({ name, status: 'FAIL', error: String(error), body: (await page.locator('body').innerText()).slice(-2000), diagnostics });
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
  const save = () => page.locator('.checkin-editor').getByRole('button', { name: '保存', exact: true }).click();
  await check('empty default and complete fourteen-game choices on remote manual page', async () => {
    await reset(); await openNew();
    if (!await page.evaluate(() => ['visible', 'onVisibilityChanged', 'setAppearance'].every(key => !Object.hasOwn(window.fixtureSurface, key)))) throw Error('Fixture lost prototype SDK shape');
    if (await page.locator('.checkin-games nexus-select').count() !== 6) {
      const count = await page.locator('nexus-select[aria-label$=" 签到游戏"]').count(); if (count !== 6) throw Error('Missing platforms');
    }
    if (!await page.evaluate(() => [...document.querySelectorAll('nexus-select[aria-label$=" 签到游戏"]')].reduce((count, select) => count + select.options.length, 0) === 14)) throw Error('Missing game choices');
    if (await page.getByRole('button', { name: '浏览器登录', exact: true }).count() || await page.getByRole('button', { name: '塔吉多登录', exact: true }).count()) throw Error('Remote page offered native login');
    if (!await page.evaluate(() => window.state.tasks.length === 0 && window.saves.length === 0)) throw Error('Created a default task');
  });
  await check('cancelled task editor clears visible credential and never saves', async () => {
    await reset(); await openNew(); await choose(); await fill('库街区 凭据', 'synthetic-sensitive-canary');
    await page.evaluate(() => window.fixtureSurface.setVisible(false));
    await page.locator('.checkin-editor').waitFor({ state: 'hidden' });
    if (!await page.evaluate(() => !window.fixtureSurface.visible && document.querySelector('.checkin-editor').hidden && window.visibility.size === 2 &&
      [...document.querySelectorAll('input')].every(input => input.value !== 'synthetic-sensitive-canary'))) throw Error('Prototype visibility hide retained a private draft');
    await page.evaluate(() => window.fixtureSurface.setVisible(true));
    await page.locator('.checkin-editor').waitFor({ state: 'visible' });
    if (!await page.evaluate(() => window.fixtureSurface.visible && !document.querySelector('.checkin-editor').hidden)) throw Error('Editor failed to follow current visibility');
    await page.locator('.checkin-editor').getByRole('button', { name: '取消', exact: true }).click();
    await page.locator('.checkin-editor').waitFor({ state: 'detached' });
    if (!await page.evaluate(() => window.saves.length === 0 && window.state.tasks.length === 0 && window.visibility.size === 1 && !document.querySelector('input[type=password]'))) throw Error('Cancel retained a value, visibility subscription or published a task');
  });
  await check('multi-game multi-schedule save uses null new identity and explicit secret actions', async () => {
    await reset(); await openNew(); await choose(); await fill('库街区 凭据', 'synthetic-token');
    await page.getByRole('button', { name: '+ 添加定时', exact: true }).click();
    await page.locator('.checkin-schedule-card > summary').first().click();
    await page.evaluate(() => {
      window.timeEvents = []; window.timeStates = [];
      for (const type of ['pointerdown', 'focusin', 'scroll']) window.addEventListener(type, event => {
        if (window.timeEvents.length < 40) window.timeEvents.push({ type, path: event.composedPath().filter(node => node instanceof Element).slice(0, 8).map(node => node.localName + (node.getAttribute('aria-label') ?? '')) });
      }, { capture: true, once: false });
    });
    const time = page.locator('nexus-time-picker'); await time.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await time.getByRole('button', { name: '执行时间', exact: true }).click();
    await time.evaluate(element => { const popup = element.shadowRoot.querySelector('span').shadowRoot.querySelector('.popup'); window.timeStates.push({ phase: 'opened', value: element.value, hidden: popup.hidden, popover: popup.matches(':popover-open') }); });
    for (let index = 0; index < 4; index++) await time.getByRole('button', { name: '增加小时', exact: true }).click();
    for (let index = 0; index < 15; index++) await time.getByRole('button', { name: '减少分钟', exact: true }).click();
    await time.getByRole('button', { name: '执行时间', exact: true }).click();
    await page.locator('.checkin-days').first().getByRole('button', { name: '日', exact: true }).click();
    await page.getByRole('button', { name: '+ 添加定时', exact: true }).click();
    await save(); await page.locator('.checkin-editor').waitFor({ state: 'detached' });
    if (!await page.evaluate(() => window.saves.length === 1 && window.saves[0].newIdWasNull && window.saves[0].task.games.kuro.length === 2 &&
      window.saves[0].task.schedules.length === 2 && window.saves[0].task.schedules[0].time === '13:45' && !window.saves[0].task.schedules[0].days.includes(0) &&
      window.saves[0].actions.kuro.action === 'set' && window.saves[0].actions.kuro.hasValue && Object.keys(window.saves[0].actions).length === 6 &&
      Object.entries(window.saves[0].actions).filter(([id]) => id !== 'kuro').every(([, action]) => action.action === 'keep') && window.state.configurationRevision === 1)) throw Error('Task/CAS/secret intent changed');
    await page.screenshot({ path: path.join(output, 'production-wide.png'), fullPage: true });
  });
  await check('credential reveal confirms current-client duration then clears on close', async () => {
    await reset(true); await page.evaluate(() => { window.isLocal = true; window.credentialSource = 'manual'; }); await page.getByRole('button', { name: '编辑签到', exact: true }).click();
    await page.locator('.checkin-editor').waitFor();
    if (await page.locator('nexus-text-input[aria-label="库街区 凭据"] input').inputValue()) throw Error('Plaintext returned in ordinary state');
    if (!await page.evaluate(() => window.calls.every(call => !['confirm-reveal', 'reveal-credential'].includes(call.operation)))) throw Error('Mount requested disclosure');
    await page.locator('.checkin-credential').filter({ has: page.locator('nexus-text-input[aria-label="库街区 凭据"]') }).getByRole('button', { name: '显示凭据', exact: true }).click();
    await page.locator('nexus-confirm-dialog dialog').waitFor();
    if (!(await page.locator('nexus-confirm-dialog p').innerText()).includes('24小时')) throw Error('Disclosure duration not stated');
    if (!await page.evaluate(() => window.calls.every(call => !['confirm-reveal', 'reveal-credential'].includes(call.operation)))) throw Error('Unconfirmed disclosure requested');
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
  await check('configuration conflict keeps editor and prevents silent replacement', async () => {
    await reset(); await openNew(); await choose(); await page.evaluate(() => { window.saveFailure = 'conflict'; }); await save();
    await page.locator('.checkin-editor .plugin-status.plugin-error').waitFor();
    if (!await page.evaluate(() => window.saves.length === 0 && window.state.tasks.length === 0 && !!document.querySelector('.checkin-editor'))) throw Error('Conflict discarded editor or published');
  });
  await check('lost saved reply reads only original publication and never repeats write', async () => {
    await reset(); await openNew(); await choose(); await page.evaluate(() => { window.saveFailure = 'committedReplyLost'; }); await save();
    await page.locator('.checkin-editor').waitFor({ state: 'detached' });
    if (!await page.evaluate(() => { const writes = window.calls.filter(call => call.operation === 'save-task'), reads = window.calls.filter(call => call.operation === 'read-publication');
      return writes.length === 1 && reads.length === 1 && writes[0].operationId === reads[0].publicationOperationId && window.state.tasks.length === 1; })) throw Error('Publication recovery changed operation identity');
  });
  await check('unresolved publication remains unknown and disables new save', async () => {
    await reset(); await openNew(); await choose(); await page.evaluate(() => { window.saveFailure = 'unknown'; }); await save();
    await page.waitForFunction(() => [...document.querySelectorAll('.checkin-editor nexus-button')].some(button => button.textContent === '保存' && button.disabled));
    if (!await page.evaluate(() => window.calls.filter(call => call.operation === 'save-task').length === 1 && window.calls.filter(call => call.operation === 'read-publication').length === 1 &&
      window.state.tasks.length === 0 && document.querySelector('.checkin-editor').innerText.includes('保存结果待确认'))) throw Error('Unknown save was replayed or presented as completed');
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
