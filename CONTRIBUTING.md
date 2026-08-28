# 贡献指南

感谢为 NexusPipeline 编写插件。提交前请先确认适配目标、许可证和可公开分发的数据范围，再开始编写插件。

## 目录与命名

- 插件目录使用稳定的小写机器标识，例如 `bettergi`、`maaend`。
- `plugin.json` 中的 `name` 必须与插件目录名、`catalog.json` 条目名称和发行包名称保持一致。
- `displayName` 面向 UI，修改展示文字不应改变 `name`。
- 插件版本使用独立的 SemVer 风格版本字符串，例如 `0.1.0`；宿主最低版本写在 catalog 的 `minHostVersion`。
- `data-specialized` 插件使用 `resolve`、`judgeScript` 和可选配置模板；`managed-code` 插件使用独立 .NET 项目、`entryAssembly`、`entryType` 与 Plugin API `1.3`。前端能力与插件类型正交，按需在 manifest 中声明 Frontend API `1.1`。

## 开发流程

1. 从现有插件中选择运行目录结构相近的参考实现。
2. 创建 `plugins/<name>/`，按插件类型补齐 manifest、data 资源或 .NET 项目。
3. 数据化插件在目标软件目录验证 profile 推导；代码插件构建并验证入口程序集、依赖和 Plugin API 版本。
4. 验证运行语义、错误处理、用户数据隔离和敏感数据边界。
5. 检查配置模板、源码和发行包不含个人数据。
6. 若使用前端能力，校验 `frontend-module` capability、Frontend API `1.1`、`web/` 入口/样式、同源 DOM 行为和信任提示；确认公开资源不包含配置、密钥、程序集或调试符号。
7. 更新插件版本；需要发布时再生成 ZIP、计算 SHA256、更新 catalog，并按单插件 Release 规则创建独立 tag。

详细字段约定见 [数据化专项插件开发指南](docs/DATA_SPECIALIZED_PLUGIN.md)，判断脚本约定见 [JUDGE_SCRIPT.md](docs/JUDGE_SCRIPT.md)，代码插件接口约定见 [NexusPipeline Plugin API](https://github.com/FlappiBakuse/NexusPipeline/blob/main/docs/PLUGIN_API.md)，前端模块约定见 [FRONTEND_PLUGIN.md](docs/FRONTEND_PLUGIN.md)。`game-checkin` v0.1.2 使用 API v1.2，并声明旧身份替换迁移。

## 发布规则

- 一个 GitHub Release 只对应一个插件和一个插件版本，发行资产只上传该插件的一个 ZIP。
- Release tag 使用 `<plugin-name>-v<version>`，例如 `game-checkin-v0.1.2`；ZIP 文件名使用 `<plugin-name>-<version>.zip`。
- `catalog.json` 的 `packageUrl`、`version`、`sha256` 和 `sizeBytes` 必须与该 Release 资产逐项一致。
- 历史 `v0.1.0` 组合 Release 保留不变；新版本创建插件独立 tag，不向历史组合 Release 追加资产。

## 本地检查

提交前至少执行以下检查：

```powershell
# 检查 JSON 语法（PowerShell 7）
Get-ChildItem -LiteralPath . -Recurse -Filter *.json |
  ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json | Out-Null }

# 检查单个发行包内容
tar -tf packages\<name>-<version>.zip

# 计算发行包摘要
Get-FileHash packages\<name>-<version>.zip -Algorithm SHA256
```

managed-code 插件还应在 `plugins/<name>/src/` 执行 `dotnet build --no-restore`，确认发行包包含 manifest、入口 DLL 及所需依赖。带前端的插件还应确认 ZIP 中入口与 styles 所列文件均位于 `web/`，浏览器能加载 ES module/CSS，撤销信任后模块不再加载。

在 Windows PowerShell 5.1 中，可以使用 `python -m json.tool <file>` 逐个检查 JSON；本机必须已经安装 Python。仓库当前没有独立的构建程序，插件有效性还需要使用 NexusPipeline 的插件发现、脚本探测和真实运行流程验证。

建议至少覆盖：

- manifest 的 `name`、`kind`、版本和 data 引用；
- `resolve.json` 的每个 `require` 条件；
- 根目录、嵌套目录和 `searchUpward` 场景；
- 配置路径为文件与目录的场景；
- judge 尚未完成、成功、失败、超时和异常输出；
- `replaceConfigs` 与 `config-restore.json` 的恢复结果。

## 判断脚本审查

判断脚本会反复收到累计日志和当前文件清单。代码应满足：

- 输入不完整时无输出，保守等待；
- 结果 JSON 的 `status` 只能是 `success` 或 `failed`；
- `reason` 非空并适合展示给用户；
- 重复调用不会持续修改配置或重复生成不同的恢复状态；
- 选择性重试同时设计配置替换和最终恢复；
- stdout 不输出 Token、密码、完整配置或敏感日志。

Python judge 具备系统解释器权限，必须按受信任代码进行审查。详见 [JUDGE_SCRIPT.md](docs/JUDGE_SCRIPT.md)。

## 提交内容清单

Pull Request 应包含：

- 插件源码目录；
- 公开、可复现的 resolve 与 judge 说明；
- 需要时的默认配置模板；
- 插件版本变化及兼容宿主版本；
- 本地验证结果和已知兼容限制；
- 发布版本需要的 ZIP、catalog 元数据和摘要校验。

禁止提交：

- 用户配置、账号信息、Cookie、Token、密钥和个人路径；
- 运行日志、缓存、临时目录和开发机生成的无关文件；
- 与发行包内容不一致的 SHA256 或 `sizeBytes`；
- 未经许可重新分发的第三方二进制或资源。

## 维护约定

插件行为变化时提高插件自身版本，并在 PR 中说明对已有脚本实例 profile、用户配置和判断脚本的影响。宿主 API 变化时同步检查 `minHostVersion`，避免插件索引允许安装到不支持所需契约的宿主版本。
