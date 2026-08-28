# 贡献指南

感谢为 NexusPipeline 编写专项适配。提交前请先确认适配目标、许可证和可公开分发的数据范围，再开始编写插件。

## 目录与命名

- 插件目录使用稳定的小写机器标识，例如 `bettergi`、`maaend`。
- `plugin.json` 中的 `name` 必须与插件目录名、`catalog.json` 条目名称和发行包名称保持一致。
- `displayName` 面向 UI，修改展示文字不应改变 `name`。
- 插件版本使用独立的 SemVer 风格版本字符串，例如 `0.1.0`；宿主最低版本写在 catalog 的 `minHostVersion`。

## 开发流程

1. 从现有插件中选择运行目录结构相近的参考实现。
2. 创建 `plugins/<name>/`，补齐 manifest、resolve 和 judge。
3. 在真实的目标软件目录上验证 `require` 条件、启动路径、配置路径和日志路径。
4. 验证判断脚本的等待、成功、失败和重复调用行为。
5. 检查配置模板不含个人数据，并确认模板目录结构与 `configPath` 类型相符。
6. 更新插件版本；需要发布时再生成 ZIP、计算 SHA256 和更新 catalog。

详细字段约定见 [数据化专项插件开发指南](docs/DATA_SPECIALIZED_PLUGIN.md)，判断脚本约定见 [JUDGE_SCRIPT.md](docs/JUDGE_SCRIPT.md)。

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
