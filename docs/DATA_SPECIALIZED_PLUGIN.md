# 数据化专项插件开发指南

数据化专项插件由静态目录组成。宿主发现插件后，根据 `resolve.json` 从用户选择的脚本根目录推导当前运行 profile；`judge.js` 或 `judge.py` 保持为插件资产，由每次运行/编辑解析并在本次操作开始时冻结。

宿主运行时契约的完整定义位于 [NexusPipeline Plugin API](https://github.com/FlappiBakuse/NexusPipeline/blob/main/docs/PLUGIN_API.md)。本指南记录插件仓库作者最常用的目录、字段和验证方法。

## 最小目录

```text
plugins/Example/
├── plugin.json
├── store.json
└── data/
    ├── resolve.json
    ├── judge.js
    └── config-validator.js
```

上例中的 `Example` 仅是文档占位标识；实际插件目录必须使用正式大小写的 `artifactName`，`plugin.json` 的 `name` 使用仓库内唯一的小写机器标识。

`plugin.json` 引用的文件必须位于插件目录内，并随发行 ZIP 一起提供。

## plugin.json

一个数据化专项插件可以从下面的结构开始：

```json
{
  "schemaVersion": 2,
  "name": "example",
  "artifactName": "Example",
  "displayName": "Example Assistant",
  "gameName": "示例游戏",
  "description": "示例专项脚本实例配置接管",
  "version": "0.1.0",
  "kind": "data-specialized",
  "minHostVersion": "0.11.6",
  "capabilities": [],
  "resolve": "data/resolve.json",
  "judgeScript": "data/judge.js",
  "configValidator": "data/config-validator.js"
}
```

### 字段

| 字段 | 用途 | 约束 |
|---|---|---|
| `schemaVersion` | manifest 格式版本 | 当前仓库与宿主均使用 `2` |
| `name` | 稳定机器标识，保存到脚本实例 `PluginType` | 必须使用小写 kebab-case：`^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `artifactName` | 源码、安装和发行文件系统身份 | ASCII 字母/数字，首字符为字母，至少包含一个大写字母；必须与源码目录完全一致 |
| `displayName` | UI 展示名称 | 建议提供 |
| `gameName` | UI 中的游戏名称 | 建议提供 |
| `description` | 插件说明 | 建议提供 |
| `version` | 插件自身版本 | 与宿主版本独立；使用三段 SemVer |
| `minHostVersion` | 最低宿主版本 | 使用三段 SemVer |
| `kind` | 插件类型 | 数据化专项插件使用 `data-specialized` |
| `capabilities` | 能力 key 列表 | 例如 `emulator` |
| `resolve` | 推导规则文件，相对插件目录 | 文件必须存在 |
| `judgeScript` | 判断脚本，相对插件目录 | 文件必须存在；扩展名决定语言 |
| `configValidator` | 配置编辑完成后的可选配置校验与自修复脚本，相对插件目录 | 仅 `data-specialized` 可声明；必须是插件目录内存在的 `.js` 文件 |

宿主加载数据化插件时，`name`、`resolve`、`judgeScript` 以及被引用的文件是进入专项插件集合的必要条件。JSON 解析失败或引用文件缺失时，插件会被记录为加载失败并跳过。

`configValidator` 是可选能力，不影响没有声明该字段的插件。配置编辑提交成功后，宿主将当前脚本实例、用户和文件快照以稳定 DTO 放入 `nexus.input`，再执行校验脚本。脚本工作根目录固定为当前用户的配置 store，只能通过相对路径访问其中的文件；保存结果不会因为脚本语法、运行时或超时错误回滚，脚本已经写入的文件也会保留。取消配置编辑不会执行校验脚本。

脚本可使用以下宿主 API：

| API | 作用 |
|---|---|
| `nexus.listFiles()` | 返回 store 内的相对文件路径列表 |
| `nexus.readFile(path)` | 读取一个相对文件；无法读取时返回 `null` |
| `nexus.writeFile(path, content)` | 以单文件原子替换方式写入文本并返回成功状态 |
| `nexus.exists(path)` | 检查相对文件是否存在 |
| `nexus.toast(message, kind)` | 排队本次结果中的短提示 |
| `nexus.notify(title, body, kind)` | 排队本次结果中的角落通知 |

校验脚本使用内置 Jint 执行，受执行时长、单文件读写大小、文件列表和反馈数量限制。脚本没有删除、网络、进程、PowerShell、Node.js、Python、CLR 或环境变量 API；路径必须保持在当前 store 内。建议将修复逻辑设计为幂等操作，并在输入文件缺失、内容不完整或格式错误时保守返回。

`name` 参与脚本实例、catalog 和运行时状态关联；`artifactName` 参与文件系统路径和发行包名称。改动 `name` 会使现有脚本实例无法继续关联，需要按新插件身份重新配置。改动 `artifactName` 需要同步源码目录、包目录和 ZIP 名称。

## resolve.json

### 基本结构

```json
{
  "require": [
    { "var": "launcher", "file": "Example Launcher.exe" },
    { "var": "assistant", "file": "Example Assistant.exe", "searchUpward": true }
  ],
  "paths": {
    "mainExe": "{launcher}",
    "args": "{rel:assistant}",
    "configPath": "config",
    "logPath": "logs/{YYYY-MM-DD}.log"
  }
}
```

`paths` 中的 `mainExe`、`args`、`configPath`、`logPath` 都应提供明确值。`mainExe` 解析后必须指向真实存在的文件，其他路径由宿主在运行和配置编辑阶段继续解析。`logPath` 允许为空字符串：为空表示目标软件没有专用日志文件，判定日志改由进程标准输出提供（宿主 v0.14.0+）。

### require

每一项用于确认用户选择的脚本根目录是否属于当前软件：

| 字段 | 说明 |
|---|---|
| `file` | 相对于候选脚本根目录的文件名或相对路径 |
| `var` | 将找到的文件绝对路径保存为占位符变量 |
| `searchUpward` | 当前根目录找不到时，逐级向父目录查找 |

所有 `require` 项都必须满足，推导才会成功。`searchUpward: true` 最多向上查找 4 层；它适合启动器和执行器分置于同一软件目录树的情况。没有 `searchUpward` 时只检查脚本根目录下的路径。

### inputs（可选，用户输入变量）

当目标软件的启动参数依赖用户自定的内容（例如配置文件名字完全由用户命名）时，用 `inputs` 声明用户输入变量。脚本实例按声明保存用户填写值，宿主在专项脚本弹窗中按声明渲染输入表单，并在推导时把模板中的 `{input:名称}` 替换为用户值（宿主 v0.14.0+）：

```json
{
  "inputs": [
    {
      "name": "config",
      "label": "配置文件名",
      "description": "配置目录下的配置文件名（含 .json 后缀）",
      "default": "config.json",
      "required": true,
      "pattern": "^.+\\.json$"
    }
  ],
  "require": [
    { "var": "main", "file": "Example.exe" }
  ],
  "paths": {
    "mainExe": "{main}",
    "args": "{input:config}",
    "configPath": "configs/{input:config}",
    "logPath": ""
  }
}
```

| 字段 | 说明 |
|---|---|
| `name` | 变量名；字母开头的字母/数字/下划线，插件内不得重复 |
| `label` / `description` | 前端表单的显示名与说明 |
| `default` | 用户未填写时的默认值 |
| `required` | 被模板引用、无 default 可回退且用户未提供时，推导失败并在保存时提示 |
| `pattern` | 可选的整串正则校验 |

- `{input:名称}` 是内联替换，可与相对路径文本自由组合（如 `configs/{input:config}`、`--config {input:config}`）；`{var}`/`{rel:var}` 仍是整项替换，且一个字段内不可与 `{input:}` 混用。
- 宿主对所有用户输入值做基线净化：拒绝路径分隔符、冒号、相对路径段、通配符、花括号和控制字符，防止 configPath 拼接越界。
- 用户值会参与 profile 解析结果与指纹，修改输入值等同于修改脚本实例配置。
- configPath 模板引用单个输入时，宿主会自动绑定配置目录：目录内只有一个配置文件时自动以它作为绑定值（无需填写输入，配置改名后自动跟随）；输入声明的目标存在时以声明为准。目录内存在多个配置文件且输入未指定时，复用配置编辑（首次编辑选择「复用配置文件」）会在启动时列出全部配置供用户显式选择，采用后实例配置名更新为该值并继续编辑；因此 inputs 无需为多配置场景设置默认值。

### paths 与占位符

- `{var}` 解析为 `require` 找到的文件绝对路径。
- `{rel:var}` 解析为相对于脚本根目录的路径；同目录结果带 `.` 前缀，适合传给启动器的相对参数。
- `{input:名称}` 替换为用户输入值，可与路径文本内联组合（见 inputs 一节）。
- 没有占位符的路径字段按脚本根目录拼接。
- `args` 没有占位符时保持原样，包含占位符时按路径变量解析。
- 一个字段最多使用一个 `{var}`/`{rel:var}` 占位符。这类占位符是整项路径推导，模板中附加的文字不会与替换值拼接；组合路径请改用无占位符的相对路径、拆分为独立字段或改用 `{input:}` 内联替换。
- 日期格式和 `*` 通配符用于日志路径时，由宿主日志路径解析器在运行时处理，例如 `logs/{YYYY-MM-DD}.log`；目标软件的日志文件名带滚动日期后缀时（如 BetterGI 按天滚动写入 `better-genshin-impact<日期>.log`），使用 `log/better-genshin-impact*.log` 这样的通配匹配当前文件。

推荐让 `mainExe` 直接使用 `{main}`，并让 `require` 同时负责识别和存在性校验：

```json
{
  "require": [
    { "var": "main", "file": "Example.exe" }
  ],
  "paths": {
    "mainExe": "{main}",
    "args": "--start",
    "configPath": "config",
    "logPath": "logs/{YYYY-MM-DD}.log"
  }
}
```

## profile 与脚本实例

专项脚本实例的持久身份由 `PluginType` 与 `RootPath` 组成，用户声明和宿主运行策略写入 `scripts.json`。宿主在 API 展示、执行准入、配置编辑和运行计划构建时，读取当前插件版本并解析有效 profile：

- `MainExe`
- `Args`
- `ConfigPath`
- `LogPath`
- `JudgeScriptLanguage` 与 `JudgeScript` 由插件 manifest 指向的当前判断脚本资产确定

判断脚本输出 `success`、`partial` 或 `failed`。`partial` 只能由判断脚本主动返回，是终局结果，不触发重试，也不计入绑定的每日成功次数；宿主不会从日志文本、退出码或尝试次数推导该状态。

专项脚本实例启用自动配置更新，并使用当前插件提供的判断脚本。单次运行或编辑开始后，宿主会固定本次有效路径、判断脚本内容和 profile 指纹；插件更新会自动作用于后续新运行与新编辑，无需用户重新保存脚本实例。已经触发的调度 occurrence 延续触发时冻结的运行计划。

修改 `resolve.json` 或判断脚本会影响后续运行；修改 `configPath` 或文件/目录形态会触发宿主的一次性配置快照重绑定策略：旧快照先隔离保留，新位置成功物化后恢复为唯一权威快照，新位置缺失时本次运行会被阻断。插件发布说明必须明确列出用户配置影响和恢复建议。

当专项插件缺失、禁用或类型不匹配时，宿主会在脚本修改、用户绑定、配置编辑和队列写入等入口执行服务端门禁；删除脚本、解除绑定和移除队列任务等清理操作保持可用。

## 配置编辑与快照

宿主 v0.12.8 起绑定脚本实例不再建立配置快照：

- `configPath` 可以是文件或目录；目录型配置整体参与快照交换（如 BetterGI 的 `User/OneDragon`）。
- 用户首次编辑配置且尚无快照时，宿主要求其选择「全新配置文件」（移走原配置，由目标软件生成全新配置）或「复用配置文件」（直接编辑现有配置）；插件无需携带默认配置资产。
- 首次运行时宿主自动把现场配置复制为初始快照。
- 运行后的自动更新按文件差异写入唯一权威快照；失败时保留旧快照与事务恢复现场，不创建完整重试快照。
- 需要选择性重试时，请使用 `replaceConfigs` 和 `config-restore.json`，详见 [JUDGE_SCRIPT.md](JUDGE_SCRIPT.md)。

## 发布前检查

- 插件目录名与 manifest `artifactName` 严格一致，manifest `name` 使用小写机器标识。
- `kind` 为 `data-specialized`，`resolve` 和 `judgeScript` 文件存在；若声明 `configValidator`，对应脚本也必须存在。
- 所有 `require` 在目标软件目录中都能找到，向上搜索不超过 4 层。
- `mainExe` 能解析到真实文件。
- `configPath` 与 `logPath` 的相对位置和日期/通配规则符合目标软件。
- judge 的语言扩展名、输入读取方式和输出 JSON 符合 [判断脚本指南](JUDGE_SCRIPT.md)。
