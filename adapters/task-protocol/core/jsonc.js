function jsonc(text) {
  // Native token matching avoids a per-character Jint statement cost on full MXU interfaces.
  // Quoted strings are consumed first, preserving URL/comment-like and comma-like string content.
  try { return JSON.parse(text); } catch { /* upstream interfaces also allow JSONC */ }
  const stripped = text.replace(/"(?:\\.|[^"\\])*"|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g,
    token => token[0] === '"' ? token : ' ');
  return JSON.parse(stripped.replace(/"(?:\\.|[^"\\])*"|,\s*(?=[}\]])/g,
    token => token[0] === '"' ? token : ''));
}
