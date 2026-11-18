import fs from 'node:fs';
import path from 'node:path';

export async function themeConsumerCases({ page, test, hostRoot }) {
  await test('checkin restored draft warnings follow the Host theme palette', async () => {
    await page.evaluate(async () => {
      const task = { id: 'palette-task', name: 'Saved task', remark: '', enabled: true, games: {}, schedules: [],
        notification: { enabled: false, notificationTaskIds: [] }, isRunning: false, nextRunAt: null, recentRun: null };
      const state = { revision: 1, configurationRevision: 1, timeZoneId: 'Asia/Tokyo', tasks: [task], platforms: [], notificationTasks: [] };
      await window.testMount('game-checkin', { readState: async () => state, subscribe: () => () => {},
        openEditor: async () => ({ editorSessionId: 'palette-editor', task, fields: {} }),
        readEditor: async () => ({ editorSessionId: 'palette-editor', task, fields: {} }), closeEditor: async () => {} }, 'route');
    });
    await page.addStyleTag({ content: ['apps/web/src/styles/theme.css', 'apps/web/src/ui/theme.css']
      .map(file => fs.readFileSync(path.join(hostRoot, file), 'utf8')).join('\n') });
    await page.getByRole('button', { name: '编辑签到', exact: true }).click();
    await page.getByRole('textbox', { name: '任务名称', exact: true }).fill('Changed task');
    await page.locator('.checkin-editor').getByRole('button', { name: '关闭', exact: true }).click();
    await page.locator('.checkin-editor').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '编辑签到', exact: true }).click();
    for (const [theme, system] of [['dark', 'dark'], ['light', 'light'], ['system', 'dark'], ['system', 'light']]) {
      await page.emulateMedia({ colorScheme: system });
      const colors = await page.evaluate(theme => {
        document.body.dataset.theme = theme;
        document.body.style.setProperty('--accent', '#257045');
        const notice = getComputedStyle(document.querySelector('.draft-restored'));
        const field = getComputedStyle(document.querySelector('[data-unsaved=true]'));
        return { color: notice.color, outline: field.outlineColor, border: notice.borderTopColor };
      }, theme);
      const expected = (theme === 'light' || theme === 'system' && system === 'light') ? 'rgb(166, 106, 11)' : 'rgb(246, 191, 97)';
      if (colors.color !== expected || colors.outline !== expected || colors.border === 'rgba(0, 0, 0, 0)')
        throw Error('Restored draft warning did not follow ' + theme + '/' + system + ': ' + JSON.stringify(colors));
    }
  });
}
