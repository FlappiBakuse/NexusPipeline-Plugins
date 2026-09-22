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
  "plugins/specialized/BetterGI/data/editor.js",
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
  "plugins/specialized/ZenlessZoneZeroOneDragon/data/editor.js",
  "01",
  "one_dragon.yml",
  zzzMultiSource,
);
assert.match(zzzMultiOutput, /name: ['"]01['"]/u);
assert.doesNotMatch(zzzMultiOutput, /name: ['"]02['"]/u);
assert.match(zzzMultiOutput, /active: true/u);
assert.match(zzzMultiOutput, /active_in_od: true/u);
assert.match(zzzMultiOutput, /^instance_run: 仅运行当前$/mu);

const zzzSingleOutput = runEditor(
  "plugins/specialized/ZenlessZoneZeroOneDragon/data/editor.js",
  "01",
  "one_dragon.yml",
  "instance_list:\n- idx: 1\n  name: single\n  active: false\n  active_in_od: false\n",
);
assert.match(zzzSingleOutput, /name: single/u);
assert.match(zzzSingleOutput, /active: true/u);
assert.match(zzzSingleOutput, /active_in_od: true/u);
assert.match(zzzSingleOutput, /^instance_run: 仅运行当前$/mu);

const zzzModeSource = "# global comment\ninstance_run: '全部实例' # mode comment\nkeep: unchanged\ninstance_list:\n- idx: 1\n  name: single\n  active: true\n  active_in_od: true\n";
const zzzModeOutput = runEditor("plugins/specialized/ZenlessZoneZeroOneDragon/data/editor.js", "01", "one_dragon.yml", zzzModeSource);
assert.match(zzzModeOutput, /^instance_run: 仅运行当前 # mode comment$/mu);
assert.match(zzzModeOutput, /^keep: unchanged$/mu);
assert.match(zzzModeOutput, /^# global comment$/mu);
assert.equal(runEditor("plugins/specialized/ZenlessZoneZeroOneDragon/data/editor.js", "01", "one_dragon.yml", zzzModeOutput), zzzModeOutput);
assert.equal(runEditor("plugins/specialized/ZenlessZoneZeroOneDragon/data/editor.js", "01", "one_dragon.yml", "\uFEFF" + zzzModeSource.replaceAll("\n", "\r\n")), "\uFEFF" + zzzModeOutput.replaceAll("\n", "\r\n"));
assert.throws(() => runEditor("plugins/specialized/ZenlessZoneZeroOneDragon/data/editor.js", "01", "one_dragon.yml", "instance_run: 全部实例\n" + zzzModeSource), /重复 instance_run/u);
assert.throws(() => runEditor("plugins/specialized/ZenlessZoneZeroOneDragon/data/editor.js", "01", "one_dragon.yml", zzzModeSource.replace("'全部实例'", "unknown")), /instance_run 格式无效/u);
assert.throws(() => runEditor("plugins/specialized/ZenlessZoneZeroOneDragon/data/editor.js", "01,02", "one_dragon.yml", zzzModeSource), /两位数字/u);

console.log("配置编辑脚本行为验证通过：BetterGI、ZZZ 单实例与多实例 YAML");
