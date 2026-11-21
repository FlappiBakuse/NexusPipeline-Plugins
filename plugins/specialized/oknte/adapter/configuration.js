'use strict';

function oknteChildOption(id, key, value) {
  const finite = (minimum, maximum) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;
  if (['daily_anomaly', 'daily_anomaly_hunter'].includes(id) && key === '目标消耗体力') return finite(0, 100000);
  if (id === 'daily_anomaly') {
    const choices = { 任务类型: ['经验与甲硬币', '异能升级材料', '弧盘突破材料', '空幕'], 具体奖励目标: ['角色经验', '弧盘经验', '甲硬币'],
      循环模式: ['停用', '自动循环序号/目标', '自定义循环'] };
    if (choices[key]) return choices[key].includes(value);
    if (['异能材料序号', '弧盘材料序号', '空幕序号'].includes(key)) return finite(1, key === '空幕序号' ? 6 : 5);
    if (key === '循环序列') {
      const allowed = ['角色经验', '弧盘经验', '甲硬币'];
      for (const [name, max] of [['异能升级材料', 5], ['弧盘突破材料', 5], ['空幕', 6]])
        for (let number = 1; number <= max; number++) allowed.push(name + ': ' + number);
      return Array.isArray(value) && value.length <= allowed.length && new Set(value).size === value.length && value.every(item => allowed.includes(item));
    }
  }
  if (id === 'daily_anomaly_hunter' && key === '追猎目标') return ['音霸魔王', '无首铁驭', '塞润尼缇', '黑之书', '海囚', '围巢鸟', '斑蝶'].includes(value);
  if (id === 'daily_claim' && ['邮件', '活跃度奖励', '环期任务奖励'].includes(key) || id === 'furniture' && key === '挑战玛门') return typeof value === 'boolean';
  if (id === 'cinema_date' && key === '约会目标') return typeof value === 'string' && value.length <= 256;
  if (id === 'fountain' && key === '签到方式') return ['签到', '捞币'].includes(value);
  if (id === 'coffee') {
    if (['领取收益', '补货货物', '购买货物送货上门', '优化商品'].includes(key)) return typeof value === 'boolean';
    if (key === '模式') return value === '领取/补货';
    if (key === '商品位数量') return ['auto', '1', '2', '3', '4', '5'].includes(value);
    if (key === '价格表') return ['auto', 'disabled'].includes(value);
    if (key === '补货时长') return ['auto', '2小时', '4小时', '8小时', '24小时'].includes(value);
  }
  return false;
}

function oknteResolve(value, selector) {
  for (const step of selector) {
    if (typeof step === 'string' || Number.isInteger(step)) {
      if (value === null || value === undefined || !oknteOwn(value, step)) throw new Error('oknte_selector_missing');
      value = value[step];
    } else if (Array.isArray(value) && oknteObject(step?.match)) {
      const matches = value.filter(item => item?.[step.match.property] === step.match.value);
      if (matches.length !== 1) throw new Error('oknte_selector_ambiguous');
      value = matches[0];
    } else throw new Error('oknte_selector_invalid');
  }
  return value;
}

function oknteAllowed(config, resourceId, selector, value) {
  if (!Array.isArray(selector)) return false;
  if (resourceId === 'devices') return selector.length === 1 && selector[0] === 'pc_full_path' && typeof value === 'string' && !!value.trim() && value.length <= 4096;
  if (resourceId === 'routine-configs') return selector.length === 2 && OKNTE_ITEMS.some(item => item.id === selector[0]) && oknteChildOption(selector[0], selector[1], value);
  if (resourceId !== 'main') return false;
  if (selector.length === 1 && selector[0] === '存在失败时发送 BOT 通知') return typeof value === 'boolean';
  if (selector.length === 3 && selector[0] === 'Routine Items' && selector[2] === 'enabled')
    return config.complete && typeof value === 'boolean' && selector[1]?.match?.property === 'id' && OKNTE_ITEMS.some(item => item.id === selector[1].match.value);
  if (selector.length === 1 && selector[0] === 'Routine Items' && config.complete && Array.isArray(value) && value.length === config.document['Routine Items'].length) {
    const remaining = config.document['Routine Items'].map(item => JSON.stringify(item));
    for (const item of value) { const index = remaining.indexOf(JSON.stringify(item)); if (index < 0) return false; remaining.splice(index, 1); }
    return true;
  }
  return false;
}

function oknteIntents(input, config) {
  const patches = input.configurationIntents ?? [], resources = new Set();
  if (!Array.isArray(patches) || patches.length > 3) throw new Error('oknte_configuration_intent_identity');
  for (const patch of patches) {
    const resource = input.resources.find(item => item.resourceId === patch.resourceId), seen = [];
    if (!resource || resources.has(resource.resourceId) || patch.format !== 'nexus.config.patch' || patch.version !== 1 || patch.operationId !== input.operationId ||
        !Number.isSafeInteger(resource.revision) || resource.revision < 1 || patch.expectedRevision !== resource.revision || patch.sourceSha256 !== resource.sha256 ||
        !Array.isArray(patch.edits) || !patch.edits.length || patch.edits.length > 256) throw new Error('oknte_configuration_intent_unbound');
    resources.add(resource.resourceId);
    const document = JSON.parse(JSON.stringify(config.documents[resource.resourceId]));
    for (const edit of patch.edits) {
      if (!oknteAllowed(config, resource.resourceId, edit.selector, edit.value) || seen.some(selector =>
        selector.length <= edit.selector.length && selector.every((part, index) => JSON.stringify(part) === JSON.stringify(edit.selector[index])) ||
        edit.selector.length <= selector.length && edit.selector.every((part, index) => JSON.stringify(part) === JSON.stringify(selector[index]))))
        throw new Error('oknte_configuration_edit_not_supported');
      if (JSON.stringify(oknteResolve(document, edit.selector)) !== JSON.stringify(edit.expected)) throw new Error('oknte_configuration_edit_conflict');
      const parent = oknteResolve(document, edit.selector.slice(0, -1)); parent[edit.selector.at(-1)] = edit.value; seen.push(edit.selector);
    }
    if (patch.resourceId === 'main' && patch.edits.some(edit => edit.selector[0] === 'Routine Items') &&
        document['Routine Items'].filter(item => ['daily_anomaly', 'daily_anomaly_hunter'].includes(item?.id) && item.enabled === true).length > 1)
      throw new Error('oknte_exclusive_group_requires_explicit_other_disable');
  }
  return patches;
}

function oknteConfiguration(input, config) {
  const diagnostics = [], add = (code, severity = 'blocking') => diagnostics.push({ code, resourceId: 'main', severity });
  if (!config.complete) add('oknte_complete_explicit_selection_required_for_retry', 'warning');
  if (config.rows.some(row => !row.known && row.enabled)) add('oknte_unknown_enabled_routine_item_preserved', 'warning');
  if (!config.documents['routine-configs']) add('oknte_dedicated_routine_config_defaults_used', 'warning');
  if (config.documents.devices && (typeof config.documents.devices.pc_full_path !== 'string' || !config.documents.devices.pc_full_path.trim()))
    diagnostics.push({ code: 'oknte_game_target_path_required', resourceId: 'devices', severity: 'blocking' });
  return { diagnostics, configPatches: oknteIntents(input, config) };
}
