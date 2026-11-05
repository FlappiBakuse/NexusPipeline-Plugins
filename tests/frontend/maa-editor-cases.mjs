import { choose, confirm } from './controls.mjs';

async function mountEditor(page) {
  await page.evaluate(async () => {
    const profile = { profileId: 'guarded-profile', revision: '1', packageRoot: 'D:/fixture', interfacePath: 'interface.json',
      nativeDirectory: '', language: 'zh_cn', controller: 'win', resource: 'main', taskOccurrences: [],
      options: { credentials: { user: 'original-user' } }, resourceOptions: {}, controllerOptions: {},
      sourceSnapshot: { compilation: { compilationFingerprint: 'a'.repeat(64) } },
      windowSelection: 'exact_process', windowHandle: 0, windowProcessId: 0, windowExecutable: '', windowWaitMilliseconds: 10000,
      adbPath: '', adbSerial: '' };
    const schema = { projectName: 'Guarded Maa', projectVersion: '1', controllers: [{ name: 'win', label: 'Win32', type: 'Win32' }],
      resources: [{ name: 'main', label: 'Main' }, { name: 'other', label: 'Other' }], tasks: [], presets: [], globalOptions: ['credentials'],
      options: { credentials: { label: 'Credentials', type: 'input', inputs: [{ name: 'user', label: 'User' }, { name: 'secret', label: 'Secret', password: true }] } } };
    window.maaPreviews = []; window.maaSecrets = []; window.maaWrites = []; window.maaDraft = undefined;
    window.maaDiscoveries = 0; window.maaUnknown = false;
    window.maaHashOriginal ??= crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = window.maaHashOriginal;
    await window.testMount('maa-framework', {
      readEditor: async () => ({ providerId: 'maa-framework', mode: 'binding', profile }),
      discover: async () => { window.maaDiscoveries++; return { interfaceCandidates: ['interface.json'], candidates: [], schema }; },
      inspect: async () => ({ schema }),
      preview: (value, signal) => new Promise(resolve => window.maaPreviews.push({ value, signal, resolve })),
      publishDraft: (_context, value) => { window.maaDraft = value; },
      saveBinding: async (_context, value, _source, _signal, inputs) => {
        window.maaWrites.push(structuredClone(value));
        window.maaSecrets.push(structuredClone(inputs ?? []));
        if (window.maaUnknown) throw Object.assign(Error('synthetic unknown outcome'), { uncertain: true });
      },
    }, 'automation.binding.editor');
  });
  await page.getByRole('button', { name: '读取项目', exact: true }).click();
  await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).waitFor();
  if (await page.evaluate(() => window.maaDiscoveries)) throw Error('Binding editor discovered sources before the legacy Read project action');
}

