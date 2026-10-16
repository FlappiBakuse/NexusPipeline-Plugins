function configOne(predicate) {
  const found = input.configResources.filter(predicate || (() => true));
  if (found.length !== 1) throw new Error('binding_identity: configuration target is not unique');
  const resource = nexus.readConfig(found[0].id);
  if (resource.readOutcome === 'opaque') throw new Error('unsupported_schema');
  if (resource.readOutcome === 'integrity_mismatch') throw new Error('integrity_mismatch');
  return { id: found[0].id, ...resource };
}
