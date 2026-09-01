# 专项判断脚本指南

专项判断脚本用于在脚本进程运行期间判断任务是否完成，以及在失败时请求下一次尝试使用替换配置。它会被宿主周期调用，并接收当前尝试的累计日志与文件清单。

脚本实例保存专项 profile 时，宿主会把插件中的判断脚本写入 JudgeScript，并按文件扩展名设置 JudgeScriptLanguage：

- .js：宿主内置 Jint 引擎；
- .py：宿主启动系统 python.exe 子进程。

运行时语义以 [NexusPipeline Plugin API](https://github.com/FlappiBakuse/NexusPipeline/blob/main/docs/PLUGIN_API.md) 和宿主对应版本的 JudgeScriptRunner、SessionJudge 实现为准。

## 三种结果

### 继续等待

没有足够证据时不要输出最终结果 JSON。脚本可以读取输入后自然结束，宿主会把空结果视为“本轮尚未判定”，继续收集日志并再次调用。

~~~js
const input = JSON.parse(__NEXUS_INPUT__);
const log = input.log || "";

if (log.indexOf("一轮任务完成") >= 0) {
  console.log(JSON.stringify({
    status: "success",
    reason: "任务已完成"
  }));
}
~~~

### 成功

~~~json
{
  "status": "success",
  "reason": "全部任务执行成功"
}
~~~

### 失败

~~~json
{
  "status": "failed",
  "reason": "检测到任务失败"
}
~~~

status 只能使用 success 或 failed，reason 必须为非空字符串。可选的 notifyText 会作为额外通知文本，notifyScreenshotId 用于选择脚本通知附带的截图，replaceConfigs 用于声明需要在下一次失败重试前应用的配置文件。

判断脚本模式启用后，脚本判断优先于成功/失败关键字模式。专项插件提供的脚本实例会启用该模式；通用脚本仍可以独立使用自己的判断脚本。

## 输入 JSON

### JavaScript

宿主将完整 JSON 字符串注入全局变量 __NEXUS_INPUT__：

~~~js
const input = JSON.parse(__NEXUS_INPUT__);
~~~

### Python

宿主执行：

~~~text
python.exe <temporary-judge.py> <temporary-input.json>
~~~

第一个脚本参数 sys.argv[1] 是输入 JSON 文件路径：

~~~python
import json
import sys

with open(sys.argv[1], encoding="utf-8") as stream:
    input_data = json.load(stream)
~~~

### 字段

| 字段 | 内容 |
|---|---|
| script | 当前脚本实例的运行字段，包括 Id、Name、PluginType、RootPath、MainExe、Args、ConfigPath、LogPath、超时和通知设置等 |
| user | 当前用户；无特定用户运行时为 null |
| RootPath | 脚本实例根目录 |
| ConfigPath | 运行时生效配置的文件或目录 |
| scriptDir | 本次运行专用的 script 工作目录 |
| files | config 与 script 范围内的文件元数据数组 |
| log | 当前尝试累计日志；超过 4 MiB 时只保留尾部 |
| logTruncated | 日志是否发生截断 |
| timeScale | 宿主测试加速因子；生产运行通常为 1 |
| screenshots | 当前 Attempt 截图池的元数据；最多 8 张，包含 Id、Ordinal、CapturedAt、AttemptNumber、Width、Height、Source、Trigger，不包含图片字节 |

files 中每项包含：

~~~json
{
  "Root": "config",
  "Path": "mxu-MaaEnd.json",
  "Abs": "C:\\...\\mxu-MaaEnd.json"
}
~~~

Root 为 config 或 script；Path 是相对于对应根目录的路径；Abs 是宿主当前进程可定位的绝对路径。文件清单只提供元数据，文件内容需要用 JavaScript API 读取，或由 Python 按输入中的路径读取。

输入中的 log 是当前尝试日志，不应假设脚本只会被调用一次。判断代码应能处理重复调用、日志追加和日志文件轮换。

## 运行期截图

一次「脚本实例 × 用户」运行按 Attempt 分别维护内存截图池；每个 Attempt 最多保存 8 张，新截图超过容量时移除该 Attempt 最早的一张。截图来源为游戏窗口客户区或模拟器画面，保持原始像素宽高并编码为高质量 JPEG。运行收尾时，当前保留截图写入本轮运行的 history 目录。

关键字模式会在首次接受成功/失败关键字判定时自动截图；判断脚本模式会在首次接受 `status: "success"` 或 `"failed"` 时自动截图。判断脚本也可以主动截图，所有主动和自动截图共用同一个池。

## JavaScript API

宿主在 Jint 中提供以下对象：

~~~js
nexus.readFile(absPath)
nexus.writeFile(relativePath, content)
nexus.listFiles()
nexus.captureScreenshot()
console.log(value)
~~~

### nexus.captureScreenshot()

在判断脚本执行期间随时调用，返回新截图的 ID；采集失败时返回空字符串并记录宿主警告。截图完成后可从下一次输入的 `screenshots` 元数据中读取其 ID 和尺寸。

Python 判断脚本的输入在需要时包含 `screenshotApi.endpoint` 与 `screenshotApi.token`。向 endpoint 发送 `POST` 请求，并设置 `X-Nexus-Screenshot-Token` 请求头，即可主动截图：

~~~python
import json
import urllib.request

api = input_data.get("screenshotApi")
if api:
    request = urllib.request.Request(
        api["endpoint"],
        method="POST",
        headers={"X-Nexus-Screenshot-Token": api["token"]},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        screenshot_id = json.load(response).get("id", "")
~~~

该 endpoint 仅监听本机回环地址，token 为当前判断脚本调用临时生成，调用结束后失效。不要输出 token 或把 endpoint 传给其他进程。

### nexus.readFile(absPath)

读取 input.files 中属于 config 或 script 范围的文件。推荐先按 Root 和 Path 找到目标，再把该项的 Abs 传入：

~~~js
const input = JSON.parse(__NEXUS_INPUT__);
const entry = (input.files || []).find(file =>
  file.Root === "config" && file.Path === "mxu-MaaEnd.json");

let config = null;
if (entry) {
  try {
    config = JSON.parse(nexus.readFile(entry.Abs));
  } catch (_) {
    config = null;
  }
}
~~~

宿主只允许读取 config/script 根目录内的文件，单文件读取上限为 2 MiB。越界、文件不存在或读取失败时返回空值并记录警告。

### nexus.writeFile(relativePath, content)

写入 script 工作目录内的相对路径：

~~~js
nexus.writeFile("mxu-MaaEnd.json", JSON.stringify(config, null, 2));
nexus.writeFile("state/attempt.json", JSON.stringify({ attempt: 1 }));
~~~

禁止绝对路径、.. 路径和逃逸 script 工作目录的写入。该 API 返回写入是否成功；写入失败时应保守等待或输出可读失败原因。

### nexus.listFiles()

返回宿主允许范围内的绝对路径数组。它适合检测跨多次调用生成的辅助文件：

~~~js
const restoreExists = nexus.listFiles().some(path =>
  path.toLowerCase().endsWith("config-restore.json"));
~~~

### console.log(value)

输出会被宿主收集。调试信息可以输出，但最终结果应使用单行 JSON，且 reason 面向最终用户。不要向 stdout 写入 Token、密码或完整敏感配置。

## 输出解析

宿主从输出尾部向前查找第一个满足以下条件的 JSON 行：

- JSON 顶层是对象；
- status 为 success 或 failed；
- reason 非空。

其他输出会被忽略。没有合法结果时，本轮保持等待；语法错误、解释器异常和 30 秒超时会记录判断脚本错误，并沿用继续运行语义。

判断脚本单次执行上限为 30 秒，属于真实墙钟时间，不按测试 timeScale 缩放。应避免全盘扫描、无限循环和一次性解析超大文件。

### 通知截图选择

输出示例：

~~~json
{
  "status": "success",
  "reason": "全部任务执行成功",
  "notifyScreenshotId": "screenshot-0000000003"
}
~~~

`notifyScreenshotId` 留空时，宿主选择最终 Attempt 中仍保留的最新截图；填写已不存在、已被 FIFO 淘汰或属于其他 Attempt 的 ID 时不附图，并记录警告。截图池在脚本实例通知完成后释放。调度队列汇总通知不附带运行截图。

## Python 信任边界

Python judge 由系统解释器作为外部进程运行。它不具备 Jint 的语言运行时隔离；Python 代码按当前宿主进程权限运行，可以使用普通 Python 能力访问文件、启动进程或访问网络。

因此：

- 官方仓库中的 Python judge 需要按受信任代码审查；
- 不要把不可信用户输入拼接为 shell 命令；
- 不要把账号凭据写入临时文件或输出；
- input_data["scriptDir"]、input_data["ConfigPath"] 等路径应先按业务范围校验；
- Python 与 JavaScript 的可用 API 不同，Python 使用标准库文件操作时必须承担对应权限责任。

## replaceConfigs

失败结果可以携带替换文件：

~~~json
{
  "status": "failed",
  "reason": "仅重试失败任务",
  "replaceConfigs": ["mxu-MaaEnd.json"]
}
~~~

推荐流程：

1. judge 读取运行时 config；
2. 在 script 工作目录生成替换后的同名文件；
3. 输出 failed 与 replaceConfigs；
4. 宿主确认脚本进程退出后，把这些文件应用到下一次尝试的 config；
5. 下一次尝试使用替换后的配置。

replaceConfigs 中的每个路径都必须是 script 工作目录内的相对路径，并且要能在写入后被宿主找到。单文件 config 只能替换与该 config 文件名相同的文件；目录型 config 允许目录内相对路径。

宿主会在首次替换前保存原始现场，并在运行收尾时恢复被替换文件。judge 应使替换过程幂等：重复收到相同日志时，不要把配置不断改成更窄或更宽的集合。

## config-restore.json

replaceConfigs 描述下一次尝试使用的配置，config-restore.json 描述自动配置同步到用户快照前需要恢复的启停字段。它适合“临时只打开失败任务，最终保留用户原始开关”的场景。

判断脚本通常在第一次需要选择性重试时写入 script 目录根，并用 nexus.listFiles() 保证跨尝试只写一次：

~~~json
{
  "files": [
    {
      "file": "mxu-MaaEnd.json",
      "toggles": [
        {
          "type": "array",
          "path": "instances[id=main].tasks",
          "keyField": "id",
          "enabledField": "enabled",
          "initial": {
            "task-a": true,
            "task-b": false
          }
        }
      ]
    }
  ]
}
~~~

协议字段：

- files[].file：相对于 config 根目录的文件路径；
- toggles[].type：当前支持 array 与 map；
- array：按 path 找到数组，使用 keyField 匹配元素，并恢复 enabledField；
- map：按 path 找到对象，使用 initial 的键值恢复布尔值；
- initial：首次触发时捕获的键到布尔值映射。

没有还原描述的插队文件会保留旧用户快照，不参与本轮覆盖。描述解析或应用失败时，宿主也会保留旧快照。新增任务或未出现在 initial 中的键保持当前值，因此应优先使用稳定任务 ID。

### map 示例

~~~json
{
  "files": [
    {
      "file": "默认配置.json",
      "toggles": [
        {
          "type": "map",
          "path": "TaskEnabledList",
          "initial": {
            "task-guid-1": true,
            "task-guid-2": false
          }
        }
      ]
    }
  ]
}
~~~

BetterGI 的 TaskEnabledList 是 map 型参考；MaaEnd 的 instances[id=...].tasks 是 array 型参考。

## 三个常用模式

### A. 纯日志判定

只读取 input.log，检测明确的成功或失败标志，不修改配置。适用于日志生命周期稳定的工具。

### B. 配置辅助判定

从 input.files 找到配置文件，用 nexus.readFile() 读取当前启用任务，再结合日志判断最后一个任务是否完成。配置缺失或实例定位失败时保持无输出。

### C. 选择性重试

~~~text
读取原配置
→ 首次调用保存初始开关到 config-restore.json
→ 日志确认一轮结束
→ 提取失败任务
→ 在 script 目录生成只启用失败任务的配置
→ 输出 failed + replaceConfigs
→ 宿主在进程退出后应用替换并开始下一次尝试
→ 收尾同步前按 restore 描述恢复用户快照中的启停字段
~~~

## 编写准则

1. 证据不足时保持等待，避免猜测成功。
2. 只有观察到能代表完整任务生命周期结束的标志后，才输出成功或失败。
3. 配置解析失败时保守处理，避免误改用户配置。
4. 使用稳定 ID 匹配任务，少依赖易变的展示名称。
5. 选择性重试与最终恢复一起设计。
6. 处理日志截断、日志轮换和重复调用。
7. 保证多次调用幂等。
8. reason 写成用户可理解的结果，调试细节留在必要的日志中。
