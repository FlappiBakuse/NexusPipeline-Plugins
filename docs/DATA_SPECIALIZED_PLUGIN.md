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
| `capabilities` | 能力 key 列表 | 已接入宿主语义的 key：`emulator`（脚本实例可选「安卓模拟器」启动方式）、`self-managed-pc-launch`（PC 客户端启动由脚本自身含启动器完成，脚本弹窗在 PC 模式下禁用游戏启动项，宿主 v0.14.1+） |
| `resolve` | 推导规则文件，相对插件目录 | 文件必须存在 |
| `judgeScript` | 判断脚本，相对插件目录 | 文件必须存在；扩展名决定语言 |
| `configValidator` | 配置编辑完成后的可选配置校验与自修复脚本，相对插件目录 | 仅 `data-specialized` 可声明；必须是插件目录内存在的 `.js` 文件 |

宿主加载数据化插件时，`name`、`resolve`、`judgeScript` 以及被引用的文件是进入专项插件集合的必要条件。JSON 解析失败或引用文件缺失时，插件会被记录为加载失败并跳过。

`configValidator` 是可选能力，不影响没有声明该字段的插件。宿主在两个时机执行校验脚本：

- `config-edit`：配置编辑提交成功后，以当前脚本实例用户的配置 store 为主工作根目录运行一次。
- `script-save`：脚本实例保存（新建/编辑）后，按每个绑定用户逐个以其 store 为根运行（宿主 v0.14.1+），通知聚合去重后随保存响应返回。

两种时机都通过 `nexus.input.trigger` 区分。脚本工作根目录固定为当前用户的配置 store，只能通过相对路径访问其中的文件；保存结果不会因为脚本语法、运行时或超时错误回滚，脚本已经写入的文件也会保留。取消配置编辑不会执行校验脚本。

脚本可使用以下宿主 API：

| API | 作用 |
|---|---|
| `nexus.listFiles()` | 返回 store 内的相对文件路径列表（附加配置快照条目带 `@extra<序号>/` 前缀） |
| `nexus.readFile(path)` | 读取一个相对文件；无法读取时返回 `null` |
| `nexus.writeFile(path, content)` | 以单文件原子替换方式写入文本并返回成功状态（`@extra` 前缀目标被拒绝） |
| `nexus.exists(path)` | 检查相对文件是否存在 |
| `nexus.toast(message, kind)` | 排队本次结果中的短提示 |
| `nexus.notify(title, body, kind)` | 排队本次结果中的角落通知 |

`nexus.input.extras` 按声明顺序列出附加配置路径（`path`）与其用户快照文件清单（`files`）；校验脚本以 `@extra<序号>/相对路径` **只读**访问对应快照，用于与 `input.script` 的当前设置（如游戏路径）做一致性比较。校验脚本使用内置 Jint 执行，受执行时长、单文件读写大小、文件列表和反馈数量限制。脚本没有删除、网络、进程、PowerShell、Node.js、Python、CLR 或环境变量 API；路径必须保持在当前 store 与附加配置快照内。建议把校验设计为幂等的比较与提醒，并在输入文件缺失、内容不完整或格式错误时保守跳过。

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

`paths.extraConfigPaths`（可选，宿主 v0.14.1+）是附加配置文件/文件夹路径数组（相对脚本根目录，支持 `{input:名称}`）。附加路径与主配置路径一样按用户快照隔离交换（运行前快照覆盖现场、运行后与编辑提交差异入库，首次自动采用现场内容），但**判定脚本始终不可见**——`input.files`、`replaceConfigs` 与 config-restore 只作用于主 `configPath`。适用对象是软件级配置（如 BAAH 的 `DATA/CONFIGS/software_config.json`、BetterGI 的 `User/config.json`）；快照缺失宽容，现场也不存在时保持为空。

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
| `label` / `description` | 选择器与文档展示的名称与说明（宿主 v0.14.2 起不在实例表单渲染） |
| `default` | 用户未选择且绑定未设置时的默认值 |
| `required` | 被模板引用、无 default 可回退且用户未提供时，推导失败并在保存时提示 |
| `pattern` | 可选的整串正则校验 |

- `{input:名称}` 是内联替换，可与相对路径文本自由组合（如 `configs/{input:config}`、`--config {input:config}`）；`{var}`/`{rel:var}` 仍是整项替换，且一个字段内不可与 `{input:}` 混用。
- 宿主对所有用户输入值做基线净化：拒绝路径分隔符、冒号、相对路径段、通配符、花括号和控制字符，防止 configPath 拼接越界。
- 用户值会参与 profile 解析结果与指纹，修改输入值等同于修改脚本实例配置。
- configPath 模板引用单个输入时，宿主会自动绑定配置目录：目录内只有一个匹配项时自动以它作为绑定值（无需填写输入，配置改名后自动跟随）；输入声明的目标存在时以声明为准。目录内存在多个匹配项且输入未指定时，配置编辑会在启动时列出全部匹配项供用户显式选择，采用后该值保存在**用户绑定**（`configInputs`，宿主 v0.14.2+）并继续编辑——仅选中的配置文件/实例目录写入该用户快照，其他文件保持原样，多用户可各自接管不同配置；脚本实例的 `pluginInputs` 仅作为绑定未设置时的解析回退，专项实例编辑弹窗不再渲染输入表单。匹配项按「静态前缀 + * + 静态后缀」枚举，同时包括文件与子目录（目录候选服务于实例目录型配置，如 OneDragon 的 `config/{input:instance}`，宿主 v0.14.1+）；输入声明的 `pattern` 同时用于候选过滤，例如实例目录名 `^\d{2}$` 可排除 config 根下的共享数据目录与全局配置文件。

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
