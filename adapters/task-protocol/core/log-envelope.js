function logEnvelope(line, cursor) {
  const text = clean(line.text);
  const key = line.sourceId + ':' + line.epoch;
  cursor.envelopes ||= {};
  cursor.envelopeSequences ||= {};
  if (line.sequence <= (cursor.envelopeSequences[key] || 0)) return null;
  cursor.envelopeSequences[key] = line.sequence;
  for (const old of Object.keys(cursor.envelopes))
    if (old.startsWith(line.sourceId + ':') && old !== key) { delete cursor.envelopes[old]; delete cursor.envelopeSequences[old]; }
  if (Object.keys(cursor.envelopeSequences).length > 16) throw new Error('resource_limit: log sources');
  const header = text.match(/^\[\d{2}:\d{2}:\d{2}(?:\.\d+)?\]\s*\[(INF|ERR|WRN|DBG|INFO|ERROR|WARNING|DEBUG)\]\s*(?:\[([^\]]+)\]\s*)?(BetterGenshinImpact\.[\w.]+)\s*$/);
  if (header) {
    cursor.envelopes[key] = { level: header[1], context: header[2] || '', logger: header[3], sequence: line.sequence, consumed: false };
    return null;
  }
  const envelope = cursor.envelopes[key];
  if (!envelope || line.sequence <= envelope.sequence || !text) return null;
  const continuation = envelope.consumed;
  envelope.consumed = true;
  return { text, level: envelope.level, logger: envelope.logger, context: envelope.context,
    continuation, sourceId: line.sourceId, epoch: line.epoch, sequence: line.sequence };
}
