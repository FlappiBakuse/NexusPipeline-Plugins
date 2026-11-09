import assert from 'node:assert/strict';
import path from 'node:path';
import { choose, confirm } from '../frontend/controls.mjs';

export async function browserCases(page, checks, output) {
  const editor = page.locator('.maa-editor');
  const button = name => editor.getByRole('button', { name, exact: true });
  const select = label => editor.locator('nexus-select[aria-label=' + JSON.stringify(label) + ']');
  const readWrites = () => page.evaluate(() => window.writes);
  const preview = () => button('只读执行预览').click();
  const status = text => editor.getByText(text, { exact: true }).waitFor();
  const passed = name => checks.push({ name, status: 'PASS' });

  const previewOutput = editor.locator('.maa-output');
  const taskName = '重复任务 🌌';
  const occurrences = [['row-0', 'original-0', taskName], ['row-1', 'original-1', taskName]];

  await button('读取项目').click();
  await choose(select('项目接口'), 'interface.json');
  await choose(select('来源配置'), 'local-b');
  await button('读取项目').click();
  const tasks = editor.locator('.maa-occurrence').getByText(taskName, { exact: true });
  await tasks.nth(1).waitFor();
  assert.equal(await tasks.count(), occurrences.length);
  await preview();
  await previewOutput.filter({ hasText: 'original-1' }).waitFor();
  const result = JSON.parse(await previewOutput.textContent());
  assert.deepEqual(result.tasks.map(row => [row.Id, row.SourceId, row.Name]), occurrences);
  assert.deepEqual(await readWrites(), []);
  passed('the actual editor renders both paged occurrences and previews without writing');

  await button('保存用户配置').click();
  await confirm(page);
  await status('已保存');
  const writes = await readWrites();
  assert.equal(writes.length, 1);
  const { input, operationId } = writes[0];
  assert.ok(operationId);
  assert.equal(input.expectedBindingRevision, 7);
  assert.equal(input.expectedSelectionRevision, 2);
  assert.equal(input.selection.InterfacePath, 'interface.json');
  assert.deepEqual(input.selection.Source, { Kind: 'mfa', Path: 'config/instances/b.json', InstanceId: 'b' });
  assert.deepEqual(input.selection.Profile.Tasks.map(row => [row.Id, row.SourceId, row.Name]), occurrences);
  passed('confirmed save binds the selected same-name source and both original occurrences to the CAS revisions');

  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'responsive_overflow_' + width);
    await page.screenshot({ path: path.join(output, 'maa-project-' + width + '.png'), fullPage: true });
  }
  passed('the project editor fits three viewport widths');

  const originalOutput = await previewOutput.textContent();
  await page.evaluate(() => { window.mode = 'tamper'; });
  await preview();
  await status('Maa 配置分页已变化，请重新读取配置。');
  assert.equal(await previewOutput.textContent(), originalOutput);
  passed('a changed task page digest cannot replace the valid preview');

  await page.evaluate(() => { window.mode = 'late'; });
  await preview();
  await page.waitForFunction(() => typeof window.late === 'function');
  await choose(select('Controller'), 'alternate');
  await page.evaluate(() => window.late());
  await status('草稿已变化，请重新执行此操作');
  assert.equal(await previewOutput.textContent(), '');
  await button('保存用户配置').click();
  await status('请先预览当前配置');
  assert.equal((await readWrites()).length, 1);
  passed('changing the draft during preview prevents a stale result and another save');

  const lateId = await page.evaluate(() => window.previewId);
  assert.ok(lateId);
  await page.evaluate(() => window.disposeFixture());
  await editor.waitFor({ state: 'detached' });
  await page.waitForFunction(id => window.releasedId === id, lateId);
  passed('closing the surface releases the last preview and removes the editor');
}
