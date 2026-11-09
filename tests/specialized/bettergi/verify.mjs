import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runComponent } from '../component-runner.mjs';

const flags = Object.fromEntries(process.argv.slice(2).reduce((rows, value, index, values) =>
  value.startsWith('--') ? [...rows, [value.slice(2), values[index + 1]]] : rows, []));
if (!flags.output || !path.isAbsolute(flags.output)) throw Error('--output must be an explicit absolute external directory');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
await runComponent(root, 'bettergi', path.resolve(flags.output), async invoke => {
  const { cases } = await import('./cases.mjs');
  const { streamCases, configurationCases } = await import('./stream-cases.mjs');
  return [...cases(invoke), ...streamCases(invoke), ...configurationCases(invoke)];
}, { scope: 'Source-derived synthetic four-phase cases in Node VM; not installed Host or upstream binary qualification',
  upstreamBinary: 'NOT_RUN', actualHost: 'NOT_RUN' });
