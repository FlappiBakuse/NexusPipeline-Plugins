// BAAH 配置校验器：只读比较 + 角落通知提醒（本版本不修改配置）。
// 触发语境 input.trigger：config-edit（配置编辑完成）/ script-save（脚本实例保存）。
// 校验项：
//   ① 游戏路径一致性：模拟器模式比较项目设置的模拟器 ADB 地址与用户配置的
//      TARGET_IP_PATH/TARGET_PORT；PC 模式比较项目设置的游戏路径与用户配置的
//      TARGET_EMULATOR_PATH（BAAH 的 PC 客户端经该键与自带启动器启动）。
//   ② SAVE_LOG_TO_FILE 必须开启：BAAH 软件配置（DATA/CONFIGS/software_config.json）未开启或
//      从未落盘（BAAH 默认关闭且不写盘）时提醒，否则运行日志不落文件、历史详情无日志可查。
// 写入预留：后续版本如需自动修复（写 TARGET_IP_PATH/TARGET_PORT 或 SAVE_LOG_TO_FILE=true），在此扩展；
// 附加配置快照（@extra 前缀）当前版本由宿主强制只读。
const scriptName = String(nexus.input.script.name || "BAAH");
const gameExe = String(nexus.input.script.gameExe || "").trim();
const gameMode = String(nexus.input.script.gameMode || "").trim();
const isEmulatorMode = gameMode === "emulator";

function normalizeValue(value) {
  return String(value || "").trim().replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
}

// ① 游戏路径一致性（模拟器 = ADB 地址；PC = 游戏 exe，路径仍由前端填写，用于失败时强制关闭游戏）
if (gameExe) {
  const userConfigPath = findUserConfigPath();
  if (userConfigPath) {
    try {
      const cfg = JSON.parse(nexus.readFile(userConfigPath));
      if (isEmulatorMode) {
        const adb = String(cfg.TARGET_IP_PATH ?? "127.0.0.1").trim() + ":" + String(cfg.TARGET_PORT ?? "5555").trim();
        if (normalizeValue(adb) !== normalizeValue(gameExe)) {
          nexus.notify("游戏路径不一致", scriptName + " 配置的模拟器 ADB 地址与项目设置不一致", "warning");
        }
      } else {
        const configured = String(cfg.TARGET_EMULATOR_PATH ?? "").trim();
        if (!configured) {
          nexus.notify("游戏路径未配置", scriptName + " 在 BAAH 中尚未设置游戏路径", "warning");
        } else if (normalizeValue(configured) !== normalizeValue(gameExe)) {
          nexus.notify("游戏路径不一致", scriptName + " 配置的游戏路径与项目设置不一致", "warning");
        }
      }
    } catch (error) {
      // 用户配置不可读时跳过校验
    }
  }
}

// ② SAVE_LOG_TO_FILE 必须开启
const extra = (nexus.input.extras || [])[0];
if (extra) {
  const extraFiles = extra.files || [];
  let saveLogToFile = null;
  if (extraFiles.length > 0) {
    try {
      const softwareConfig = JSON.parse(nexus.readFile("@extra0/" + extraFiles[0].path));
      if (softwareConfig && typeof softwareConfig === "object") {
        saveLogToFile = softwareConfig.SAVE_LOG_TO_FILE === true;
      }
    } catch (error) {
      // 软件配置不可读时保守跳过
    }
  }
  if (saveLogToFile === false || (saveLogToFile === null && extraFiles.length === 0)) {
    nexus.notify("日志保存未开启", "在 BAAH 设置中开启日志保存后，历史详情可查看日志", "warning");
  }
}

// 主配置快照内定位 BAAH 用户配置文件：优先含 TASK_ORDER_GROUP 的 JSON，回退唯一文件。
function findUserConfigPath() {
  const files = (nexus.input.snapshot && nexus.input.snapshot.files) || [];
  for (const file of files) {
    if (/\.json$/i.test(file.path || "")) {
      try {
        const content = nexus.readFile(file.path);
        if (content && JSON.parse(content).TASK_ORDER_GROUP !== undefined) return file.path;
      } catch (error) {
        // 继续尝试下一个文件
      }
    }
  }
  return files.length > 0 ? files[0].path : "";
}
