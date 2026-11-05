'use strict';

function maaendOptionValue(config, row, key, values = row.saved.optionValues ?? {}) {
  const definition = config.options[key];
  if (!definition) return null;
  const saved = values[key], cases = definition.cases ?? [];
  if (definition.type === 'switch') {
    const active = saved?.type === 'switch' && typeof saved.value === 'boolean' ? saved.value :
      definition.default_case === 'Yes' || definition.default_case === cases[0]?.name;
    const accepted = active ? ['Yes', 'yes', 'Y', 'y'] : ['No', 'no', 'N', 'n'];
    return cases.find(item => accepted.includes(item.name)) || null;
  }
  if (!definition.type || definition.type === 'select') {
    const name = saved?.type === 'select' && cases.some(item => item.name === saved.caseName)
      ? saved.caseName : definition.default_case || cases[0]?.name;
    return cases.find(item => item.name === name) || null;
  }
  return null;
}

function maaendReachableOptions(config, row, values = row.saved.optionValues ?? {}) {
  const reachable = [], visiting = new Set();
  function visit(key, depth) {
    if (depth > 32 || visiting.has(key)) throw new Error('maaend_option_dependency_cycle');
    if (reachable.includes(key)) return;
    const definition = config.options[key];
    if (!definition) throw new Error('maaend_option_definition_missing:' + key);
    if (definition.type !== undefined && !['select', 'switch', 'checkbox', 'input', 'hotkey'].includes(definition.type))
      throw new Error('maaend_option_type_unsupported');
    if (definition.controller?.length && !definition.controller.includes(config.controller.name) ||
        definition.resource?.length && !definition.resource.includes(config.resource.name)) return;
    visiting.add(key); reachable.push(key);
    let cases = [];
    if (definition.type === 'checkbox') {
      const saved = values[key], names = saved?.type === 'checkbox' ? saved.caseNames : definition.default_case ?? [];
      if (!Array.isArray(names) || names.some(name => typeof name !== 'string')) throw new Error('maaend_checkbox_value_invalid');
      cases = (definition.cases ?? []).filter(item => names.includes(item.name));
    } else {
      const active = maaendOptionValue(config, row, key, values);
      if (active) cases = [active];
    }
    for (const selected of cases) for (const child of selected.option ?? []) visit(child, depth + 1);
    visiting.delete(key);
  }
  for (const key of row.definition?.option ?? []) visit(key, 0);
  return reachable;
}

function maaendValidOption(config, key, value) {
  const definition = config.options[key];
  if (!definition || !maaendObject(value)) return false;
  if (definition.type === 'switch') return value.type === 'switch' && typeof value.value === 'boolean';
  if (!definition.type || definition.type === 'select')
    return value.type === 'select' && definition.cases?.some(item => item.name === value.caseName);
  if (definition.type === 'checkbox') {
    const names = value.caseNames;
    return value.type === 'checkbox' && Array.isArray(names) && new Set(names).size === names.length &&
      names.every(name => definition.cases?.some(item => item.name === name)) &&
      (definition.min_count === undefined || names.length >= definition.min_count) &&
      (definition.max_count === undefined || names.length <= definition.max_count);
  }
  if (['input', 'hotkey'].includes(definition.type)) {
    const fields = definition.inputs ?? definition.hotkeys ?? [];
    return value.type === definition.type && maaendObject(value.values) && Object.keys(value.values).every(name => fields.some(item => item.name === name)) &&
      fields.every(field => typeof value.values[field.name] === 'string' && value.values[field.name].length <= 4096 &&
        maaendInputConstraint(key, field, value.values[field.name]));
  }
  return false;
}

function maaendInputConstraint(option, field, value) {
  if (!field.verify) return true;
  if (option === 'LaunchGamePCLauncherExe' && field.name === 'LauncherExe')
    return /^"?.+[\\/][Ll]auncher\.exe"?$/.test(value);
  if (field.verify === '^\\d+$') return /^\d+$/.test(value);
  if (field.verify === '^[1-9]\\d*$') return /^[1-9]\d*$/.test(value);
  if (field.verify === '^\\d+(\\.\\d+)?$') return /^\d+(\.\d+)?$/.test(value);
  return false;
}

function maaendOptionEdits(config, row, value) {
  if (!maaendObject(value)) return false;
  const previous = row.saved.optionValues ?? {}, reachable = maaendReachableOptions(config, row, value);
  const keys = new Set([...Object.keys(previous), ...Object.keys(value)]);
  for (const key of keys) {
    if (JSON.stringify(previous[key]) === JSON.stringify(value[key])) continue;
    if (!reachable.includes(key) || !maaendValidOption(config, key, value[key])) return false;
  }
  return true;
}
