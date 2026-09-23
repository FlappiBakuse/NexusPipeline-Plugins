function behavior(plan, config, keys, prefix) {
  for (const key of keys) if (Object.prototype.hasOwnProperty.call(config.document, key))
    plan.behaviorFields.push({ resourceId: config.id, selector: (prefix || []).concat(key) });
}
