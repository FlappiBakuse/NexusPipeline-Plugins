function select(document, selector) {
  let node = document;
  for (const token of selector) {
    if (typeof token === 'string') { requireValue(object(node) && Object.prototype.hasOwnProperty.call(node, token)); node = node[token]; }
    else if (Object.prototype.hasOwnProperty.call(token, 'by')) {
      requireValue(Array.isArray(node)); const found = node.filter(v => object(v) && JSON.stringify(v[token.by]) === JSON.stringify(token.value));
      requireValue(found.length === 1); node = found[0];
    } else {
      requireValue(Array.isArray(node) && object(node[token.index]) && JSON.stringify(node[token.index][token.guardKey]) === JSON.stringify(token.guardValue)); node = node[token.index];
    }
  }
  return node;
}
