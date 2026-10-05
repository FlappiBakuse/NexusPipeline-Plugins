function configOne(predicate) {
  const found = input.configResources.filter(predicate || (() => true)); requireValue(found.length === 1);
  return { id: found[0].id, ...nexus.readConfig(found[0].id) };
}
