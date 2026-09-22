function instanceTemplate() {
  if (resourceCache.m7InstanceTemplate) return resourceCache.m7InstanceTemplate;
  const d = nexus.readConfig('config:config.yaml').document;
  const configured = d.notify_template && Object.prototype.hasOwnProperty.call(d.notify_template, 'InstanceNotCompleted');
  const template = configured ? d.notify_template.InstanceNotCompleted : '清体力未完成 {error}';
  const reasons = ['指定副本未解锁', '未找到指定副本', '传送可能失败', '无法开始挑战'];
  // Match literal output of Python's documented {error} format, never a user-supplied regex.
  function format(reason) {
    if (typeof template !== 'string' || template.length > 2048) return null;
    let out = '', substituted = false;
    for (let i = 0; i < template.length;) {
      if (template.slice(i, i + 2) === '{{') { out += '{'; i += 2; }
      else if (template.slice(i, i + 2) === '}}') { out += '}'; i += 2; }
      else if (template.slice(i, i + 7) === '{error}') { out += reason; substituted = true; i += 7; }
      else if (template[i] === '{' || template[i] === '}') return null;
      else out += template[i++];
    }
    const lines = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    return substituted && lines.length > 0 && lines.length <= 4 ? lines : null;
  }
  const patterns = reasons.map(reason => ({ reason, lines: format(reason) }));
  const valid = patterns.every(p => p.lines) && new Set(patterns.map(p => JSON.stringify(p.lines))).size === 4;
  resourceCache.m7InstanceTemplate = valid ? patterns : [];
  return resourceCache.m7InstanceTemplate;
}
