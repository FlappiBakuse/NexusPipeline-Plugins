// ZenlessZoneZeroOneDragon 配置校验器：只读比较 + 角落通知提醒（本版本不修改配置）。
// 触发语境 input.trigger：config-edit（配置编辑完成）/ script-save（脚本实例保存）。
// 校验项：项目设置的游戏路径与接管实例的 OneDragon 配置（game_account.yml 的 game_path）一致性。
// game_account.yml 为 YAML：行级解析 game_path 行，不做完整 YAML 解析。
// 写入预留：后续版本如需自动同步（改写 game_path 行），在此扩展。
const scriptName = String(nexus.input.script.name || "ZenlessZoneZeroOneDragon");
const gameExe = String(nexus.input.script.gameExe || "").trim();
if (gameExe) {
  const configPath = findGameAccountPath();
  if (configPath) {
    const content = nexus.readFile(configPath);
    if (content !== null) {
      const configured = readYamlGamePath(content);
      if (!configured.value) {
        nexus.notify("游戏路径未配置", scriptName + " 在 OneDragon 中尚未设置游戏路径", "warning");
      } else if (normalizePath(configured.value) !== normalizePath(gameExe)) {
        nexus.notify("游戏路径不一致", scriptName + " 配置的游戏路径与项目设置不一致", "warning");
      }
    }
  }
}

// 归一化：统一分隔符、小写、去引号与尾部分隔符，路径比较不受大小写与书写差异影响。
function normalizePath(value) {
  let text = String(value || "").trim().replace(/^["']|["']$/g, "");
  return text.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
}

// 行级提取 game_account.yml 的 game_path 值。
function readYamlGamePath(yamlText) {
  const lines = String(yamlText || "").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^game_path\s*:\s*(.*?)\s*$/);
    if (match) {
      const value = match[1].replace(/\s+#.*$/, "").trim();
      return { value: value.replace(/^["']|["']$/g, ""), line: match[0] };
    }
  }
  return { value: "", line: "" };
}

// 接管实例的快照（config/{实例序号} 目录）内定位 game_account.yml。
function findGameAccountPath() {
  const files = (nexus.input.snapshot && nexus.input.snapshot.files) || [];
  for (const file of files) {
    if (/^game_account\.ya?ml$/i.test(file.path || "")) return file.path;
  }
  return "";
}
