import assert from "node:assert/strict";
import { runEditor } from "./support.mjs";

export function verify(root) {
  const mfaEditor = "plugins/specialized/MaaStellaSora/data/editor.js";
  const mfaSource = JSON.stringify({ NoAutoStart: "False", GlobalStartEnabled: "True", Other: "42" });
  const mfaOutput = runEditor(root, mfaEditor, "chosen", "appsettings.json", mfaSource);
  assert.deepEqual(JSON.parse(mfaOutput), { NoAutoStart: "True", GlobalStartEnabled: "True", Other: "42" });
  assert.equal(runEditor(root, mfaEditor, "chosen", "appsettings.json", mfaOutput), mfaOutput);
  assert.deepEqual(JSON.parse(runEditor(root, mfaEditor, "chosen", "appsettings.json", mfaOutput, "config-edit-commit")),
    { NoAutoStart: "False", GlobalStartEnabled: "True", Other: "42" });
  assert.throws(() => runEditor(root, mfaEditor, "chosen", "appsettings.json", "[]"));
  assert.throws(() => runEditor(root, mfaEditor, "chosen", "appsettings.json", "invalid json"));

  console.log("MFA 编辑准备：禁止自动启动、保留字符串配置、重复执行及无效 JSON 检查通过");
}
