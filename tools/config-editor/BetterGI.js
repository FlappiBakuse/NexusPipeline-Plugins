"use strict";

const selected = String(nexus.input.configInputValue || "").trim();
if (!selected) {
  throw new Error("缺少一条龙配置名");
}

const extra = nexus.input.extras && nexus.input.extras[0];
const file = extra && extra.files && extra.files[0] && extra.files[0].path;
if (!file) {
  throw new Error("User/config.json 工作副本不存在");
}

const source = nexus.readFile("@extra0/" + file);
if (source === null) {
  throw new Error("无法读取 User/config.json 工作副本");
}

let config;
try {
  config = JSON.parse(source);
} catch (error) {
  throw new Error("User/config.json 不是有效 JSON：" + error.message);
}
if (config === null || typeof config !== "object" || Array.isArray(config)) {
  throw new Error("User/config.json 根节点必须是对象");
}

config.selectedOneDragonFlowConfigName = selected;
if (!nexus.writeFile("@extra0/" + file, JSON.stringify(config, null, 2) + "\n")) {
  throw new Error("无法写回 User/config.json 工作副本");
}
