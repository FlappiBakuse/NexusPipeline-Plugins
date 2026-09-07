const input = JSON.parse(__NEXUS_INPUT__);
const log = input.log || "";
const FIRST_TASK_MARKER = "任务完成: 登录游戏";

// v0.1.0 运行期截图：judge 每次调用相互独立，用 script 目录状态文件记录已截图标志的
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

// 特定任务截图：每日首个任务「登录游戏」完成时
const shotState = loadShotState();
takeShot(shotState, "firstTask", log.indexOf(FIRST_TASK_MARKER));

// 任务显示名映射表（zh-CN）：MaaStellaSora interface.json 的任务名本身是中文显示名
//（customName 优先）。此处仅保留旧名/改名别名位，任务改名时在此追加。
const LABELS = {};

function displayNameOf(task) {
  return (task.customName || "").trim() || LABELS[task.taskName] || task.taskName;
}

// 1. 读取 MXU 用户配置（Root=config）：优先 mxu-MaaStellaSora.json（interface name），
//    回退 config 根下任意 mxu-*.json（interface 改名/自定义布局兼容）。
let cfg = null;
let cfgRelPath = "";
const files = input.files || [];
const candidates = [];
for (const f of files) {
  if (f.Root !== "config") continue;
  if (/^mxu-[A-Za-z0-9_\-]+\.json$/i.test(f.Path || "")) {
    candidates.push(f);
  }
}
candidates.sort((a, b) => (a.Path === "mxu-MaaStellaSora.json" ? -1 : 0) - (b.Path === "mxu-MaaStellaSora.json" ? -1 : 0) || String(a.Path).localeCompare(String(b.Path)));
for (const f of candidates) {
  try {
    const parsed = JSON.parse(nexus.readFile(f.Abs));
    if (parsed && parsed.settings && Array.isArray(parsed.instances)) {
      cfg = parsed;
      cfgRelPath = f.Path;
      break;
    }
  } catch (e) { /* 尝试下一个候选 */ }
}
if (!cfg || !cfg.settings || !Array.isArray(cfg.instances)) {
  // 配置缺失/解析失败：保守无输出（宿主超时/进程退出判 failed）
} else {
  // 2. 按 settings.autoStartInstanceId 定位实例（MXU --autostart 按实例 id 匹配）；
  //    回退 lastActiveInstanceId，再回退「唯一实例」；多实例且无标记时保守无输出。
  let inst = null;
  const autoId = cfg.settings.autoStartInstanceId;
  const lastId = cfg.settings.lastActiveInstanceId;
  if (autoId) {
    inst = cfg.instances.find(i => i.id === autoId) || null;
  }
  if (!inst && lastId) {
    inst = cfg.instances.find(i => i.id === lastId) || null;
  }
  if (!inst && cfg.instances.length === 1) {
    inst = cfg.instances[0];
  }
  if (!inst || !Array.isArray(inst.tasks)) {
    // 实例定位失败：保守无输出
  } else {
    // 3. 首次触发时提取初始任务启停映射写 config-restore.json（宿主收尾按描述还原启停后再同步快照，
    //    插队文件以「初始启停 + 运行后计数/其他字段」写入 store）；跨尝试只写一次（script 目录运行期间不清空）。
    const restoreExists = nexus.listFiles().some(p => p.toLowerCase().endsWith("config-restore.json"));
    if (!restoreExists) {
      const initial = {};
      for (const t of inst.tasks) {
        if (t.id) initial[t.id] = t.enabled === true;
      }
      nexus.writeFile("config-restore.json", JSON.stringify({
        files: [{
          file: cfgRelPath,
          toggles: [{
            type: "array",
            path: "instances[id=" + inst.id + "].tasks",
            keyField: "id",
            enabledField: "enabled",
            initial: initial
          }]
        }]
      }));
    }
    // 4. 已启用任务（与 MXU 运行分发一致：只按 enabled 过滤）
    const enabledTasks = inst.tasks.filter(t => t.enabled === true);
    if (enabledTasks.length === 0) {
      // 无启用任务：保守无输出
    } else {
      // 5. 运行完成判定：最后一个启用任务出现「任务完成/失败: <显示名>」判定行
      const lastName = displayNameOf(enabledTasks[enabledTasks.length - 1]);
      let done = false;
      let doneOffset = -1;
      const lines = log.split(/\r?\n/);
      let cursor = 0;
      for (const line of lines) {
        const donePos = line.indexOf("任务完成: " + lastName);
        const failPos = line.indexOf("任务失败: " + lastName);
        if (donePos >= 0 || failPos >= 0) {
          done = true;
          doneOffset = cursor + Math.max(donePos, failPos);
          break;
        }
        cursor += line.length + 1;
      }
      if (!done) {
        // 尚未运行完成，持续等待（中途崩溃/停止 → 进程退出最终触发无判定 → 宿主判 failed）
      } else {
        // 最终运行成功/失败判定输出前截图
        takeShot(shotState, "final", doneOffset);
        // 6. 提取全部失败任务（行扫描「任务失败: X」，X 为显示名）
        const failed = [];
        for (const line of lines) {
          const pos = line.indexOf("任务失败: ");
          if (pos >= 0) {
            const name = line.slice(pos + "任务失败: ".length).trim();
            if (name && failed.indexOf(name) < 0) failed.push(name);
          }
        }
        if (failed.length === 0) {
          console.log(JSON.stringify({ status: "success", reason: "全部任务执行成功" }));
        } else {
          // 显示名 → 任务项（同一 taskName 多条时需 customName 区分）
          const failedTasks = [];
          const unknown = [];
          for (const name of failed) {
            const t = enabledTasks.find(x => displayNameOf(x) === name);
            if (t) failedTasks.push(t); else unknown.push(name);
          }
          if (unknown.length > 0) {
            console.log(JSON.stringify({ status: "failed", reason: "无法识别的失败任务：" + unknown.join("、") + "，为避免误改配置未调整重试" }));
          } else {
            // 选择性重试：全部 enabled=false，仅失败任务 enabled=true（其余字段原样保留）
            const failedIds = failedTasks.map(t => t.id);
            for (const t of inst.tasks) {
              t.enabled = failedIds.indexOf(t.id) >= 0;
            }
            nexus.writeFile(cfgRelPath, JSON.stringify(cfg, null, 2));
            console.log(JSON.stringify({
              status: "failed",
              reason: "任务失败：" + failed.join("、") + "，已调整为仅重试失败任务",
              replaceConfigs: [cfgRelPath]
            }));
          }
        }
      }
    }
  }
}
