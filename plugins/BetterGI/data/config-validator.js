// BetterGI 配置校验器：只读比较 + 角落通知提醒（本版本不修改配置）。
// 触发语境 input.trigger：config-edit（配置编辑完成）/ script-save（脚本实例保存）。
// 校验项：项目设置的游戏路径与 BetterGI 全局配置（User/config.json 的 genshinStartConfig.installPath）
// 一致性。installPath 是游戏安装目录：按「项目设置 exe 所在目录」比较；若 BetterGI 侧填写的是
// exe 全路径则按文件比较。installPath 为空视为未配置，同样提醒。
// 写入预留：后续版本如需自动同步（写 installPath），在此扩展；附加配置快照（@extra 前缀）当前版本由宿主强制只读。
const scriptName = String(nexus.input.script.name || "BetterGI");
const gameExe = String(nexus.input.script.gameExe || "").trim();
if (gameExe) {
  const extra = (nexus.input.extras || [])[0];
  const extraFiles = (extra && extra.files) || [];
  if (extraFiles.length > 0) {
    try {
      const config = JSON.parse(nexus.readFile("@extra0/" + extraFiles[0].path));
      const installPath = String(config && config.genshinStartConfig ? config.genshinStartConfig.installPath : "").trim();
      if (!installPath) {
        nexus.notify("游戏路径未配置", scriptName + " 在 BetterGI 中尚未设置游戏路径", "warning");
      } else if (!matchesProjectGamePath(installPath, gameExe)) {
        nexus.notify("游戏路径不一致", scriptName + " 配置的游戏路径与项目设置不一致", "warning");
      }
    } catch (error) {
      // 全局配置不可读时跳过校验
    }
  }
}

function normalizePath(value) {
  return String(value || "").trim().replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
}

function executableDirectory(path) {
  const separator = path.lastIndexOf("\\");
  return separator > 0 ? path.slice(0, separator) : path;
}

function matchesProjectGamePath(installPath, projectGameExe) {
  const bettergiPath = normalizePath(installPath);
  const projectPath = normalizePath(projectGameExe);
  const projectDirectory = normalizePath(executableDirectory(projectPath));
  if (bettergiPath.endsWith(".exe")) {
    return bettergiPath === projectPath;
  }
  return bettergiPath === projectDirectory;
}
