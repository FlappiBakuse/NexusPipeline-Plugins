import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runComponent } from './component-runner.mjs';

const [root, extensionId, output] = process.argv.slice(2);
if (![root, output].every(value => value && path.isAbsolute(value)) || !extensionId || !/^[a-z][a-z0-9-]*$/.test(extensionId))
  throw Error('Explicit repository, extension and external output required');
await runComponent(root, extensionId, output, async invoke => {
  const module = await import(pathToFileURL(path.join(root, 'tests/specialized', extensionId, 'cases.mjs')).href);
  return module.cases(invoke);
}, { scope: 'Source-derived synthetic adapter cases; no installed Host or upstream execution' });
