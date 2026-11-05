'use strict';

function strictConfigurationJson(text, prefix) {
  if (typeof prefix !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(prefix)) throw new Error('adapter_json_prefix_invalid');
  if (typeof text !== 'string' || text.length > 262144) throw new Error(prefix + '_configuration_size_invalid');
  let position = 0;
  const spacing = /\s*/y, primitiveText = /[^\s,}\]]*/y;
  function whitespace() { spacing.lastIndex = position; spacing.exec(text); position = spacing.lastIndex; }
  function string() {
    const start = position++;
    while (position < text.length) {
      const quote = text.indexOf('"', position);
      if (quote < 0) break;
      let escaped = 0;
      for (let back = quote - 1; back > start && text[back] === '\\'; back--) escaped++;
      position = quote + 1;
      if (escaped % 2 === 0) return JSON.parse(text.slice(start, position));
    }
    throw new Error(prefix + '_configuration_string_invalid');
  }
  function value(depth) {
    if (depth > 64) throw new Error(prefix + '_configuration_depth_exceeded');
    whitespace();
    const token = text[position];
    if (token === '"') { string(); return; }
    if (token === '{' || token === '[') {
      const object = token === '{', end = object ? '}' : ']';
      const names = new Set();
      position++; whitespace();
      if (text[position] === end) { position++; return; }
      while (position < text.length) {
        if (object) {
          if (text[position] !== '"') throw new Error(prefix + '_configuration_key_invalid');
          const key = string();
          if (names.has(key)) throw new Error(prefix + '_configuration_duplicate_key');
          names.add(key); whitespace();
          if (text[position++] !== ':') throw new Error(prefix + '_configuration_separator_invalid');
        }
        value(depth + 1); whitespace();
        if (text[position] === end) { position++; return; }
        if (text[position++] !== ',') throw new Error(prefix + '_configuration_separator_invalid');
        whitespace();
      }
      throw new Error(prefix + '_configuration_incomplete');
    }
    const start = position;
    primitiveText.lastIndex = position; primitiveText.exec(text); position = primitiveText.lastIndex;
    const primitive = JSON.parse(text.slice(start, position));
    if (typeof primitive === 'number' && !Number.isFinite(primitive)) throw new Error(prefix + '_configuration_number_invalid');
  }
  value(0); whitespace();
  if (position !== text.length) throw new Error(prefix + '_configuration_trailing_bytes');
  const result = JSON.parse(text);
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(prefix + '_configuration_unknown');
  return result;
}
