"use strict";

const extra = nexus.input.extras && nexus.input.extras[0];
const file = extra && extra.files && extra.files[0] && extra.files[0].path;
if (!file) throw new Error("MFA appsettings.json 工作副本不存在");
const source = nexus.readFile("@extra0/" + file);
if (source === null) throw new Error("无法读取 MFA appsettings.json 工作副本");
const config = JSON.parse(source.replace(/^\uFEFF/, ""));
if (!config || typeof config !== "object" || Array.isArray(config))
  throw new Error("MFA appsettings.json 根节点必须是对象");
// MFA consumes this one-shot flag before either global or per-instance startup.
config.NoAutoStart = "True";
if (!nexus.writeFile("@extra0/" + file, JSON.stringify(config, null, 2) + "\n"))
  throw new Error("无法禁止 MFA 编辑时自动启动");
