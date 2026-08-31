# 数据化专项插件开发指南

数据化专项插件由静态目录组成。宿主发现插件后，根据 `resolve.json` 从用户选择的脚本根目录推导运行 profile，再把 `judge.js` 或 `judge.py` 固化到脚本实例中。

宿主运行时契约的完整定义位于 [NexusPipeline Plugin API](https://github.com/FlappiBakuse/NexusPipeline/blob/main/docs/PLUGIN_API.md)。本指南记录插件仓库作者最常用的目录、字段和验证方法。

## 最小目录

```text
plugins/Example/
├── plugin.json
├── store.json
└── data/
    ├── resolve.json
└── judge.js
```

上例中的 `Example` 仅是文档占位标识；实际插件目录必须使用正式大小写的 `artifactName`，`plugin.json` 的 `name` 使用仓库内唯一的小写机器标识。

需要默认配置时：

```text
plugins/Example/data/config-template/
└── example.json
```

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
  "configTemplate": "data/config-template"
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
| `configTemplate` | 默认配置模板目录，相对插件目录 | 可选，目录存在时才启用 |

宿主加载数据化插件时，`name`、`resolve`、`judgeScript` 以及被引用的文件是进入专项插件集合的必要条件。JSON 解析失败或引用文件缺失时，插件会被记录为加载失败并跳过。

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

`paths` 中的 `mainExe`、`args`、`configPath`、`logPath` 都应提供明确值。`mainExe` 解析后必须指向真实存在的文件，其他路径由宿主在运行和配置编辑阶段继续解析。

### require

每一项用于确认用户选择的脚本根目录是否属于当前软件：

| 字段 | 说明 |
|---|---|
| `file` | 相对于候选脚本根目录的文件名或相对路径 |
| `var` | 将找到的文件绝对路径保存为占位符变量 |
| `searchUpward` | 当前根目录找不到时，逐级向父目录查找 |

所有 `require` 项都必须满足，推导才会成功。`searchUpward: true` 最多向上查找 4 层；它适合启动器和执行器分置于同一软件目录树的情况。没有 `searchUpward` 时只检查脚本根目录下的路径。

### paths 与占位符

- `{var}` 解析为 `require` 找到的文件绝对路径。
- `{rel:var}` 解析为相对于脚本根目录的路径；同目录结果带 `.` 前缀，适合传给启动器的相对参数。
- 没有占位符的路径字段按脚本根目录拼接。
- `args` 没有占位符时保持原样，包含占位符时按路径变量解析。
- 一个字段最多使用一个占位符。占位符是整项路径推导，模板中附加的文字不会与替换值拼接；组合路径请改用无占位符的相对路径或拆分为独立字段。
- 日期格式和 `*` 通配符用于日志路径时，由宿主日志路径解析器在运行时处理，例如 `logs/{YYYY-MM-DD}.log` 或 `log/better-genshin-impact.log`。

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

宿主执行专项探测或保存专项脚本实例时，会将解析结果写入 profile：

- `MainExe`
- `Args`
- `ConfigPath`
- `LogPath`
- `JudgeScriptLanguage`
- `JudgeScript`

专项脚本实例启用自动配置更新，并使用插件提供的判断脚本。保存后的 profile 是脚本实例自己的运行数据；插件更新不会静默改写既有实例的这些字段。插件仓库后续如调整 resolve 或 judge，应通过版本说明和重新探测/保存流程指导用户处理旧实例。

当专项插件缺失、禁用或类型不匹配时，宿主会在脚本修改、用户绑定、配置编辑和队列写入等入口执行服务端门禁；删除脚本、解除绑定和移除队列任务等清理操作保持可用。

## config-template

配置模板用于配置编辑会话发现 `ConfigPath` 尚不存在时创建初始配置：

- `configTemplate` 指向一个目录；目录内容会整体复制到配置目标位置。
- 模板文件名和相对目录结构应与目标软件的配置布局一致。
- 模板是公开默认值，禁止包含账号、Token、Cookie、真实用户路径和运行日志。
- 模板复制属于配置编辑会话的一部分；取消编辑或恢复异常时，宿主按会话清单清理临时文件。
- 模板不能替代 judge 的运行时替换机制。需要选择性重试时，请使用 `replaceConfigs` 和 `config-restore.json`，详见 [JUDGE_SCRIPT.md](JUDGE_SCRIPT.md)。

BetterGI 的 `data/config-template/NexusPipeline.json` 和 MaaEnd 的两个模板可以作为目录布局参考。

## 发布前检查

- 插件目录名与 manifest `artifactName` 严格一致，manifest `name` 使用小写机器标识。
- `kind` 为 `data-specialized`，`resolve` 和 `judgeScript` 文件存在。
- 所有 `require` 在目标软件目录中都能找到，向上搜索不超过 4 层。
- `mainExe` 能解析到真实文件。
- `configPath` 与 `logPath` 的相对位置和日期/通配规则符合目标软件。
- judge 的语言扩展名、输入读取方式和输出 JSON 符合 [判断脚本指南](JUDGE_SCRIPT.md)。
- 配置模板可公开分发，ZIP 内没有仓库外文件。
