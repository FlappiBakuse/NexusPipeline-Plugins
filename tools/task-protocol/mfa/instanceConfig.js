function instanceConfig(id) {
  requireValue(typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id));
  const local = configOne(r => r.id === 'config:instances/' + id + '.json');
  const settings = resource('mfa-settings');
  let globalId = settings.DefaultConfig && settings.DefaultConfig !== 'Default'
    ? 'config:mfa_' + settings.DefaultConfig + '.json' : 'config:config.json';
  if (!input.configResources.some(r => r.id === globalId)) globalId = 'config:config.json';
  const global = configOne(r => r.id === globalId);
  requireValue(object(local.document) && object(global.document));
  const document = {...local.document}, origins = {};
  const keys = new Set(Object.keys(global.document).map(key => key.replace(/^Instance\.[^.]+\./, ''))
    .concat(Object.keys(local.document)));
  for (const key of keys) {
    if (document[key] !== undefined && document[key] !== null) {
      origins[key] = {resourceId:local.id, selector:[key]};
      continue;
    }
    const source = ['Instance.' + id + '.' + key, 'Instance.default.' + key, key]
      .find(candidate => global.document[candidate] !== undefined && global.document[candidate] !== null);
    if (source !== undefined) {
      document[key] = global.document[source];
      origins[key] = {resourceId:global.id, selector:[source]};
    }
  }
  return {...local, document, origins};
}
