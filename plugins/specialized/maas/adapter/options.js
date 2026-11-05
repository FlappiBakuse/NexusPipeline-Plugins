'use strict';

function maasOptionList(value) {
  const list = maasArray(value);
  if (!Array.isArray(list)) throw new Error('maas_option_list_invalid');
  return list.map(item => typeof item === 'string' ? { name: item, index: 0 } : item);
}

function maasInputValue(field, value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  if (field.pipeline_type === 'int' && (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) return false;
  if (field.pipeline_type === 'float' && (!/^-?\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value)))) return false;
  if (!field.verify) return true;
  if (field.verify === '^[1-9]\\d*$') return /^[1-9]\d*$/.test(value);
  if (['^\\d+$', '^[0-9]+$'].includes(field.verify)) return /^\d+$/.test(value);
  if (field.verify === '\\d+') return /\d+/.test(value);
  if (field.verify === '^(0|[1-9])(\\.\\d{1,2})?$') return /^(0|[1-9])(\.\d{1,2})?$/.test(value);
  if (field.verify === '^(0(\\.\\d{1,2})?|1(\\.0{1,2})?)$') return /^(0(\.\d{1,2})?|1(\.0{1,2})?)$/.test(value);
  if (field.verify === '^\\d{1,2}$') return /^\d{1,2}$/.test(value);
  return false;
}

function maasOptionChanges(config, oldValue, newValue, allowed, ancestors = []) {
  const before = maasOptionList(oldValue), after = maasOptionList(newValue);
  if (before.length > after.length || after.some(item => !maasObject(item)) || new Set(after.map(item => item.name)).size !== after.length ||
      before.some((item, index) => !maasObject(item) || item.name !== after[index].name)) return false;
  for (let i = 0; i < after.length; i++) {
    const item = after[i], previous = before[i] ?? { name: item.name };
    if (JSON.stringify(previous) === JSON.stringify(item)) continue;
    if (!allowed.includes(item.name) || ancestors.includes(item.name)) return false;
    const definition = config.options[item.name];
    if (!definition || maasArray(definition.controller).length && !maasArray(definition.controller).includes(config.controller.name) ||
        maasArray(definition.resource).length && !maasArray(definition.resource).includes(config.resource.name)) return false;
    const type = definition.type?.toLowerCase() ?? 'select', fields = ['index', 'selected_cases', 'data', 'sub_options'];
    if (Object.keys({ ...previous, ...item }).some(key => !fields.includes(key) && JSON.stringify(previous[key]) !== JSON.stringify(item[key]))) return false;
    const cases = definition.cases ?? [], chosen = [];
    if (['select', 'switch'].includes(type)) {
      const index = item.index ?? Math.max(0, cases.findIndex(row => row.name === definition.default_case));
      if (!Number.isInteger(index) || index < 0 || index >= cases.length) return false;
      chosen.push(cases[index]);
      if (JSON.stringify(previous.selected_cases) !== JSON.stringify(item.selected_cases) || JSON.stringify(previous.data) !== JSON.stringify(item.data)) return false;
    } else if (type === 'checkbox') {
      const selected = maasArray(item.selected_cases ?? definition.default_cases);
      if (!Array.isArray(selected) || new Set(selected).size !== selected.length || selected.some(name => !cases.some(row => row.name === name))) return false;
      chosen.push(...cases.filter(row => selected.includes(row.name)));
      if (JSON.stringify(previous.index) !== JSON.stringify(item.index) || JSON.stringify(previous.data) !== JSON.stringify(item.data)) return false;
    } else if (['input', 'hotkey'].includes(type)) {
      if (!maasObject(item.data) || JSON.stringify(previous.index) !== JSON.stringify(item.index) ||
          JSON.stringify(previous.selected_cases) !== JSON.stringify(item.selected_cases)) return false;
      const inputs = type === 'input' ? definition.inputs ?? [] : definition.hotkeys ?? [];
      for (const key of Object.keys({ ...previous.data, ...item.data })) {
        if (JSON.stringify(previous.data?.[key]) === JSON.stringify(item.data[key])) continue;
        const field = inputs.find(row => row.name === key);
        if (!field || !maasInputValue(field, item.data[key])) return false;
      }
    } else return false;
    const reachable = chosen.flatMap(row => maasArray(row.option));
    if (!maasOptionChanges(config, previous.sub_options, item.sub_options, reachable, [...ancestors, item.name])) return false;
  }
  return true;
}
