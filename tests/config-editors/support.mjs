import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export function runEditor(repoRoot, relativePath, inputValue, filePath, source, trigger = "config-edit-preparation") {
  const code = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  let output = null;
  const context = {
    nexus: {
      input: {
        trigger,
        configInputValue: inputValue,
        extras: [{ files: [{ path: filePath }] }],
      },
      readFile: requestedPath => requestedPath === `@extra0/${filePath}` ? source : null,
      writeFile: (requestedPath, content) => {
        if (requestedPath !== `@extra0/${filePath}`) return false;
        output = content;
        return true;
      },
    },
  };
  vm.runInNewContext(code, context, { filename: relativePath });
  assert.notEqual(output, null, `${relativePath} 未写回附加配置`);
  return output;
}
