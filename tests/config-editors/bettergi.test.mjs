import assert from "node:assert/strict";
import { runEditor } from "./support.mjs";

export function verify(root) {
  const betterGiOutput = runEditor(root,
    "plugins/specialized/BetterGI/data/editor.js",
    "NexusPipeline",
    "config.json",
    "{\"before\":true}\n",
  );
  assert.equal(JSON.parse(betterGiOutput).selectedOneDragonFlowConfigName, "NexusPipeline");

}
