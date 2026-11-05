import crypto from 'node:crypto';
import { cases as zzzCases } from './zzzonedragon/cases.mjs';

const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const diagnosticIndices = {
  "oknte_game_target_path_required": 2,
  "okww_game_target_path_required": 1,
  "okww_stamina_option_invalid": 1,
  "zzzonedragon_bound_game_path_required": 1,
  "zzzonedragon_single_instance_global_required": 1,
  "maaend_controller_default_used": 1,
  "maaend_resource_default_used": 1,
  "maaend_other_instance_schedule_ambiguous": 3,
  "maaend_retired_task_not_imported": 1,
  "maaend_task_incompatible": 1,
  "maas_missing_profile_default_used": 1,
  "maas_new_defaults_require_native_materialization": 1,
  "maas_finish_action_requires_host_policy": 2,
  "maas_computer_operation_requires_host_policy": 2
};

function edit(sample, resourceId, change) {
  const resource = sample.resources.find(item => item.resourceId === resourceId);
  const value = JSON.parse(resource.content); change(value);
  resource.content = JSON.stringify(value); resource.sha256 = sha(resource.content);
}
function extra(sample, resourceId, value) {
  const content = JSON.stringify(value);
  sample.resources.push({ resourceId, revision: 1, sourcePath: resourceId + '.json', relativePath: '', content, sha256: sha(content) });
}

function instance(value) { return value.instances.find(row => row.id === 'stable'); }

function launch(sample, manual) {
  const metadata = sample.sourceFiles['interface.json'];
  metadata.pretask = { name: 'LaunchGamePC', exec: 'agent/go-service', args: ['--pretask', 'LaunchGamePC'] };
  if (manual) metadata.option.LaunchGamePCLauncherPath = { type: 'select', default_case: 'Manual', cases: [{ name: 'Manual' }, { name: 'Auto' }] };
  edit(sample, 'main', value => { instance(value).tasks = [{ id: 'launch', taskName: '__MXU_PRETASK__LaunchGamePC', enabled: true,
    optionValues: manual ? { LaunchGamePCLauncherPath: { type: 'select', caseName: 'Manual' },
      LaunchGamePCLauncherExe: { type: 'input', values: { LauncherExe: 'not-a-launcher.exe' } } } : {} }]; });
}

function nativeCases(add, invoke) {
  for (const [key, value, code] of [
    ['ADB_DIRECT_USE_SERIAL_NUMBER', 'serial', 'baah_adb_mode_invalid'],
    ['ADB_DIRECT_USE_SERIAL_NUMBER', true, 'baah_direct_adb_serial_not_endpoint_proof'],
    ['POST_COMMAND', 7, 'baah_post_command_invalid'], ['TARGET_IP_PATH', '', 'baah_target_ip_invalid'],
    ['TARGET_PORT', 0, 'baah_target_port_invalid']])
    add('baah', code, sample => edit(sample, 'main', valueObject => { valueObject[key] = value; }));
  add('baah', 'baah_software_configuration_required', sample => { sample.resources = sample.resources.filter(row => row.resourceId !== 'software-config'); });
  for (const [code, change] of [
    ['march7th_game_path_required', value => { value.game_path = ''; }],
    ['march7th_failure_notification_template_unrecognized', value => { value.notify_template = { InstanceNotCompleted: 'unrecognized {invalid}' }; }],
    ['march7th_default_selection_requires_projection', value => { delete value.daily_enable; }]])
    add('march7th', code, sample => edit(sample, 'main', change));
  add('oknte', 'oknte_complete_explicit_selection_required_for_retry', sample => edit(sample, 'main', value => { value['Routine Items'] = []; }));
  add('oknte', 'oknte_game_target_path_required', sample => extra(sample, 'devices', { pc_full_path: '' }));
  add('okww', 'okww_game_target_path_required', sample => extra(sample, 'devices', { pc_full_path: '' }));
  add('okww', 'okww_stamina_option_invalid', sample => edit(sample, 'main', value => { value['Which Tacet Suppression to Farm'] = 0; }));
  add('okww', 'okww_nightmare_selection_required', sample => {
    edit(sample, 'main', value => { value['Additional Tasks to Run After Daily Task'] = ['Auto Farm all Nightmare Nest']; });
    edit(sample, 'nightmare', value => { value['Which to Farm'] = []; });
  });
  add('okww', 'okww_4c_option_invalid', sample => {
    edit(sample, 'main', value => { value['Additional Tasks to Run After Daily Task'] = ['Teleport and Farm 4C Echo']; });
    edit(sample, 'farm-4c', value => { value['Boss Level'] = 'invalid'; });
  });
  add('zzzonedragon', 'zzzonedragon_bound_game_path_required', sample => edit(sample, 'account:01', value => { value.game_path = ''; }));
  add('zzzonedragon', 'zzzonedragon_single_instance_global_required', sample => { sample.resources = sample.resources.filter(row => row.resourceId !== 'global'); });
  add('zzzonedragon', 'zzzonedragon_legacy_group_read_only', sample => {
    const row = zzzCases(invoke).find(item => item.name === 'legacy projected in native migration order read only');
    sample.resources = structuredClone(row.input.resources);
  });
}

