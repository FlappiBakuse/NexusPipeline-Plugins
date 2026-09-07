const input = JSON.parse(__NEXUS_INPUT__);
const log = input.log || "";

// BAAH 无 per-task 状态文件、退出码恒 0，判定完全依赖任务日志。日志行格式：
// "{版本} - {分:秒} - {LEVEL} : {消息}"，语言随 BAAH 软配置（中文为默认），判定兼容中英双语。
// 任务基类（Task.run）标记：开始「执行任务{name}」/「Run task {name}」；
// 完成「任务{name}执行结束」/「Task {name} execution completed」；
// 跳过「任务{name}执行前条件不成立或超时，跳过此任务」（前置条件不满足属正常跳过，不算失败）。
// 整体结束「程序运行结束…」在成功与失败路径都会打印，因此结束标记本身不作为成功信号；
// 失败任务 = 「已开始但未出现完成/跳过」的悬空任务（BAAH 单任务抛异常即中断整轮）。
const FINISH_MARKER = "程序运行结束";
const ERROR_MARKERS = ["错误提示", "Error Mention"];
const START_CN = "执行任务";
const START_EN = "Run task ";
const END_CN = "执行结束";
const END_CN_PREFIX = "任务";
const END_EN_PREFIX = "Task ";
const END_EN_SUFFIX = " execution completed";
const SKIP_CN_SUFFIX = "执行前条件不成立或超时，跳过此任务";
const SKIP_CN_PREFIX = "任务";
const SKIP_EN_PREFIX = "The condition before the task ";
const SKIP_EN_SUFFIX = " is not met or timed out, skip this task";

// 配置任务名（BAAH taskmap 键，中文，即 TASK_PIPELINE 内的写法）→ 日志实例名。
// BAAH 实例化任务时不传 name，日志显示的是任务类 __init__ 的默认 name（代码惯例为类名）。
// BAAH 增改任务或改名时需同步本表；查不到映射的失败任务走「failed 不改配置」安全降级。
const CONFIG_TO_LOG = {
  "登录游戏": "EnterGame",
  "清momotalk": "InMomotalk",
  "活动一览": "InEventRecap",
  "长期签到": "Attendance",
  "咖啡馆": "InCafe",
  "咖啡馆只摸头": "InCafe",
  "课程表": "InTimeTable",
  "社团": "InClub",
  "制造": "InCraft",
  "商店": "InShop",
  "每日免费奖励": "InFreeAward",
  "购买AP": "BuyAP",
  "悬赏通缉": "InWanted",
  "特殊任务": "InSpecial",
  "学园交流会": "InExchange",
  "战术大赛": "InContest",
  "战术测试": "InExam",
  "总力战": "AutoAssault",
  "大决战": "AutoGrandAssault",
  "活动关卡": "InEvent",
  "推活动关卡剧情和推图": "InEvent",
  "每日任务": "CollectDailyRewards",
  "邮件": "CollectMails",
  "一键扫荡": "InQuest",
  "普通关卡": "InQuest",
  "普通推图": "InQuest",
  "困难关卡": "InQuest",
  "困难推图": "InQuest",
  "主线剧情": "AutoStory",
  "主线剧情第二部": "AutoStory",
  "短篇剧情": "AutoStory",
  "支线剧情": "AutoStory",
  "挑战任务": "SolveChallenge",
  "自定义任务": "UserTask"
};
const LOG_TO_CONFIG = {};
for (const key of Object.keys(CONFIG_TO_LOG)) {
  const logName = CONFIG_TO_LOG[key];
  (LOG_TO_CONFIG[logName] = LOG_TO_CONFIG[logName] || []).push(key);
}

// 运行期截图：judge 每次调用相互独立，用 script 目录状态文件记录已截图标志的字符偏移——
// 同一尝试内每类只截一次，新尝试（偏移变小）自动重置；截图失败不记录，下次重试。
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

function messageOf(line) {
  const separator = " : ";
  const index = line.indexOf(separator);
  return index >= 0 ? line.slice(index + separator.length).trim() : "";
}

