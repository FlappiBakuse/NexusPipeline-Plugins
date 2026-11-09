import { choose } from './controls.mjs';

async function mount(page, reject) {
  await page.evaluate(async reject => {
    const state = { revision: 1, configurationRevision: 1, timeZoneId: 'UTC', tasks: [], notificationTasks: [],
      platforms: [{ id: 'cn', name: 'cn', games: [{ id: 'game', name: 'Game' }], browserLogin: { ready: false, status: 'notAvailable' } }] };
    const editor = { editorSessionId: 'editor-publication', revision: 1,
      fields: { cn: { configured: false, source: 'none', fieldGeneration: 0 } } };
    window.publicationCalls = []; window.publicationPhase = 0; window.refreshFailures = 1;
    window.rejectPublication = reject;
    const transport = { connectionKind: 'local', async invoke(operation, input, signal, operationId) {
      window.publicationCalls.push({ operation, input: structuredClone(input), operationId, phase: window.publicationPhase, aborted: signal.aborted });
      if (['open-editor', 'read-editor'].includes(operation)) return { ok: true, value: editor };
      if (operation === 'save-task') {
        if (window.rejectPublication) return { ok: false, error: { code: 'credential_field_stale' } };
        if (reject) return { ok: true, value: state };
        throw new Error('controlled lost write response');
      }
      if (operation === 'read-publication') {
        if (window.publicationPhase === 0) throw new Error('controlled offline read');
        return { ok: true, value: { committed: window.publicationPhase === 2 } };
      }
      if (operation === 'read-state') {
        if (window.publicationPhase === 2 && window.refreshFailures-- > 0) throw new Error('controlled refresh failure');
        return { ok: true, value: state };
      }
      return { ok: true, value: {} };
    } };
    await window.testMount('game-checkin', transport, 'route', 'zh-CN', true);
  }, reject);
  await page.getByRole('button', { name: '添加签到任务', exact: true }).click();
  await page.getByRole('textbox', { name: '任务名称', exact: true }).fill('Publication probe');
  await choose(page.locator('nexus-select[aria-label="cn 签到游戏"]'), 'game');
  await page.keyboard.press('Escape');
}

export async function checkinPublicationCases({ page, test }) {
  await test('checkin production transport reconciles offline and committed refresh without replay', async () => {
    await mount(page, false);
    const editor = page.locator('.checkin-editor');
    const save = editor.getByRole('button', { name: '保存', exact: true });
    const check = editor.getByRole('button', { name: '检查保存结果', exact: true });
    const secret = editor.locator('nexus-text-input[aria-label="cn 凭据"] input');
    await secret.fill('synthetic-publication-input');
    await save.click(); await check.waitFor();
    if (!await save.isDisabled()) throw Error('Unknown save was not frozen');
    if (await secret.inputValue()) throw Error('Unknown save retained submitted credential plaintext');
    await check.click();
    await page.getByText('保存结果仍待确认，请稍后检查。', { exact: true }).waitFor();
    await page.evaluate(() => { window.fixture.hide(); window.fixture.show(); window.publicationPhase = 1; });
    await check.click();
    await page.getByText('保存结果仍待确认，请保留草稿并稍后检查。', { exact: true }).waitFor();
    if (!await save.isDisabled()) throw Error('Uncommitted operation was unlocked');
    await page.evaluate(() => { window.publicationPhase = 2; });
    await check.click();
    await page.getByText('已提交，刷新失败，请再次检查。', { exact: true }).waitFor();
    await check.click(); await editor.waitFor({ state: 'detached' });
    const calls = await page.evaluate(() => window.publicationCalls);
    const writes = calls.filter(row => row.operation === 'save-task');
    const reads = calls.filter(row => row.operation === 'read-publication');
    if (writes.length !== 1 || ![0, 1, 2].every(phase => reads.some(row => row.phase === phase)) || !writes[0].operationId ||
        reads.some(row => row.input.publicationOperationId !== writes[0].operationId || row.operationId))
      throw Error('Publication reconciliation replaced identity or replayed a write');
  });

  await test('checkin production transport leaves explicit business rejection editable', async () => {
    await mount(page, true);
    const editor = page.locator('.checkin-editor');
    const save = editor.getByRole('button', { name: '保存', exact: true });
    await save.click(); await page.getByText('凭据草稿已更新，请重新打开编辑器。', { exact: true }).waitFor();
    if (await save.isDisabled() || await editor.getByRole('button', { name: '检查保存结果', exact: true }).isVisible())
      throw Error('Explicit rejection became an unknown write');
    await page.evaluate(() => { window.rejectPublication = false; });
    await save.click(); await editor.waitFor({ state: 'detached' });
    const calls = await page.evaluate(() => window.publicationCalls);
    const writes = calls.filter(row => row.operation === 'save-task');
    if (writes.length !== 2 || writes[0].operationId === writes[1].operationId || calls.some(row => row.operation === 'read-publication'))
      throw Error('Rejected write was reconciled or reused instead of an explicit new save');
  });
}
