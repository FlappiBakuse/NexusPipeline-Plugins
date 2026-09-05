// March7thAssistant 配置校验器：只读比较 + 角落通知提醒（本版本不修改配置）。
// 触发语境 input.trigger：config-edit（配置编辑完成）/ script-save（脚本实例保存）。
// 校验项：项目设置的游戏路径与 M7A 用户配置（config.yaml 顶层 game_path）一致性。
// config.yaml 为 YAML 且带注释：行级解析 game_path 行（保留注释），不做完整 YAML 解析。
// 写入预留：后续版本如需自动同步（改写 game_path 行），在此扩展。
const scriptName = String(nexus.input.script.name || "March7thAssistant");
const gameExe = String(nexus.input.script.gameExe || "").trim();
if (gameExe) {
  const configPath = findConfigPath();
  if (configPath) {
    const content = nexus.readFile(configPath);
    if (content !== null) {
      const configured = readYamlGamePath(content);
      if (!configured.value) {
        nexus.notify("游戏路径未配置", scriptName + " 在 March7thAssistant 中尚未设置游戏路径", "warning");
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

// 行级提取 config.yaml 的 game_path 值：匹配顶层「game_path:」行，保留行尾注释。
function readYamlGamePath(yamlText) {
  const lines = String(yamlText || "").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^game_path\s*:\s*(.*?)\s*$/);
    if (match) {
      const value = match[1].replace(/\s+#.*$/, "").trim();
      return { value: value.replace(/^["']|["']$/g, ""), line };
    }
  }
  return { value: "", line: "" };
}

// 主配置快照内定位 config.yaml（文件型快照通常只有该文件）。
function findConfigPath() {
  const files = (nexus.input.snapshot && nexus.input.snapshot.files) || [];
  for (const file of files) {
    if (/^config\.ya?ml$/i.test(file.path || "")) return file.path;
  }
  return files.length === 1 ? files[0].path : "";
}
