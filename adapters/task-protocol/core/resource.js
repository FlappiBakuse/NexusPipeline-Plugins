function resource(id) {
  if (!Object.prototype.hasOwnProperty.call(resourceCache, id)) {
    const r = nexus.readResource(id);
    if (r.readOutcome === 'integrity_mismatch') throw new Error('integrity_mismatch');
    if (r.readOutcome === 'opaque') throw new Error('unsupported_schema');
    try { resourceCache[id] = r.format === 'text' ? jsonc(r.document) : r.document; }
    catch (error) { if (error instanceof SyntaxError) throw new Error('unsupported_schema'); throw error; }
  }
  return resourceCache[id];
}
