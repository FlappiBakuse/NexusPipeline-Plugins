import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runEditor(relativePath, inputValue, filePath, source) {
  const code = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  let output = null;
  const context = {
    nexus: {
      input: {
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

const betterGiOutput = runEditor(
  "plugins/specialized/BetterGI/data/config-editor.js",
  "NexusPipeline",
  "config.json",
  "{\"before\":true}\n",
);
assert.equal(JSON.parse(betterGiOutput).selectedOneDragonFlowConfigName, "NexusPipeline");

const zzzMultiSource = [
  "instance_list:",
  "- idx: 1",
  "  name: '01'",
  "  active: false",
  "  active_in_od: true",
  "  force_login_before_run: false",
  "- idx: 2",
  "  name: '02'",
  "  active: true",
  "  active_in_od: true",
  "  force_login_before_run: false",
  "",
].join("\r\n");
const zzzMultiOutput = runEditor(
  "plugins/specialized/ZenlessZoneZeroOneDragon/data/config-editor.js",
  "01",
  "one_dragon.yml",
  zzzMultiSource,
);
assert.match(zzzMultiOutput, /name: ['"]01['"]/u);
assert.doesNotMatch(zzzMultiOutput, /name: ['"]02['"]/u);
assert.match(zzzMultiOutput, /active: true/u);
assert.match(zzzMultiOutput, /active_in_od: true/u);

const zzzSingleOutput = runEditor(
  "plugins/specialized/ZenlessZoneZeroOneDragon/data/config-editor.js",
  "01",
  "one_dragon.yml",
  "instance_list:\n- idx: 1\n  name: single\n  active: false\n  active_in_od: false\n",
);
assert.match(zzzSingleOutput, /name: single/u);
assert.match(zzzSingleOutput, /active: true/u);
assert.match(zzzSingleOutput, /active_in_od: true/u);

console.log("配置编辑脚本行为验证通过：BetterGI、ZZZ 单实例与多实例 YAML");
