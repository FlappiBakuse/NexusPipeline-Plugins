// Pure projection of DailyRoutineTask.normalize_items; never writes user configuration.
function normalizeItems(raw, entries) {
  const items = [], seen = new Set(), diagnostics = [];
  const truth = value => Array.isArray(value) ? value.length > 0
    : value !== null && typeof value === 'object' ? Object.keys(value).length > 0 : Boolean(value);
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || Array.isArray(item) || typeof item !== 'object') continue;
    if (typeof item.id !== 'string') {
      diagnostics.push({ code: 'oknte.invalid_id', id: null });
      continue;
    }
    const entry = entries.find(e => e.id === item.id);
    if (!entry) {
      diagnostics.push({ code: 'oknte.unknown_id', id: item.id });
      continue;
    }
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push({ id: item.id, enabled: truth(item.enabled) });
  }
  for (const entry of entries) if (!seen.has(entry.id))
    items.push({ id: entry.id, enabled: entry.enabledByDefault });
  const groups = new Set();
  for (const item of items) {
    const group = entries.find(e => e.id === item.id).exclusiveGroup;
    if (item.enabled && group) {
      if (groups.has(group)) item.enabled = false;
      else groups.add(group);
    }
  }
  // Scalar retry selectors require a complete, unique, explicitly boolean list.
  // Otherwise normalization could re-enable an absent default after the patch.
  const canPatchSelection = Array.isArray(raw) && raw.length === entries.length
    && diagnostics.length === 0 && new Set(raw.map(i => i && i.id)).size === entries.length
    && raw.every(i => i && entries.some(e => e.id === i.id) && typeof i.enabled === 'boolean');
  return { items, diagnostics, canPatchSelection };
}
