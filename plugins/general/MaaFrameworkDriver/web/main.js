// Maintained ES module: only public Frontend API and nxp elements.
export function activate(host) {
  const text = (zh, en) => host.i18n.locale?.startsWith('en') ? en : zh;
  const active = new Set();
  const render = ({ element, context }) => {
    if (context.executionProviderId !== 'maa-framework') return () => {};
    const abort = new AbortController();
    let draftVersion = 0;
    let disposed = false, schema = null, preview = null, previewProfile = '', pendingImport = null, importSelection = '';
    const validationErrors = new Map();
    let pendingConfirmation;
    const confirm = message => new Promise(resolve => {
      if (disposed || pendingConfirmation) { resolve(false); return; }
      const dialog = document.createElement('nxp-confirm-dialog');
      dialog.open = true; dialog.title = text('确认', 'Confirm'); dialog.message = message;
      dialog.confirmLabel = text('确认', 'Confirm'); dialog.cancelLabel = text('取消', 'Cancel');
      const finish = accepted => { pendingConfirmation = null; dialog.remove(); resolve(accepted); };
      pendingConfirmation = finish;
      dialog.addEventListener('confirm', () => finish(true), { once: true });
      dialog.addEventListener('cancel', () => finish(false), { once: true });
      dialog.addEventListener('close', () => finish(false), { once: true });
      element.append(dialog);
    });
    const userId = context.mode === 'binding' ? context.secondaryId || '' : '';
    let importPath = '', importKind = 'mxu', importInstance = '', importMode = 'new', presetName = '';
    let explicitInterface = '', discovered = null, selectedSource = '', advanced = false;
    let profile = { schemaVersion: 3, profileId: context.executionProviderConfigId || crypto.randomUUID().replaceAll('-', ''),
      revision: '', packageRoot: context.packageRoot || '', interfacePath: 'interface.json', controller: '', resource: '',
      nativeDirectory: '', nativeVersion: '', language: 'zh_cn', selectedTasks: [], taskOccurrences: [], options: {}, resourceOptions: {}, controllerOptions: {}, taskOptions: {},
      windowHandle: 0, windowProcessId: 0, windowExecutable: '', windowSelection: 'exact_process', windowWaitMilliseconds: 10000, adbPath: '', adbSerial: '' };
    const card = document.createElement('nxp-section-card'); card.title = 'MaaFramework';
    const fields = document.createElement('div'); fields.dataset.pluginMaaFields = 'true';
    const actions = document.createElement('div'); actions.dataset.pluginMaaActions = 'true';
    const details = document.createElement('pre'); details.dataset.pluginMaaPreview = 'true';
    card.append(fields, actions, details); element.append(card);
    function notify(message, tone = 'info') { if (!disposed) host.ui.toast(message, tone); }
    function fail(error) { if (error?.name !== 'AbortError') notify(error?.message || String(error), 'error'); }
    function button(label, action) {
      const item = document.createElement('nxp-button'); item.textContent = label; item.type = 'button';
      item.addEventListener('click', () => { Promise.resolve().then(action).catch(fail); }, { signal: abort.signal });
      actions.append(item); return item;
    }
    function field(label, tag, value, change, props = {}) {
      const row = document.createElement('nxp-field'); row.label = label;
      const item = document.createElement(tag); Object.assign(item, { modelValue: value, ariaLabel: label }, props);
      item.addEventListener('update:modelValue', event => {
        const next = event.detail[0]; item.modelValue = next; preview = null;
        draftVersion += 1;
        try { change(next); validationErrors.delete(label); publishDraft(); }
        catch (error) { validationErrors.set(label, error.message || String(error)); fail(error); }
      }, { signal: abort.signal });
      row.append(item); fields.append(row); return item;
    }
    const options = list => (list || []).map(item => ({ value: item.name, label: item.label || item.name }));
    function publishDraft() {
      if (disposed) return;
      if (userId) {
        element.dispatchEvent(new CustomEvent('nxp-provider-user-draft', { bubbles: true }));
        return;
      }
      element.dispatchEvent(new CustomEvent('nxp-provider-configured', { bubbles: true, detail: {
        providerId: 'maa-framework', profileId: profile.profileId, packageRoot: profile.packageRoot,
        configuration: { profile: structuredClone(profile), sourceId: selectedSource }
      } }));
    }
    function draw() {
      fields.replaceChildren();
      if (!userId) {
        if (discovered?.interfaceCandidates?.length > 1) {
          field(text('项目接口', 'Project interface'), 'nxp-select', explicitInterface,
            value => { explicitInterface = value; profile.interfacePath = value; discover().catch(fail); },
            { options: discovered.interfaceCandidates.map(value => ({ value, label: value })) });
          return;
        }
        const choices = discovered?.candidates || [];
        if (choices.length > 1) field(text('来源配置', 'Source configuration'), 'nxp-select', selectedSource,
          value => { selectedSource = value; profile.sourceBinding = null; profile.sourceSnapshot = null; },
          { options: choices.map(item => ({ value: item.id, label: item.name + ' · ' + item.kind })) });
        const summary = document.createElement('p');
        summary.textContent = choices.length === 1 ? text('已发现来源配置：', 'Source configuration found: ') + choices[0].name
          : choices.length > 1 ? text('请选择要同步的来源配置。', 'Choose the source configuration to synchronize.')
          : text('正在查找项目及来源配置。', 'Looking for the project and source configuration.');
        fields.append(summary);
        if (!advanced) return;
      }
      field(text('Interface 相对路径', 'Relative interface path'), 'nxp-text-input', profile.interfacePath, v => profile.interfacePath = v);
      field(text('原生 DLL 相对目录', 'Relative native DLL directory'), 'nxp-text-input', profile.nativeDirectory, v => profile.nativeDirectory = v);
      field(text('导入源相对路径（只读）', 'Relative import source path (read-only)'), 'nxp-text-input', importPath, v => importPath = v);
      field(text('导入格式', 'Import schema'), 'nxp-select', importKind, v => importKind = v,
        { options: [{ value: 'mxu', label: 'MXU schema 1.0' }, { value: 'mfa', label: 'MFAAvalonia' }, { value: 'maapicli-v5.14.0', label: 'MaaPiCli v5.14.0' }] });
      field(text('源实例精确 ID', 'Exact source instance ID'), 'nxp-text-input', importInstance, v => importInstance = v);
      if (!userId) field(text('导入目标', 'Import target'), 'nxp-select', importMode, v => importMode = v,
        { options: [{ value: 'new', label: text('新建独立配置', 'New independent profile') }, { value: 'overwrite', label: text('覆盖此明确配置（CAS）', 'Overwrite this profile (CAS)') }] });
      if (!schema) return;
      field('Controller', 'nxp-select', profile.controller, v => { profile.controller = v; draw(); }, { options: options(schema.controller) });
      field('Resource', 'nxp-select', profile.resource, v => { profile.resource = v; draw(); }, { options: options(schema.resource) });
      field(text('任务预设', 'Task preset'), 'nxp-select', presetName, v => presetName = v, { options: options(schema.preset) });
      const applicable = item => (!item.controller || item.controller.includes(profile.controller))
        && (!item.resource || item.resource.includes(profile.resource));
      const taskChoices = (schema.task || []).filter(applicable).map(item => {
        const groups = (item.group || []).map(name => (schema.group || []).find(group => group.name === name)?.label || name);
        return { value: item.name, label: (groups.length ? groups.join(' / ') + ' · ' : '') + (item.label || item.name) };
      });
      field(text('添加任务条目', 'Add task occurrence'), 'nxp-select', '', name => {
        if (!taskChoices.some(item => item.value === name)) return;
        profile.taskOccurrences.push({ occurrenceId: crypto.randomUUID().replaceAll('-', ''), sourceTaskId: '',
          piTaskName: name, order: profile.taskOccurrences.length, enabled: true, repeatCount: 1, options: {}, pipelineOverride: {} });
        draw();
      }, { options: taskChoices });
      const ordered = document.createElement('nxp-sortable-list'); fields.append(ordered);
      ordered.addEventListener('reorder', event => {
        const ids = event.detail[0];
        if (ids.length !== profile.taskOccurrences.length || new Set(ids).size !== ids.length
          || ids.some(id => !profile.taskOccurrences.some(item => item.occurrenceId === id))) return;
        profile.taskOccurrences = ids.map((id, order) => ({ ...profile.taskOccurrences.find(item => item.occurrenceId === id), order }));
        draftVersion += 1; preview = null; publishDraft(); draw();
      }, { signal: abort.signal });
      profile.taskOccurrences.forEach(occurrence => {
        const name = occurrence.piTaskName;
        const row = document.createElement('div'); row.dataset.dndId = occurrence.occurrenceId;
        row.style.cssText = 'display:flex;align-items:center;gap:var(--nx-space-2);padding:var(--nx-space-3);border-bottom:1px solid var(--nx-color-border);min-width:0';
        const handle = document.createElement('nxp-drag-handle');
        handle.label = text('调整任务顺序：', 'Reorder task: ') + name;
        const label = document.createElement('span'); label.textContent = name; label.style.overflowWrap = 'anywhere';
        const enabled = document.createElement('nxp-switch'); enabled.modelValue = occurrence.enabled; enabled.ariaLabel = name;
        enabled.addEventListener('update:modelValue', event => { occurrence.enabled = event.detail[0]; draftVersion++; preview = null; publishDraft(); }, { signal: abort.signal });
        const remove = document.createElement('nxp-button'); remove.textContent = text('移除', 'Remove');
        remove.addEventListener('click', () => {
          profile.taskOccurrences = profile.taskOccurrences.filter(item => item !== occurrence).map((item, order) => ({ ...item, order }));
          draftVersion++; preview = null; publishDraft(); draw();
        }, { signal: abort.signal });
        row.append(handle, enabled, label, remove); ordered.append(row);
        field(name + text(' · 重复次数', ' · Repetitions'), 'nxp-text-input', String(occurrence.repeatCount), value => {
          const count = Number(value); if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error(text('次数须为 1–100', 'Count must be 1–100'));
          occurrence.repeatCount = count;
        });
        field(name + ' · ' + occurrence.occurrenceId + text(' · 选项', ' · Options'), 'nxp-text-area', JSON.stringify(occurrence.options, null, 2), value => {
          const parsed = JSON.parse(value);
          if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(text('选项须为 JSON 对象', 'Options must be a JSON object'));
          occurrence.options = parsed;
        });
      });
      const controller = schema.controller.find(item => item.name === profile.controller);
      if (controller?.type === 'Win32') {
        field(text('运行时窗口选择', 'Runtime window selection'), 'nxp-select', profile.windowSelection || 'exact_process', v => {
          profile.windowSelection = v;
        }, { options: [
          { value: 'executable', label: text('每次按完整路径和项目窗口规则重新发现', 'Rediscover by full path and project window filters each run') },
          { value: 'exact_process', label: text('只使用已选进程生命期', 'Use the selected process lifetime only') },
        ] });
        field(text('窗口等待上限（毫秒）', 'Window wait limit (milliseconds)'), 'nxp-text-input', String(profile.windowWaitMilliseconds || 10000), v => {
          const value = Number(v); if (!Number.isInteger(value) || value < 1 || value > 30000) throw new Error(text('等待上限须为 1–30000 毫秒', 'Wait limit must be 1–30000 milliseconds'));
          profile.windowWaitMilliseconds = value;
        });
        field(text('窗口进程完整路径（运行时复核身份）', 'Window executable path (identity checked at runtime)'), 'nxp-text-input', profile.windowExecutable, v => profile.windowExecutable = v);
      } else if (controller?.type === 'Adb') {
        field('ADB.exe', 'nxp-text-input', profile.adbPath, v => profile.adbPath = v);
        field(text('精确 ADB serial/address', 'Exact ADB serial/address'), 'nxp-text-input', profile.adbSerial, v => profile.adbSerial = v);
      }
      const activeOptions = new Set();
      function visit(keys) {
        for (const key of keys || []) {
          const definition = schema.option?.[key];
          if (!definition || activeOptions.has(key) || !applicable(definition)) continue;
          activeOptions.add(key);
          const chosen = profile.options[key] ?? definition.default_case ?? definition.cases?.[0]?.name;
          const names = Array.isArray(chosen) ? chosen : [chosen];
          for (const choice of definition.cases || []) if (names.includes(choice.name)) visit(choice.option);
        }
      }
      visit(schema.global_option); visit(controller?.option);
      visit(schema.resource.find(item => item.name === profile.resource)?.option);
      for (const task of schema.task || []) if (profile.taskOccurrences.some(item => item.enabled && item.piTaskName === task.name) && applicable(task)) visit(task.option);
      for (const task of [].concat(schema.pretask || [])) if (applicable(task)) visit(task.option);
      for (const setting of schema.setting || []) {
        visit(setting.option);
        const label = document.createElement('p'); label.textContent = (setting.label || setting.name) + ': '
          + (setting.option || []).map(key => schema.option?.[key]?.label || key).join(', '); fields.append(label);
      }
      for (const [key, definition] of Object.entries(schema.option || {})) {
        if (!activeOptions.has(key)) continue;
        if (definition.controller?.length && !definition.controller.includes(profile.controller)) continue;
        if (definition.resource?.length && !definition.resource.includes(profile.resource)) continue;
        const type = definition.type || 'select';
        if (['select', 'switch', 'checkbox'].includes(type))
          field(definition.label || key, 'nxp-select', profile.options[key] ?? definition.default_case ?? (type === 'checkbox' ? [] : definition.cases?.[0]?.name || ''),
            v => { profile.options[key] = v; draw(); }, { multiple: type === 'checkbox', options: options(definition.cases) });
        else if (['input', 'hotkey'].includes(type)) {
          for (const input of definition.inputs || definition.hotkeys || []) {
            profile.options[key] ||= {};
            if (input.password) {
              let pending = '';
              field((definition.label || key) + ' / ' + input.name, 'nxp-text-input', '', v => pending = v,
                { type: 'password', placeholder: profile.options[key][input.name] ? text('已配置', 'Configured') : '' });
              const save = document.createElement('nxp-button'); save.textContent = text('存入受保护密钥', 'Store protected secret');
              save.addEventListener('click', async () => {
                try { const result = await call('secret', { name: key.replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + input.name.replace(/[^a-zA-Z0-9_-]/g, '_'), value: pending });
                  profile.options[key][input.name] = result.reference; pending = ''; preview = null; draw(); } catch (error) { fail(error); }
              }, { signal: abort.signal }); fields.append(save);
            } else field((definition.label || key) + ' / ' + input.name, 'nxp-text-input', profile.options[key][input.name] ?? input.default ?? '', v => profile.options[key][input.name] = v);
          }
        }
      }
      for (const [key, zh, en] of [
        ['resourceOptions', '资源层选项覆盖（JSON）', 'Resource option overrides (JSON)'],
        ['controllerOptions', '控制器层选项覆盖（JSON）', 'Controller option overrides (JSON)'],
      ]) field(text(zh, en), 'nxp-text-area', JSON.stringify(profile[key] || {}, null, 2), v => {
        const values = JSON.parse(v);
        if (!values || Array.isArray(values) || typeof values !== 'object') throw new Error(text('选项须为 JSON 对象', 'Options must be a JSON object'));
        profile[key] = values;
      });
    }
    async function call(route, body = {}) {
      const result = await host.api.post(route, { scriptId: context.primaryId || '', profileId: profile.profileId,
        userId, userRevision: context.userConfigRevision || '',
        expectedRevision: profile.revision || '', revision: context.executionProviderConfigRevision || '', profile, ...body }, abort.signal);
      if (disposed) throw new DOMException('Renderer disposed', 'AbortError');
      return result;
    }
    function requireCurrent(version) {
      if (disposed) throw new DOMException('Renderer disposed', 'AbortError');
      if (draftVersion !== version) throw new Error(text('草稿已变化，请重新执行此操作。', 'The draft changed; repeat this action.'));
    }
    function requireValidDraft() {
      if (validationErrors.size) throw new Error([...validationErrors.values()].join('\n'));
    }
    function selectedImport() { return JSON.stringify([importPath, importKind, importInstance, importMode]); }
    button(text('读取项目', 'Inspect project'), async () => {
      const version = draftVersion;
      const result = await host.api.post('inspect', { packageRoot: profile.packageRoot, interfacePath: profile.interfacePath, language: profile.language }, abort.signal);
      requireCurrent(version); schema = result;
      notify(schema.projectName + ' / ' + schema.projectVersion); draw();
    });
    button(text('只读执行预览', 'Read-only execution preview'), async () => {
      requireValidDraft();
      const version = draftVersion;
      const result = await call('preview'); requireCurrent(version); preview = result;
      details.textContent = JSON.stringify(preview, null, 2);
      previewProfile = JSON.stringify(profile);
      notify(text('执行预览已生成，请核对下方内容。', 'Execution preview generated; review the details below.'));
    });
    button(text('应用所选预设到草稿', 'Apply selected preset to draft'), async () => {
      requireValidDraft(); const version = draftVersion;
      const result = await call('preset', { presetName }); requireCurrent(version);
      profile = result; draftVersion += 1; preview = null; draw();
      notify(text('所选预设已应用到草稿。', 'Selected preset applied to the draft.'));
    });
    button(text('载入项目默认勾选任务', 'Load project default task selection'), () => {
      if (!schema) throw new Error(text('请先读取项目。', 'Inspect the project first.'));
      profile.taskOccurrences = (schema.task || []).filter(item => item.default_check
        && (!item.controller || item.controller.includes(profile.controller))
        && (!item.resource || item.resource.includes(profile.resource))).map((item, order) => ({
          occurrenceId: crypto.randomUUID().replaceAll('-', ''), sourceTaskId: '', piTaskName: item.name,
          order, enabled: true, repeatCount: 1, options: {}, pipelineOverride: {} }));
      draftVersion += 1; preview = null; draw();
      notify(text('项目默认勾选任务已载入。', 'Project default task selection loaded.'));
    });
    button(text('查找并选择 Win32 窗口', 'Find and select Win32 window'), async () => {
      const version = draftVersion;
      const result = await call('windows'); requireCurrent(version); details.textContent = '';
      const choose = document.createElement('nxp-select'); choose.ariaLabel = text('匹配的窗口', 'Matching windows');
      choose.options = result.windows.map(item => ({ value: String(item.handle), label: item.title + ' / PID ' + item.pid }));
      choose.addEventListener('update:modelValue', event => {
        choose.modelValue = event.detail[0]; const target = result.windows.find(item => String(item.handle) === choose.modelValue);
        if (!target) return; profile.windowHandle = target.handle; profile.windowProcessId = target.pid; profile.windowExecutable = target.executable; profile.windowStartedAtUtc = target.startedAtUtc;
        profile.schemaVersion = 3; profile.windowSelection = 'executable';
        draftVersion += 1; preview = null; draw();
      }, { signal: abort.signal }); details.append(choose);
      notify(result.windows.length ? text('请选择下方匹配的窗口。', 'Select a matching window below.')
        : text('未找到匹配的窗口。', 'No matching windows found.'));
    });
    button(text('预览显式导入', 'Preview explicit import'), async () => {
      const version = draftVersion;
      const result = await call('import', { sourceKind: importKind, sourcePath: importPath, instanceId: importInstance });
      requireCurrent(version);
      details.textContent = JSON.stringify(result, null, 2);
      if (!result.profile) { notify(text('请选择列表中的源实例精确 ID 后重新预览。', 'Select an exact source instance ID from this list and preview again.')); return; }
      pendingImport = result; importSelection = selectedImport();
      notify(text('请核对映射，再点击“使用已预览映射”。', 'Review the mapping, then choose “Use reviewed mapping”.'));
    });
    button(text('使用已预览映射', 'Use reviewed mapping'), async () => {
      if (!pendingImport || importSelection !== selectedImport())
        throw new Error(text('导入选择已变化，请重新预览。', 'The import selection changed; preview it again.'));
      if (!await confirm(text('确认将此映射载入独立草稿？源配置不会写入。保存前仍须预览和授权。', 'Load this mapping into the independent draft? The source stays unchanged. Preview and authorization are still required before saving.'))) return;
      draftVersion += 1; profile = pendingImport.profile; pendingImport = null; preview = null; validationErrors.clear();
      if (!userId && importMode === 'new') { profile.profileId = crypto.randomUUID().replaceAll('-', ''); profile.revision = ''; }
      draw(); notify(text('映射已载入草稿；请补齐窗口/ADB 参数并预览。', 'Mapping loaded into draft; complete the window/ADB target and preview.'));
    });
    button(text('保存用户配置', 'Save user configuration'), async () => {
      requireValidDraft();
      if (!userId) { publishDraft(); notify(text('请使用宿主的“保存”完成初始化和配置提交。', 'Use Save in the host to initialize and commit this configuration.')); return; }
      if (!preview || previewProfile !== JSON.stringify(profile))
        throw new Error(text('请先生成并核对当前配置的只读执行预览。', 'Generate and review the current read-only execution preview first.'));
      const hostLaunch = profile.hostLaunchRequired && !userId ? profile.hostLaunchConfiguration : null;
      const warning = text('Agent / pretask 是项目代码，进程隔离不是文件沙箱，可能访问网络或写项目根目录。请核对预览后确认授权。', 'Agent / pretask execute project code. Process isolation is not a filesystem sandbox; code may access the network or write the project root. Review this plan and confirm authorization.')
        + (hostLaunch ? '\n' + text('同时明确应用到 Host 游戏启动设置：', 'Also explicitly apply to Host game launch settings:') + '\n' + JSON.stringify(hostLaunch, null, 2) : '');
      if (!await confirm(warning)) return;
      element.dispatchEvent(new CustomEvent('nxp-provider-user-save', { bubbles: true, detail: {
        expectedUserRevision: context.userConfigRevision || '',
        configuration: { profile: structuredClone(profile), sourceId: selectedSource }
      } }));
    });
    if (!userId) {
      actions.replaceChildren();
      details.hidden = true;
      button(text('高级设置', 'Advanced settings'), () => { advanced = !advanced; draw(); });
      button(text('重新查找来源', 'Refresh source configurations'), () => discover());
    }
    async function discover() {
      if (!profile.packageRoot) return;
      const version = draftVersion;
      const result = await host.api.post('discover', { packageRoot: profile.packageRoot,
        interfacePath: explicitInterface || (advanced ? profile.interfacePath : profile.sourceBinding?.interfaceRelativePath || '') }, abort.signal);
      requireCurrent(version); discovered = result; schema = result.schema;
      if (result.interfacePath) profile.interfacePath = result.interfacePath;
      const binding = profile.sourceBinding;
      const selected = binding ? result.candidates.find(item => item.kind === binding.sourceKind && item.instanceId === binding.sourceInstanceId)
        : result.candidates.length === 1 ? result.candidates[0] : null;
      selectedSource = selected?.id || '';
      draw(); publishDraft();
    }
    draw();
    const loadingVersion = draftVersion;
    if (context.executionProviderConfigId) call('profile').then(async saved => {
      if (disposed || draftVersion !== loadingVersion) return;
      if (saved) {
        profile = saved;
        if (profile.packageRoot.toLowerCase() !== String(context.packageRoot || '').toLowerCase()) {
          profile = { ...profile, packageRoot: context.packageRoot || '', sourceBinding: null, sourceSnapshot: null,
            nativeDirectory: '', nativeVersion: '', dependencyLock: null, runtimeInputs: null, windowHandle: 0, windowProcessId: 0,
            windowExecutable: '', windowStartedAtUtc: null, authorizedFingerprint: '' };
        }
        draw();
      }
      if (!userId) await discover();
    }).catch(fail);
    else if (!userId) discover().catch(fail);
    const cleanup = () => { disposed = true; pendingConfirmation?.(false); abort.abort(); card.remove(); active.delete(cleanup); };
    active.add(cleanup);
    return cleanup;
  };
  const registrations = ['scripts.editor.sections', 'users.binding.sections'].map(slot => host.slots.register(slot, render));
  return { dispose() { [...active].forEach(cleanup => cleanup()); registrations.forEach(item => item.dispose()); } };
}
