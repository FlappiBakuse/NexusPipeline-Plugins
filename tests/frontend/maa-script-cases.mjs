import { confirm } from './controls.mjs';
import { mountProject } from './maa-project-cases.mjs';

export async function maaScriptCases({ page, test }) {
  await test('Production script editor saves and reopens independent choices without account authority or secret drafts', async () => {
    await mountProject(page, 'automation.script.editor');
    if (await page.locator('input[type=password]').count()) throw Error('Script editor offered account secret writes');
    await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).fill('script-project-user');
    await page.getByRole('button', { name: '只读执行预览', exact: true }).click();
    await page.locator('.maa-output').filter({ hasText: '"canExecute": true' }).waitFor();
    await page.getByRole('button', { name: '保存脚本项目配置', exact: true }).click();
    await confirm(page);
    await page.getByText('已保存', { exact: true }).waitFor();
    if (!await page.evaluate(() => window.maaProject.commits === 1 && window.maaProject.calls
      .filter(call => ['discover', 'preview', 'select'].includes(call.action))
      .every(call => call.input.expectedScriptRevision === 1 && !Object.hasOwn(call.input, 'expectedBindingRevision') &&
        !Object.hasOwn(call.input, 'protectedInputs')))) throw Error('Script command borrowed binding authority');
    await page.evaluate(async () => {
      window.fixture.dispose();
      await window.testMount('maa-framework', window.maaTransport, 'automation.script.editor', 'zh-CN', true);
    });
    await page.getByRole('button', { name: '高级设置', exact: true }).click();
    await page.getByRole('button', { name: '读取项目', exact: true }).click();
    if (await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).inputValue() !== 'script-project-user')
      throw Error('Reopened script choice lost its ordinary configuration');
  });
}
