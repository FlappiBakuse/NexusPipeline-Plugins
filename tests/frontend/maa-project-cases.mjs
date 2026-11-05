import { choose, confirm } from './controls.mjs';

export async function mountProject(page, surface = 'automation.binding.editor') {
  await page.evaluate(async surface => {
    const source = { Kind: 'mxu', Path: 'config/mxu.json', InstanceId: 'one' };
    const selection = { InterfacePath: 'assets/interface.json', ClientKind: 'mxu', Language: 'zh_cn', Source: source };
    const id = 'a03b85a1-cd1f-447b-b397-4ab756789012';
    const imported = { Controller: 'win', Resource: 'main', Tasks: [{ Id: id, SourceId: 'source-task-one', Name: 'Daily',
      Order: 0, Enabled: true, RepeatCount: 1, Options: {}, DefinitionKnown: true }], Pretasks: [],
      GlobalOptions: { Login: { user: 'original-user' } }, ResourceOptions: {}, ControllerOptions: {} };
    const schema = { name: 'Production Maa', version: '1', controller: [{ name: 'win', label: 'Win32', type: 'Win32' }],
      resource: [{ name: 'main', label: 'Main' }], task: [{ name: 'Daily', label: 'Daily', default_check: true, repeatable: true }],
      option: { Login: { label: 'Credentials', type: 'input', inputs: [{ name: 'user' }, { name: 'secret', password: true }] },
        Mode: { label: 'Run mode', type: 'select', default_case: 'normal', cases: [
          { name: 'normal', label: 'Normal', option: ['Details'] }, { name: 'fast', label: 'Fast' }] },
        Details: { label: 'Details', type: 'input', inputs: [{ name: 'count', default: '3' }] } },
      global_option: ['Login', 'Mode'], preset: [{ name: 'daily-only', label: 'Daily only' }] };
    const state = { revision: 1, selection, calls: [], attempts: [], commits: 0, mode: '', previews: new Map(), results: new Map() };
    const inline = value => ({ kind: 'inline', value });
    const view = chosen => {
      const profile = { ...structuredClone(imported), ...structuredClone(chosen.Profile ?? {}) };
      for (const key of ['Tasks', 'Pretasks']) profile[key] = profile[key].map(row => ({ ...row,
        SourceId: row.SourceId || 'nexus-profile:' + row.Id, DefinitionKnown: true }));
      return { format: 'maa.editor.index', version: 1, selection: chosen,
        compilation: { canExecute: true, snapshotFingerprint: 'a'.repeat(64), compilationFingerprint: 'b'.repeat(64) }, schema: inline(schema), translations: inline({}),
        configurationBindings: inline([]), diagnostics: inline([]), profile: { ...profile,
          Tasks: inline(profile.Tasks), Pretasks: inline(profile.Pretasks), GlobalOptions: inline(profile.GlobalOptions),
          ResourceOptions: inline(profile.ResourceOptions), ControllerOptions: inline(profile.ControllerOptions) } };
    };
    const transport = { connectionKind: 'local', subscribe: () => () => {},
      async project(_context, action, input, _signal, operationId) {
        state.calls.push({ action, input: structuredClone(input), operationId });
        if (action === 'context') return { providerId: 'maa-framework', compilerId: 'project', ...(surface === 'automation.script.editor' ? { scriptRevision: 1 } : { bindingRevision: 1 }),
          selectionRevision: state.revision, scriptName: 'Production Maa', selection: structuredClone(state.selection) };
        if (action === 'discover') return { Interfaces: ['assets/interface.json'], Sources: [
          { Id: 'mxu-one', Name: 'One', ...source }] };
        if (action === 'preview') {
          const bytes = new TextEncoder().encode(JSON.stringify(view(input.selection ?? state.selection)));
          const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
          const previewId = crypto.randomUUID(), asset = { name: 'editor-index', kind: 'index', sizeBytes: bytes.length, sha256: sha };
          state.previews.set(previewId, { name: asset.name, sha256: sha, contentBase64: btoa(String.fromCharCode(...bytes)) });
          return { previewId, rootIndex: asset.name, expiresAt: new Date(Date.now() + 300000).toISOString(), assets: [asset] };
        }
        if (action === 'page') {
          const value = state.previews.get(input.previewId);
          if (!value || value.name !== input.asset) throw Error('fixture_preview_unbound');
          return value;
        }
        if (action === 'release') return { released: state.previews.delete(input.previewId) };
        if (action === 'result') {
          const value = state.results.get(input.operationId);
          if (value && JSON.stringify(value.input) !== JSON.stringify({ expectedBindingRevision: input.expectedBindingRevision,
            expectedSelectionRevision: input.expectedSelectionRevision, providerId: input.providerId, selection: input.selection })) throw Error('fixture_operation_conflict');
          return { operationId: input.operationId, found: Boolean(value), revision: value?.revision ?? null };
        }
        if (action !== 'select' || !operationId) throw Error('fixture_operation_unbound');
        state.attempts.push({ operationId, input: structuredClone(input) });
        const previous = state.results.get(operationId);
        if (previous) return { operationId, revision: previous.revision, isNew: false };
        if (state.mode === 'missing-unknown') {
          state.mode = '';
          throw Object.assign(Error('fixture_disconnected_before_acceptance'), { uncertain: true });
        }
        if (input.expectedSelectionRevision !== state.revision) throw Error('fixture_revision_conflict');
        state.selection = structuredClone(input.selection);
        state.commits++;
        state.results.set(operationId, { input: structuredClone(input), revision: ++state.revision });
        if (state.mode === 'committed-unknown') {
          state.mode = '';
          throw Object.assign(Error('fixture_disconnected_after_acceptance'), { uncertain: true });
        }
        return { operationId, revision: state.revision, isNew: true };
      },
      invoke: async () => { throw Error('fixture_unexpected_generic_operation'); }
    };
    window.maaProject = state;
    window.maaTransport = transport;
    await window.testMount('maa-framework', transport, surface, 'zh-CN', true);
  }, surface);
  if (surface === 'automation.script.editor') await page.getByRole('button', { name: '高级设置', exact: true }).click();
  await page.getByRole('button', { name: '读取项目', exact: true }).click();
  await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).waitFor();
}

