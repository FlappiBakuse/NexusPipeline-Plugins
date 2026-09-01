const input = JSON.parse(__NEXUS_INPUT__);
const log = input.log || "";
const DONE_MARKER = "一条龙和配置组任务结束";
// 任务行格式随版本不同：旧版为 → "任务名" 结束（带引号），上游新版为 → 任务名 结束
const DAILY_TASK_END_MARKER = "→ \"前往冒险家协会领取奖励\" 结束";
const DAILY_TASK_END_MARKER_PLAIN = "→ 前往冒险家协会领取奖励 结束";
const DAILY_TASK_FAIL_MARKER = "前往冒险家协会领取奖励执行异常";

// v0.2.0 运行期截图：judge 每次调用相互独立，用 script 目录状态文件记录已截图标志的
// 字符偏移——同一尝试内每类只截一次，新尝试（偏移变小）自动重置；截图失败不记录，下次重试。
function loadShotState() {
  const list = nexus.listFiles() || [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].toLowerCase().endsWith("judge-shot-state.json")) {
      try { return JSON.parse(nexus.readFile(list[i])) || {}; } catch (e) { return {}; }
    }
  }
  return {};
}

function takeShot(state, key, offset) {
  if (offset < 0) return;
  if (state[key] !== null && state[key] !== undefined && offset >= state[key]) return;
  const id = nexus.captureScreenshot();
  if (id) {
    state[key] = offset;
    nexus.writeFile("judge-shot-state.json", JSON.stringify(state));
  }
}

// 特定任务截图：领取每日奖励（日志名「前往冒险家协会领取奖励」）流程结束或执行异常时
const shotState = loadShotState();
const dailyEndQuoted = log.indexOf(DAILY_TASK_END_MARKER);
takeShot(shotState, "dailyReward",
  dailyEndQuoted >= 0 ? dailyEndQuoted : log.indexOf(DAILY_TASK_END_MARKER_PLAIN));
takeShot(shotState, "dailyRewardFail", log.indexOf(DAILY_TASK_FAIL_MARKER));

// 配置接管范围为一条龙配置目录（User/OneDragon）：默认含「默认配置.json」，用户可能改名或
// 创建多个配置。约定只识别目录顶层按名称排序的第一个 .json 文件作为生效配置，
// 多配置共存的判定偏差由用户自行承担。
function configEntry() {
  const files = input.files || [];
  const entries = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.Root !== "config") continue;
    const rel = String(f.Path || "").split("\\").join("/");
    if (rel.indexOf("/") >= 0 || !/\.json$/i.test(rel)) continue;
    entries.push({ name: rel, abs: String(f.Abs || "") });
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return entries[0] || null;
}

// BetterGI 任务收尾自检「检查每日奖励结果："X"」，取最后一次检查结果作为通知提示
function dailyCheckText() {
  const KEY = "检查每日奖励结果：\"";
  const pos = log.lastIndexOf(KEY);
  if (pos < 0) return "";
  const end = log.indexOf("\"", pos + KEY.length);
  if (end < 0) return "";
  const result = log.slice(pos + KEY.length, end).trim();
  if (!result) return "";
  if (result === "今日奖励已领取") return "每日奖励已领取";
  return "每日奖励" + result + "，请查看运行截图";
}

if (log.indexOf(DONE_MARKER) < 0) {
  // 尚未运行完成（未出现运行结束关键字），持续等待
} else {
  const ALIAS = { "前往冒险家协会领取奖励": "领取每日奖励" };

  function extractFailedNames(text) {
    const names = [];
    const seen = {};
    const re = /^(.+?)执行(?:失败|异常)/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
      const raw = (m[1] || "").trim();
      if (raw && !seen[raw]) {
        seen[raw] = true;
        names.push(ALIAS[raw] || raw);
      }
    }
    return names;
  }

  const failed = extractFailedNames(log);
  // 最终运行成功/失败判定输出前截图
  takeShot(shotState, "final", log.indexOf(DONE_MARKER));
  if (failed.length === 0) {
    const daily = dailyCheckText();
    console.log(JSON.stringify(daily
      ? { status: "success", reason: "全部任务执行成功", notifyText: daily }
      : { status: "success", reason: "全部任务执行成功" }));
  } else {
    const entry = configEntry();
    const cfgText = entry ? nexus.readFile(entry.abs) : "";
    let cfg = null;
    try { cfg = cfgText ? JSON.parse(cfgText) : null; } catch (e) { cfg = null; }
    if (!cfg) {
      console.log(JSON.stringify({ status: "failed", reason: "无法读取或解析 BetterGI 配置文件，已终止重试" }));
    } else {
      // 首次触发时提取初始任务启停映射（TaskEnabledList 全量）写 config-restore.json
      //（宿主收尾按描述还原启停后再同步快照）；跨尝试只写一次（script 目录运行期间不清空）。
      const restoreExists = nexus.listFiles().some(p => p.toLowerCase().endsWith("config-restore.json"));
      if (!restoreExists) {
        const initial = {};
        const enabledMap = cfg.TaskEnabledList || {};
        for (const guid of Object.keys(enabledMap)) initial[guid] = enabledMap[guid] === true;
        nexus.writeFile("config-restore.json", JSON.stringify({
          files: [{
            file: entry.name,
            toggles: [{
              type: "map",
              path: "TaskEnabledList",
              initial: initial
            }]
          }]
        }));
      }
      const defs = cfg.TaskDefinitions || {};
      const nameToGuid = {};
      for (const guid of Object.keys(defs)) nameToGuid[defs[guid]] = guid;
      const failedGuids = [];
      const unknown = [];
      for (const name of failed) {
        const guid = nameToGuid[name];
        if (guid) failedGuids.push(guid); else unknown.push(name);
      }
      if (unknown.length > 0) {
        console.log(JSON.stringify({ status: "failed", reason: "无法识别失败任务：" + unknown.join("、") + "，为避免误改配置已终止重试" }));
      } else {
        const enabled = cfg.TaskEnabledList || {};
        for (const guid of Object.keys(enabled)) enabled[guid] = failedGuids.indexOf(guid) >= 0;
        cfg.NextTaskId = "";
        nexus.writeFile(entry.name, JSON.stringify(cfg, null, 2));
        console.log(JSON.stringify({ status: "failed", reason: "任务执行失败：" + failed.join("、") + "，已调整为仅重试失败任务", replaceConfigs: [entry.name] }));
      }
    }
  }
}
