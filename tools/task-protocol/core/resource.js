function resource(id) {
  if (!Object.prototype.hasOwnProperty.call(resourceCache, id)) {
    const r = nexus.readResource(id); resourceCache[id] = r.format === 'text' ? jsonc(r.document) : r.document;
  }
  return resourceCache[id];
}
