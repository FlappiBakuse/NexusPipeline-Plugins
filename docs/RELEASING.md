# 插件打包与发布指南

NexusPipeline-Plugins 的插件版本、发行包和 catalog 必须保持同一份可校验的发布事实。宿主通过 catalog 的包地址、SHA256、大小和最低宿主版本判断是否可以安装。

## 发布前准备

确认以下内容：

- plugins/<name>/plugin.json 的 name、version、kind 与目标发行版本一致；
- resolve、judgeScript 和可选模板目录都位于插件目录内；
- require、主程序路径、配置路径和日志路径已在目标软件目录验证；
- judge 的输出、超时和配置替换行为已验证；
- ZIP 不包含账号、Token、Cookie、用户配置、日志、缓存和仓库外文件；
- minHostVersion 与实际使用的宿主契约匹配。

## 发行包布局

发行包名为：

~~~text
<name>-<version>.zip
~~~

ZIP 根目录直接放插件内容：

~~~text
plugin.json
data/resolve.json
data/judge.js 或 data/judge.py
data/config-template/...
~~~

当前官方包示例：

~~~text
bettergi-0.1.0.zip
├── plugin.json
└── data/
    ├── resolve.json
    ├── judge.js
    └── config-template/NexusPipeline.json
~~~

ZIP 根目录不再套一层 bettergi/ 目录，避免宿主解压后找不到 plugin.json。

## 推荐发布顺序

1. 修改 plugins/<name>/ 内容。
2. 更新 plugin.json 中的插件自身版本。
3. 在目标软件目录中运行探测，确认 profile 结果。
4. 校验 JSON、judge 语法、模板内容和相对路径。
5. 按发行包布局生成 <name>-<version>.zip。
6. 计算最终 ZIP 的 SHA256 和字节数。
7. 将最终 ZIP 放入 packages/。
8. 更新 catalog.json 中对应条目的版本、packageUrl、sha256、sizeBytes 和必要的 minHostVersion。
9. 再次校验 catalog 与 manifest 的名称、版本、类型一致。
10. 创建 GitHub Release，并上传与 catalog 完全一致的 ZIP。
11. 通过 NexusPipeline 的插件商店流程验证安装或更新，再验证重启后的运行状态。

摘要和大小必须针对最终上传的 ZIP 计算。重新压缩、修改文件顺序或改变 ZIP 元数据都会改变摘要；任何改动后都要重新计算。

## catalog.json

当前 catalog 的根结构：

~~~json
{
  "schemaVersion": 1,
  "repository": "FlappiBakuse/NexusPipeline-Plugins",
  "generatedAt": "2026-08-27T00:00:00Z",
  "plugins": []
}
~~~

每个插件条目至少包含：

| 字段 | 说明 |
|---|---|
| name | 与 manifest 和目录一致的机器标识 |
| displayName | UI 名称 |
| gameName | 游戏名称 |
| description | 插件说明 |
| version | 与 manifest 版本一致 |
| kind | 当前专项插件为 data-specialized |
| apiVersion | 需要时填写宿主 API 版本；数据化插件当前可为空字符串 |
| capabilities | 能力 key 列表，例如 emulator |
| minHostVersion | 最低兼容宿主版本 |
| packageUrl | 指向该版本 GitHub Release 资产的 URL |
| sha256 | ZIP 的 64 位小写十六进制 SHA256 |
| sizeBytes | ZIP 的实际字节数 |

catalog.plugins[].name、version、kind 与插件包内 manifest 必须一致。catalog 允许宿主提前筛掉版本不兼容或完整性信息不完整的包。

## Windows 检查示例

~~~powershell
# 语法检查
Get-Content -Raw -LiteralPath plugins\<name>\plugin.json | ConvertFrom-Json | Out-Null
Get-Content -Raw -LiteralPath plugins\<name>\data\resolve.json | ConvertFrom-Json | Out-Null

# 查看 ZIP 内容
tar -tf packages\<name>-<version>.zip

# 计算摘要和大小
$package = Get-Item -LiteralPath packages\<name>-<version>.zip
Get-FileHash -LiteralPath $package.FullName -Algorithm SHA256
$package.Length
~~~

结果应能确认：ZIP 根有 plugin.json，必需的 data 文件均在包内，摘要和大小与 catalog 相同。

## Release 核对

发布页面完成后，逐项核对：

- 资产文件名与 packageUrl 末尾一致；
- 下载后的 ZIP SHA256 与 catalog 一致；
- 下载后的字节数与 sizeBytes 一致；
- 宿主安装后能够发现 manifest；
- /api/status 中插件名称、版本、类型和运行状态符合预期；
- 重启宿主后专项脚本实例仍能按 profile 运行。

发现包内容、Release 资产和 catalog 任一项不一致时，应重新生成包并同步所有校验字段，再进行发布。

## 版本维护

插件行为、判断脚本、resolve 规则或默认模板发生影响用户的变化时，提高插件自身版本并在发布说明中记录迁移提示。宿主最低版本随使用的 Plugin API 能力调整；旧插件实例中的 profile 由用户重新探测或保存后更新。
