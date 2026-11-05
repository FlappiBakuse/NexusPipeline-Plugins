'use strict';

function strictConfigurationJsonc(text, prefix) {
  if (typeof prefix !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(prefix)) throw new Error('adapter_json_prefix_invalid');
  if (typeof text !== 'string' || text.length > 262144) throw new Error(prefix + '_configuration_size_invalid');
  const chars = [...text];
  let quoted = false, escaped = false;
  for (let index = 0; index < chars.length; index++) {
    const character = chars[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') { quoted = true; continue; }
    if (character !== '/' || !['/', '*'].includes(chars[index + 1])) continue;
    const block = chars[index + 1] === '*';
    chars[index] = chars[index + 1] = ' ';
    index += 2;
    let closed = !block;
    while (index < chars.length) {
      if (block && chars[index] === '*' && chars[index + 1] === '/') {
        chars[index] = chars[index + 1] = ' '; index++; closed = true; break;
      }
      if (!block && ['\r', '\n'].includes(chars[index])) { index--; break; }
      if (!['\r', '\n'].includes(chars[index])) chars[index] = ' ';
      index++;
    }
    if (!closed) throw new Error(prefix + '_jsonc_comment_unterminated');
  }
  quoted = false; escaped = false;
  for (let index = 0; index < chars.length; index++) {
    const character = chars[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') { quoted = true; continue; }
    if (character !== ',') continue;
    let next = index + 1;
    while (next < chars.length && /\s/.test(chars[next])) next++;
    let previous = index - 1;
    while (previous >= 0 && /\s/.test(chars[previous])) previous--;
    if (['}', ']'].includes(chars[next]) && !['{', '[', ',', ':'].includes(chars[previous])) chars[index] = ' ';
  }
  return strictConfigurationJson(chars.join(''), prefix);
}
