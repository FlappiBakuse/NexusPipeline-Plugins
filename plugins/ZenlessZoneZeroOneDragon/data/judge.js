const input = JSON.parse(__NEXUS_INPUT__);
const log = input.log || "";
const ONE_DRAGON_FAIL_MARKER = "指令[ 一条龙 ] 执行失败";
const ONE_DRAGON_DONE_MARKER = "指令[ 一条龙 ] 执行成功";
const CLOSE_MARKER = "关闭游戏成功";
const PAUSE_MARKER = "暂停运行";
const DAILY_TASK_MARKER = "指令[ 每日签到 ] 执行成功";
const IGNORE_APPS = ["等待大世界画面", "通知"];

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

// 特定任务截图：每日签到应用执行成功时
const shotState = loadShotState();
takeShot(shotState, "dailyReward", log.indexOf(DAILY_TASK_MARKER));

// v0.2.0 修复：「暂停运行」在一条龙整体失败（如登录后未进入大世界）与正常结束时都会打印，
// 不能单独作为运行结束标志；一条龙执行失败必须优先判 failed。
const failPos = log.indexOf(ONE_DRAGON_FAIL_MARKER);
if (failPos >= 0) {
  // 最终运行失败判定输出前截图
  takeShot(shotState, "final", failPos);
  const lineEnd = log.indexOf("\n", failPos);
  const line = log.slice(failPos, lineEnd < 0 ? undefined : lineEnd);
  const statusPos = line.indexOf("返回状态 ");
  const detail = statusPos >= 0 ? line.slice(statusPos + "返回状态 ".length).trim() : "";
  console.log(JSON.stringify({
    status: "failed",
    reason: detail ? "一条龙执行失败：" + detail + "，任务未完成" : "一条龙执行失败，任务未完成"
  }));
} else {
  const donePos = log.indexOf(CLOSE_MARKER);
  const pauseWithDone = log.indexOf(PAUSE_MARKER) >= 0 && log.indexOf(ONE_DRAGON_DONE_MARKER) >= 0;
  if (donePos < 0 && !pauseWithDone) {
    // 尚未运行结束（未出现结束关键字），持续等待
  } else {
    // 最终运行成功判定输出前截图
    takeShot(shotState, "final", donePos >= 0 ? donePos : log.indexOf(PAUSE_MARKER));
    const failed = [];
    const re = /指令\[ (.+?) \] 执行失败 返回状态/g;
    let m;
    while ((m = re.exec(log)) !== null) {
      const name = (m[1] || "").trim();
      if (name && IGNORE_APPS.indexOf(name) < 0 && failed.indexOf(name) < 0) {
        failed.push(name);
      }
    }
    if (failed.length === 0) {
      console.log(JSON.stringify({ status: "success", reason: "全部应用执行成功" }));
    } else {
      console.log(JSON.stringify({
        status: "success",
        reason: "一条龙运行完成，但部分应用执行失败",
        notifyText: "本次运行有应用执行失败：" + failed.join("、")
      }));
    }
  }
}