export async function maaEditorCases({ page, test }) {
  await test('Maa invalid JSON and counts block preview through redraw until corrected', async () => {
    await mountEditor(page);
    const area = page.locator('nexus-text-area[aria-label="资源层选项覆盖（JSON）"]').locator('textarea');
    await area.fill('[]');
    await page.getByRole('button', { name: '只读执行预览', exact: true }).click();
    await page.getByText('请先修正无效输入：资源层选项覆盖（JSON）', { exact: true }).waitFor();
    if (await page.evaluate(() => window.maaPreviews.length)) throw Error('Invalid JSON reached the preview port');
    await choose(page.locator('nexus-select[aria-label="Resource"]'), 'other');
    if (await area.inputValue() !== '[]') throw Error('Redraw discarded an invalid ordinary draft');
    await area.fill('{}');
    const count = page.getByRole('textbox', { name: '窗口等待上限（毫秒）', exact: true });
    for (const value of ['', '1.5', '30001']) {
      await count.fill(value); await page.getByRole('button', { name: '只读执行预览', exact: true }).click();
      if (await page.evaluate(() => window.maaPreviews.length)) throw Error('Invalid count reached the preview port');
    }
    await count.fill('12000'); await page.getByRole('button', { name: '只读执行预览', exact: true }).click();
    await page.waitForFunction(() => window.maaPreviews.length === 1);
    if (!await page.evaluate(() => window.maaPreviews[0].value.windowWaitMilliseconds === 12000
      && !Array.isArray(window.maaPreviews[0].value.resourceOptions))) throw Error('Corrected fields were not captured');
  });

  await test('Maa execution preview owns an immutable profile and rejects a late changed result', async () => {
    await mountEditor(page);
    await page.getByRole('button', { name: '只读执行预览', exact: true }).click();
    await page.waitForFunction(() => window.maaPreviews.length === 1);
    await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).fill('changed-user');
    if (!await page.evaluate(() => window.maaPreviews[0].value.options.credentials.user === 'original-user'
      && window.maaDraft.options.credentials.user === 'changed-user')) throw Error('In-flight preview input mutated with the draft');
    await page.evaluate(() => window.maaPreviews[0].resolve({ marker: 'obsolete-preview' }));
    await page.getByText('草稿已变化，请重新执行此操作', { exact: true }).waitFor();
    if (await page.locator('.maa-output').textContent()) throw Error('Obsolete execution preview reached the output');
  });

  await test('Maa hidden editor clears plaintext and refuses late local protected staging without writes', async () => {
    await mountEditor(page);
    const secret = page.locator('nexus-text-input[aria-label="Credentials / secret"]').locator('input');
    await secret.fill('synthetic-secret-only');
    await page.evaluate(() => {
      window.maaHashes = [];
      crypto.subtle.digest = (...args) => new Promise(resolve => window.maaHashes.push(() => window.maaHashOriginal(...args).then(resolve)));
    });
    await page.getByRole('button', { name: '使用新密钥草稿', exact: true }).click();
    await page.waitForFunction(() => window.maaHashes.length === 1);
    await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).fill('ordinary-user');
    await page.evaluate(async () => { window.fixture.hide(); await window.maaHashes[0](); });
    if (await secret.inputValue()) throw Error('Hidden Maa editor kept its secret input');
    await page.evaluate(() => window.fixture.show());
    if (await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).inputValue() !== 'ordinary-user'
      || await page.evaluate(() => window.maaDraft.options.credentials.secret)) throw Error('Visibility changed ordinary fields or accepted a late secret');
    await secret.fill('synthetic-current-secret'); await page.getByRole('button', { name: '使用新密钥草稿', exact: true }).click();
    await page.waitForFunction(() => window.maaHashes.length === 2);
    await choose(page.locator('nexus-select[aria-label="Resource"]'), 'other');
    await page.evaluate(async () => { await window.maaHashes[1](); crypto.subtle.digest = window.maaHashOriginal; });
    if (await page.evaluate(() => window.maaDraft.options.credentials.secret)) throw Error('Replaced render published a late secret');
    if (await page.evaluate(() => window.maaSecrets.length || window.maaWrites.length)) throw Error('Local staging wrote without explicit save');
  });

  await test('Maa secret set is absent from ordinary preview and written only with confirmed save', async () => {
    await mountEditor(page);
    await page.locator('nexus-text-input[aria-label="Credentials / secret"]').locator('input').fill('fixture-private-save-value');
    await page.getByRole('button', { name: '使用新密钥草稿', exact: true }).click();
    await page.waitForFunction(() => typeof window.maaDraft?.options.credentials.secret?.$maaSecret === 'string');
    if (await page.evaluate(() => JSON.stringify(window.maaDraft).includes('fixture-private-save-value') || window.maaWrites.length))
      throw Error('Secret staging leaked or persisted plaintext');
    await page.getByRole('button', { name: '只读执行预览', exact: true }).click();
    await page.waitForFunction(() => window.maaPreviews.length === 1);
    await page.evaluate(() => window.maaPreviews[0].resolve({ ready: true }));
    await page.locator('.maa-output').filter({ hasText: '"ready": true' }).waitFor();
    await page.getByRole('button', { name: '保存用户配置', exact: true }).click();
    await confirm(page, false);
    if (await page.evaluate(() => window.maaWrites.length || window.maaSecrets.length)) throw Error('Cancelled confirmation wrote secrets');
    await page.getByRole('button', { name: '保存用户配置', exact: true }).click(); await confirm(page);
    await page.waitForFunction(() => window.maaWrites.length === 1);
    if (!await page.evaluate(() => window.maaSecrets.length === 1 && window.maaSecrets[0][0].intent === 'set'
      && window.maaSecrets[0][0].value === 'fixture-private-save-value'
      && !JSON.stringify(window.maaWrites[0]).includes('fixture-private-save-value')))
      throw Error('Confirmed save did not carry one separate transient set intent');
    if (await page.locator('nexus-text-input[aria-label="Credentials / secret"]').locator('input').inputValue())
      throw Error('Save kept the plaintext draft');
  });

  await test('Maa unknown save preserves the draft and blocks repeated writes', async () => {
    await mountEditor(page);
    await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).fill('saved-user');
    await page.getByRole('button', { name: '只读执行预览', exact: true }).click();
    await page.waitForFunction(() => window.maaPreviews.length === 1);
    await page.evaluate(() => { window.maaUnknown = true; window.maaPreviews[0].resolve({ ready: true }); });
    await page.locator('.maa-output').filter({ hasText: '"ready": true' }).waitFor();
    const save = page.getByRole('button', { name: '保存用户配置', exact: true });
    await save.click(); await confirm(page);
    await page.getByText('保存结果待确认，请保留草稿并读取原操作结果。', { exact: true }).waitFor();
    if (!await save.isDisabled() || await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).inputValue() !== 'saved-user'
      || !await page.evaluate(() => window.maaWrites.length === 1 && window.maaWrites[0].options.credentials.user === 'saved-user'))
      throw Error('Unknown save lost its draft or did not retain exactly one frozen write');
  });
}