// 1. 读取本次生效配置（configPath 为文件型，input.files 中 Root=config 的唯一条目），
//    定位激活 pipeline 的任务名/开关平行数组；配置不可用时判定照常，仅停用选择性重试。
let cfg = null;
let cfgRelPath = "";
let activePipeline = null;
const files = input.files || [];
for (const f of files) {
  if (f.Root !== "config" || !/\.json$/i.test(f.Path || "")) continue;
  try {
    const parsed = JSON.parse(nexus.readFile(f.Abs));
    if (parsed && parsed.TASK_ORDER_GROUP) {
      cfg = parsed;
      cfgRelPath = f.Path;
      break;
    }
  } catch (e) { /* 尝试下一个候选 */ }
}
if (cfg) {
  const group = cfg.TASK_ORDER_GROUP;
  let index = 0;
  if (group && typeof group.ACTIVATE_IND === "number" && Number.isInteger(group.ACTIVATE_IND)) {
    index = group.ACTIVATE_IND;
  }
  const pipelines = group && Array.isArray(group.ALL_PIPELINES) ? group.ALL_PIPELINES : null;
  const pipeline = pipelines && index >= 0 && index < pipelines.length ? pipelines[index] : null;
  if (pipeline && Array.isArray(pipeline.TASK_PIPELINE) && pipeline.TASK_PIPELINE.length > 0) {
    activePipeline = pipeline;
  }
}
const pipelineNames = activePipeline && Array.isArray(activePipeline.TASK_PIPELINE) ? activePipeline.TASK_PIPELINE : null;
const pipelineOnoff = activePipeline && Array.isArray(activePipeline.TASK_ONOFF) ? activePipeline.TASK_ONOFF : [];

// 2. 扫描日志事件流：start/end/skip/error 按出现顺序记录。
const events = [];
let hasError = false;
let hasFinish = false;
let finishOffset = -1;
const lines = log.split(/\r?\n/);
let cursor = 0;
for (const line of lines) {
  if (!hasFinish && line.indexOf(FINISH_MARKER) >= 0) {
    hasFinish = true;
    finishOffset = cursor + line.indexOf(FINISH_MARKER);
  }
  if (!hasError) {
    for (const marker of ERROR_MARKERS) {
      if (line.indexOf(marker) >= 0) {
        hasError = true;
        break;
      }
    }
  }
  const msg = messageOf(line);
  if (msg) {
    if (msg.indexOf(START_CN) === 0) {
      events.push({ type: "start", name: msg.slice(START_CN.length).trim() });
    } else if (msg.indexOf(START_EN) === 0) {
      events.push({ type: "start", name: msg.slice(START_EN.length).trim() });
    } else if (msg.indexOf(END_CN) === msg.length - END_CN.length && msg.indexOf(END_CN_PREFIX) === 0) {
      events.push({ type: "end", name: msg.slice(END_CN_PREFIX.length, msg.length - END_CN.length).trim() });
    } else if (msg.indexOf(END_EN_PREFIX) === 0 && msg.indexOf(END_EN_SUFFIX) === msg.length - END_EN_SUFFIX.length) {
      events.push({ type: "end", name: msg.slice(END_EN_PREFIX.length, msg.length - END_EN_SUFFIX.length).trim() });
    } else if (msg.indexOf(SKIP_CN_SUFFIX) === msg.length - SKIP_CN_SUFFIX.length && msg.indexOf(SKIP_CN_PREFIX) === 0) {
      events.push({ type: "skip", name: msg.slice(SKIP_CN_PREFIX.length, msg.length - SKIP_CN_SUFFIX.length).trim() });
    } else if (msg.indexOf(SKIP_EN_PREFIX) === 0 && msg.indexOf(SKIP_EN_SUFFIX) === msg.length - SKIP_EN_SUFFIX.length) {
      events.push({ type: "skip", name: msg.slice(SKIP_EN_PREFIX.length, msg.length - SKIP_EN_SUFFIX.length).trim() });
    }
  }
  cursor += line.length + 1;
}

