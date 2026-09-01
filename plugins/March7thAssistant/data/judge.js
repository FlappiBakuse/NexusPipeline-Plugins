const input = JSON.parse(__NEXUS_INPUT__);
const log = input.log || "";
// v0.2.0：运行结束标志兼容两种收尾——「游戏终止：StarRail」仅在 after_finish 配置为退出类取值时打印；
// 「停止运行」盒线由 stop() 收尾必打印（与 after_finish 无关）。异常结束无这两行且必有 ERROR「发生错误」。
const DONE_MARKERS = ["游戏终止：StarRail", "停止运行"];
const DAILY_TASK_MARKER = "每日实训奖励完成";
const FAILURE_PATTERNS = [
  "每日实训未完成",
  "清体力未完成",
  "模拟宇宙未完成",
  "锄大地未完成",
  "遗器背包已满",
  "领取星琼失败"
];

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

// 特定任务截图：领取每日实训奖励完成后
const shotState = loadShotState();
takeShot(shotState, "dailyReward", log.indexOf(DAILY_TASK_MARKER));

let doneOffset = -1;
for (const marker of DONE_MARKERS) {
  const pos = log.indexOf(marker);
  if (pos >= 0 && (doneOffset < 0 || pos < doneOffset)) {
    doneOffset = pos;
  }
}
if (doneOffset >= 0) {
  // 最终运行成功/失败判定输出前截图
  takeShot(shotState, "final", doneOffset);
  const failedLines = [];
  for (const pattern of FAILURE_PATTERNS) {
    if (log.indexOf(pattern) >= 0) failedLines.push(pattern);
  }
  if (failedLines.length === 0) {
    console.log(JSON.stringify({ status: "success", reason: "全部任务执行成功" }));
  } else {
    console.log(JSON.stringify({ status: "failed", reason: "任务未完成：" + failedLines.join("、") }));
  }
} else if (/ \| ERROR \| 发生错误/.test(log)) {
  // 运行结束标志出现前发生错误：输出失败结果前截图
  takeShot(shotState, "final", log.indexOf("发生错误"));
  console.log(JSON.stringify({ status: "failed", reason: "运行发生错误，任务未完成" }));
}
