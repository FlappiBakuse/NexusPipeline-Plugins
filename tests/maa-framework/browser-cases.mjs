import path from 'node:path';
import { choose } from '../frontend/controls.mjs';

export async function browserCases(page, checks, output) {
  const check = (name, condition) => { if (!condition) throw Error(name); checks.push({ name, status: 'PASS' }); };
  const click = async name => page.locator('nexus-button').filter({ hasText: name }).click();
  await page.evaluate(() => window.mountFixture()); await page.getByText('Maa 重复任务项目', { exact: true }).waitFor();
  check('production frontend reads the actual binding surface context', await page.evaluate(() => window.calls.length === 1 && window.calls[0].action === 'context'));
  await click('保存来源选择'); await page.getByText('请明确选择接口与配置实例', { exact: true }).waitFor();
  check('save without explicit PI and instance performs no mutation', await page.evaluate(() => !window.calls.some(item => item.action === 'select')));
  await click('发现项目与配置'); await page.locator('nexus-select[aria-label="PI 接口"]').waitFor();
  await choose(page.locator('nexus-select[aria-label="PI 接口"]'), 'interface.json');
  await choose(page.locator('nexus-select[aria-label="保存配置实例"]'), 'local-b');
  await click('保存来源选择'); await page.getByText('配置需要修复，当前不可执行', { exact: true }).waitFor();
  check('same-name instances preserve the chosen source and CAS operation', await page.evaluate(() => {
    const item = window.calls.find(row => row.action === 'select');
    return item.input.selection.Source.InstanceId === 'b' && item.input.selection.Source.Path === 'config/instances/b.json' &&
      item.input.expectedBindingRevision === 7 && item.input.expectedSelectionRevision === 2 && !!item.operationId;
  }));
  await page.locator('summary').filter({ hasText: /^任务条目$/ }).click();
  await page.getByText('读取下一页', { exact: true }).waitFor();
  await page.locator('summary').filter({ hasText: /^0$/ }).first().click();
  await page.locator('summary').filter({ hasText: /^Name$/ }).first().click();
  await page.getByText('重复任务 🌌', { exact: true }).waitFor();
  check('bounded project pages render original duplicate task metadata and non-BMP labels', await page.evaluate(() => window.calls.some(row => row.action === 'page' && row.input.asset.startsWith('editor-page-'))));
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    if (!await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) throw Error('responsive_overflow_' + width);
    await page.screenshot({ path: path.join(output, 'maa-project-' + width + '.png'), fullPage: true });
  }
  check('three browser widths retain the bounded preview without horizontal overflow', true);
  await page.evaluate(() => { window.mode = 'tamper'; }); await click('读取当前冻结预览');
  await page.getByText('maa_editor_page_changed', { exact: true }).waitFor();
  check('changed page digest is rejected before publishing a replacement view', true);
  await page.evaluate(() => window.mountFixture()); await page.getByText('Maa 重复任务项目', { exact: true }).waitFor();
  await page.evaluate(() => { window.mode = 'late'; }); await click('读取当前冻结预览');
  await page.waitForFunction(() => window.late !== null);
  await choose(page.locator('nexus-select[aria-label="项目语言"]'), 'en_us');
  await page.evaluate(() => window.late());
  await page.waitForFunction(() => window.calls.some(row => row.action === 'release'));
  check('a late preview is released after its selection draft changes', await page.locator('[data-maa-preview]').count() === 0);
  await page.evaluate(() => window.disposeFixture());
  check('disposing the real surface scope removes all plugin DOM', await page.locator('nexus-card').count() === 0);
}