// 3. 未出现结束标记：任务仍在运行（含内建断点重试），持续等待；
//    中途被杀/崩溃 → 进程退出后由宿主按无判定判 failed，下一轮整体重跑。
if (!hasFinish) {
  // 保守无输出
} else {
  const shotState = loadShotState();
  takeShot(shotState, "final", finishOffset);
  // 4. 悬空任务：最后一次开始之后没有完成/跳过记录。BAAH 失败即中断，悬空即失败任务。
  const lastStartIndex = {};
  events.forEach((event, i) => {
    if (event.type === "start") lastStartIndex[event.name] = i;
  });
  function completedAfter(name, index) {
    for (let j = index + 1; j < events.length; j++) {
      const event = events[j];
      if ((event.type === "end" || event.type === "skip") && event.name === name) return true;
    }
    return false;
  }
  const dangling = [];
  for (const name of Object.keys(lastStartIndex)) {
    if (!completedAfter(name, lastStartIndex[name])) {
      dangling.push({ name, index: lastStartIndex[name] });
    }
  }
  dangling.sort((a, b) => b.index - a.index);

  if (dangling.length === 0) {
    // 5. 无悬空任务：全部已开始任务都已收尾。
    if (!hasError) {
      console.log(JSON.stringify({ status: "success", reason: "BAAH 任务运行结束" }));
    } else {
      // 有错误提示但无悬空任务：错误发生在任务活动之后（收尾/清理噪音）→ 成功；
      // 全程未启动任何任务（连接模拟器/游戏等启动期失败）→ failed。
      const firstStart = events.findIndex(event => event.type === "start");
      if (firstStart < 0) {
        console.log(JSON.stringify({ status: "failed", reason: "BAAH 未进入任务执行即异常结束（错误提示见运行日志）" }));
      } else {
        console.log(JSON.stringify({ status: "success", reason: "BAAH 任务运行结束（过程中出现过错误提示，已由脚本自行处理）" }));
      }
    }
  } else {
    // 6. 悬空任务 → 反查配置任务键（精确命中优先，其次映射表；一类多键时全部保留开启）。
    const failedKeys = [];
    const unknownNames = [];
    for (const item of dangling) {
      let keys = pipelineNames && pipelineNames.indexOf(item.name) >= 0 ? [item.name] : null;
      if (!keys) keys = LOG_TO_CONFIG[item.name] || null;
      if (keys) {
        for (const key of keys) {
          if (failedKeys.indexOf(key) < 0) failedKeys.push(key);
        }
      } else {
        unknownNames.push(item.name);
      }
    }
    if (failedKeys.length > 0 && pipelineNames) {
      // 7. 选择性重试：仅失败配置任务保持开启；首次触发写 boolArray 还原描述，
      //    宿主收尾按其还原用户原始 TASK_ONOFF 后再同步快照；跨尝试只写一次。
      const restoreExists = nexus.listFiles().some(p => p.toLowerCase().endsWith("config-restore.json"));
      if (!restoreExists) {
        const initial = pipelineNames.map((name, i) => pipelineOnoff[i] === true);
        const group = cfg.TASK_ORDER_GROUP;
        let index = 0;
        if (typeof group.ACTIVATE_IND === "number" && Number.isInteger(group.ACTIVATE_IND)) {
          index = group.ACTIVATE_IND;
        }
        nexus.writeFile("config-restore.json", JSON.stringify({
          files: [{
            file: cfgRelPath,
            toggles: [{
              type: "boolArray",
              path: "TASK_ORDER_GROUP.ALL_PIPELINES[" + index + "].TASK_ONOFF",
              initial: initial
            }]
          }]
        }));
      }
      activePipeline.TASK_ONOFF = pipelineNames.map(name => failedKeys.indexOf(name) >= 0);
      nexus.writeFile(cfgRelPath, JSON.stringify(cfg, null, 2));
      console.log(JSON.stringify({
        status: "failed",
        reason: "任务失败：" + failedKeys.join("、") + "，已调整为仅重试失败任务",
        replaceConfigs: [cfgRelPath]
      }));
    } else {
      const shown = (unknownNames.length > 0 ? unknownNames : dangling.map(item => item.name)).join("、");
      console.log(JSON.stringify({
        status: "failed",
        reason: "任务失败：" + shown + "（无法对应到配置任务，未调整重试；下一轮整体重跑）"
      }));
    }
  }
}
