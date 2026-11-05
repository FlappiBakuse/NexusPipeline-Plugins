'use strict';

function baahStorageSuffix(filename) {
  // BAAH derives per-account progress storage from the UTF-8 config filename, not its contents.
  const bytes = [];
  for (const part of encodeURIComponent(filename).match(/%[0-9A-F]{2}|./g) || [])
    bytes.push(part.startsWith('%') ? parseInt(part.slice(1), 16) : part.charCodeAt(0));
  const length = bytes.length * 8; bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  bytes.push(0, 0, 0, 0, (length >>> 24) & 255, (length >>> 16) & 255, (length >>> 8) & 255, length & 255);
  const rotate = (value, count) => (value << count) | (value >>> (32 - count));
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = [];
    for (let index = 0; index < 16; index++) {
      const at = offset + index * 4;
      words[index] = (bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3];
    }
    for (let index = 16; index < 80; index++) words[index] = rotate(words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let index = 0; index < 80; index++) {
      const f = index < 20 ? (b & c) | (~b & d) : index < 40 || index >= 60 ? b ^ c ^ d : (b & c) | (b & d) | (c & d);
      const k = index < 20 ? 0x5a827999 : index < 40 ? 0x6ed9eba1 : index < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const next = (rotate(a, 5) + f + e + k + words[index]) | 0;
      e = d; d = c; c = rotate(b, 30); b = a; a = next;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  return (h0 >>> 0).toString(16).padStart(8, '0');
}

globalThis.nexusDiscoverScript = input => sourceResult(input,
  sourceFiles('BAAH_CONFIGS', /\.json$/i).map(path => {
    const name = path.slice('BAAH_CONFIGS/'.length), storage = 'DATA/USER_STORAGE/STORAGE' + baahStorageSuffix(name) + '.json';
    return sourceCandidate(path, name, 'BAAH.exe', [name], [sourceResource('main', path),
      sourceResource('software-config', 'DATA/CONFIGS/software_config.json'),
      ...(sourceExists(storage) ? [sourceResource('progress', storage)] : [])], ['DATA/LOGS/*.log']);
  }));