function maaCases(add) {
  for (const [code, change] of [
    ['maaend_controller_default_used', value => { instance(value).controllerName = 'Missing'; }],
    ['maaend_resource_default_used', value => { instance(value).resourceName = 'Missing'; }],
    ['maaend_other_instance_schedule_ambiguous', value => { value.instances.find(row => row.id === 'other').schedulePolicies = [{ enabled: true }]; }],
    ['maaend_power_action_requires_host_policy', value => { instance(value).tasks = [{ id: 'power', taskName: '__MXU_POWER__', enabled: true }]; }],
    ['maaend_retired_task_not_imported', value => { instance(value).tasks = [{ id: 'retired', taskName: 'DevTest', enabled: true }]; }]])
    add('maaend', code, sample => edit(sample, 'main', change));
  add('maaend', 'maaend_task_incompatible', sample => { sample.sourceFiles['interface.json'].task[0].controller = ['OtherController']; });
  add('maaend', 'maaend_manual_launcher_invalid', sample => launch(sample, true));
  add('maaend', 'maaend_launcher_mode_unknown', sample => launch(sample, false));
  add('maas', 'maas_missing_profile_default_used', sample => edit(sample, 'settings', value => { value.DefaultConfig = 'Missing'; }));
  add('maas', 'maas_local_task_items_required', sample => edit(sample, 'main', value => { delete value.TaskItems; }));
  add('maas', 'maas_new_defaults_require_native_materialization', sample => {
    sample.sourceFiles['interface.json'].task.push({ name: 'Future task', entry: 'FutureEntry', default_check: true });
  });
  add('maas', 'maas_finish_action_requires_host_policy', sample => edit(sample, 'main', value => { value.AfterTask = 'Shutdown'; }));
  add('maas', 'maas_computer_operation_requires_host_policy', sample => edit(sample, 'main', value => {
    value.TaskItems.push({ name: 'Computer operation', entry: 'ComputerOperationAction', default_check: true });
  }));
  add('maas', 'maas_controller_unsupported_on_windows', sample => {
    sample.sourceFiles['interface.json'].controller[0].type = 'PlayCover';
  }, 'maas_controller_resource_required');
}

export function configurationDiagnosticCases(extensionId, fixture, invoke) {
  const vectors = [];
  function add(id, code, change, error) {
    if (id !== extensionId) return;
    const sample = structuredClone(fixture);
    change(sample);
    const input = { format: 'nexus.task.adapter', version: 1, direction: 'request', extensionId: id,
      phase: 'configuration', operationId: '009ca3c5-6b90-40e2-a981-53a33ab5c43f', resources: sample.resources };
    vectors.push({ name: code, input, sourceFiles: sample.sourceFiles, expectedDiagnosticCode: code,
      ...(error ? { error } : {}), expect: { ['diagnostics.' + (diagnosticIndices[code] ?? 0) + '.code']: code } });
  }
  nativeCases(add, invoke);
  maaCases(add);
  for (const id of ['maaend', 'maas']) for (const missing of [false, true])
    add(id, id + (missing ? '_declared_import_unavailable' : '_unknown_import_preserved'), sample => {
      sample.sourceFiles['interface.json'].import = [missing ? id === 'maaend' ? 'tasks/OutpostTrading.json' :
        'interface/tasks/common.json' : '../outside.json'];
    });
  return vectors;
}
