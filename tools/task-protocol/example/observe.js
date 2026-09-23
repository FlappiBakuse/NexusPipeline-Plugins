function observe(text, tasks, emit) {
  const match = /^TASK ([A-Za-z0-9_-]+) (START|OK|FAIL)$/.exec(text);
  if (!match) return;
  const found = tasks.filter(t => t.sourceKey === match[1]);
  if (found.length !== 1) return;
  emit(found[0], { START:'running', OK:'succeeded', FAIL:'failed' }[match[2]], 'example.task.' + match[2].toLowerCase());
}