export async function previewSave(page, mode = '') {
  await page.getByRole('button', { name: '只读执行预览', exact: true }).click();
  await page.locator('.maa-output').filter({ hasText: '"canExecute": true' }).waitFor();
  await page.evaluate(value => { window.maaProject.mode = value; }, mode);
  await page.getByRole('button', { name: '保存用户配置', exact: true }).click();
  await confirm(page);
}

export async function maaProjectCases({ page, test }) {
  await test('Production Maa frontend edits independent tasks and saves its actual projected draft', async () => {
    await mountProject(page);
    if (await page.locator('nexus-select[aria-label="Run mode"] input[role=combobox]').inputValue() !== 'Normal' ||
        await page.getByRole('textbox', { name: 'Details / count', exact: true }).inputValue() !== '3')
      throw Error('Production editor did not display projected defaults and their nested fields');
    await choose(page.locator('nexus-select[aria-label="添加任务条目"]'), 'Daily');
    await page.locator('.maa-occurrence').nth(1).waitFor();
    await page.getByRole('textbox', { name: 'Daily · 重复次数', exact: true }).first().fill('2');
    await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).fill('edited-user');
    await page.getByRole('textbox', { name: '原生 DLL 相对目录', exact: true }).fill('runtime/native');
    await page.locator('.maa-runtime-inputs summary').click();
    await page.getByRole('button', { name: '添加运行程序', exact: true }).click();
    await page.getByRole('textbox', { name: '项目程序名称', exact: true }).fill('python');
    await page.getByRole('textbox', { name: '程序或解释器相对路径', exact: true }).fill('python/python.exe');
    await page.getByRole('button', { name: '添加运行目录', exact: true }).click();
    await page.getByRole('textbox', { name: '附加运行目录', exact: true }).fill('python/Lib');
    await page.locator('.maa-occurrences').evaluate(element => {
      element.dispatchEvent(new CustomEvent('nexus-reorder', { detail: { ids: [...element.ids].reverse() } }));
    });
    await previewSave(page);
    await page.getByText('已保存', { exact: true }).waitFor();
    if (!await page.evaluate(() => {
      const state = window.maaProject, draft = state.selection.Profile;
      return state.commits === 1 && draft.Tasks.length === 2 && draft.Tasks[0].Id !== draft.Tasks[1].Id &&
        draft.Tasks[0].Order === 0 && draft.Tasks[1].RepeatCount === 2 && draft.GlobalOptions.Login.user === 'edited-user' &&
        !Object.hasOwn(draft.GlobalOptions, 'Mode') && !Object.hasOwn(draft.GlobalOptions, 'Details') &&
        state.calls.filter(call => call.action === 'preview').some(call => call.input.selection?.Profile?.Tasks.length === 2) &&
        state.selection.Runtime.NativeDirectory === 'runtime/native' &&
        state.selection.Runtime.Executables.python === 'python/python.exe' && state.selection.Runtime.Directories[0] === 'python/Lib';
    })) throw Error('Production frontend failed to retain task identity, order, repeat or input through preview and CAS save');
    await page.evaluate(async () => {
      window.fixture.dispose();
      await window.testMount('maa-framework', window.maaTransport, 'automation.binding.editor', 'zh-CN', true);
    });
    await page.getByRole('button', { name: '读取项目', exact: true }).click();
    if (await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).inputValue() !== 'edited-user')
      throw Error('Production frontend could not reopen its saved profile');
    await page.locator('.maa-occurrence').nth(1).waitFor();
    if (await page.getByRole('textbox', { name: '原生 DLL 相对目录', exact: true }).inputValue() !== 'runtime/native' ||
        await page.getByRole('textbox', { name: '程序或解释器相对路径', exact: true }).inputValue() !== 'python/python.exe' ||
        await page.getByRole('textbox', { name: '附加运行目录', exact: true }).inputValue() !== 'python/Lib')
      throw Error('Production frontend lost saved runtime files when reopening');
    await page.getByRole('textbox', { name: '导入源相对路径（只读）', exact: true }).fill('config/mxu.json');
    await page.getByRole('textbox', { name: '源实例精确 ID', exact: true }).fill('one');
    await page.getByRole('button', { name: '预览显式导入', exact: true }).click();
    await page.locator('.maa-output').filter({ hasText: '"canExecute": true' }).waitFor();
    if (!await page.evaluate(() => {
      const state = window.maaProject, selection = state.calls.filter(call => call.action === 'preview').at(-1).input.selection;
      return !selection.Profile && state.commits === 1 && selection.Runtime.NativeDirectory === 'runtime/native' &&
        selection.Runtime.Executables.python === 'python/python.exe' && selection.Runtime.Directories[0] === 'python/Lib';
    })) throw Error('Readonly configuration import lost runtime mapping or persisted the draft');
  });

  for (const mode of ['committed-unknown', 'missing-unknown'])
    await test('Production Maa frontend resolves the original save operation/' + mode, async () => {
      await mountProject(page);
      await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).fill('frozen-user');
      await previewSave(page, mode);
      await page.getByText('保存结果待确认，请保留草稿并读取原操作结果。', { exact: true }).waitFor();
      await page.getByRole('button', { name: '读取原保存结果', exact: true }).click();
      if (mode === 'missing-unknown') {
        await page.getByText('原操作仍未确认，请继续读取原保存结果。', { exact: true }).waitFor();
        await page.getByRole('textbox', { name: 'Credentials / user', exact: true }).fill('later-draft');
        await page.getByRole('button', { name: '按原操作重试', exact: true }).click();
      }
      await page.getByText('已保存', { exact: true }).waitFor();
      if (!await page.evaluate(mode => {
        const state = window.maaProject;
        return state.commits === 1 && state.selection.Profile.GlobalOptions.Login.user === 'frozen-user' &&
          state.attempts.length === (mode === 'missing-unknown' ? 2 : 1) &&
          state.attempts.every(attempt => attempt.operationId === state.attempts[0].operationId &&
            JSON.stringify(attempt.input) === JSON.stringify(state.attempts[0].input));
      }, mode)) throw Error('Unknown result caused a different operation or lost its frozen input');
    });
}
