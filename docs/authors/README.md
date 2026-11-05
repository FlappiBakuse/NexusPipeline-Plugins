# 插件作者入门

SDK 固定为 0.1.0，官方插件本轮固定为 0.5.0。产品版本、格式 version 和契约指纹独立。
先阅读 [所有权](../developer/architecture.md) 和 [浏览器入口](../developer/frontend.md)。
本文直接使用仓内可构建的最小职责示例；manifest、业务源码和包只有一个维护位置，不复制成第二套实现。

## 三个可运行示例

| 类型 | 源码入口 | 练习输出 |
|---|---|---|
| managed | plugins/managed/live-screenshot/src/Host/LiveScreenshotExtension.cs | 注册 current-task provider 的程序集与安装 ZIP |
| specialized | plugins/specialized/baah/adapter/main.js 及 sources.json 的显式闭包 | Host 解释器执行的独立 adapter/main.js 与安装 ZIP |
| 浏览器 | plugins/managed/live-screenshot/frontend/src/index.ts 的 createFrontend | 使用真实 SDK transport 的 JS/CSS bundle |

managed 示例只注册端口，构造参数为 ExtensionActivationContext，实现 IExtension.ActivateAsync。
不要解析 Host 的 DI 容器、引用 Core/Platform 私有程序集或自己构造运行授权。
注册在发布前不可见，跟随激活 scope 释放。当前任务采集由 RunScreenshots 端口负责，不另建原生采集进程。
managed 代码不是安全沙箱；只安装可信作者代码。

specialized 示例是声明和受限脚本，不包含 .NET 程序集或浏览器模块。
nexusTaskAdapter 校验 format/version/direction/extensionId/phase，回传原 operationId；
执行阶段还绑定 runId、attemptId 和 planDigest。响应不能通过换 ID 变成新的权威。
发现仅使用 selected-script-root 的只读有界输入，不启动脚本或写上游配置。
配置输出声明资源及 typed selector；日志观察对照冻结任务，不从任意字符串猜测成功。
声明 specialized.readOnlySources 的 adapter 可通过 nexusReadSource(relativePath) 读取选中脚本根的 JSON/JSONC。
只允许 manifest 精确 entries 或 directories 下的 JSON 文件；缺文件返回字符串 null，存在文件返回严格校验后的 JSON。
Host 绑定真实路径、目录与文件身份，限制 128 文件、单文件 8 MiB、总量 32 MiB，并冻结实际读取内容；
观察阶段消费同一不可变闭包，不能重新读取用户目录。该入口不提供进程、写文件、网络或模块加载权限。

configuration 请求的 purpose 可为 run、editPrepare 或 editCommit；省略时沿正常运行配置处理。
原生编辑由 Host 选择用途。editorLifecycle 只声明一个已有资源的一个顶层字段及 prepareValue/commitValue；
adapter 必须回传带原 operationId、候选 revision/hash、expected value/exists 的同一字段 patch。候选 revision 为 saved revision + 1；尚无保存快照时为 1，数据库发布仍对原 saved revision 做 CAS。
Host 对照冻结声明验证完整 patch；准备只改工作副本，提交在 writer 停止及原现场恢复后处理，取消不应用 commit patch。
editorForbiddenArguments 拒绝原生编辑自动运行参数，exclusiveProgram 通过 Host 的物理资源及进程身份检查保持程序独占。
MaaEnd/MaaStellaSora 的声明和受限入口是这些能力的实际消费者；无需通用 MaaFramework 插件。
重试保留原 idempotencyKey、明确任务身份和已完成次数；技术准备步骤需按实际重启依赖重新执行，
不能因为它们不是业务任务就从重试计划中一概剔除。

浏览器示例导出 createFrontend(transport)，返回 SDK 版本、指纹和 extensionId，
在 activate 中注册 execution.running.preview。surface.context 给出实例及任务身份。
preview 返回明确状态：ready 分支持有 image 租约和 Host capturedAt，其余为等待或不可用。
普通 image 接口仍用于一般图片。隐藏和卸载取消展示请求、清理计时器和图片；
迟到结果必须释放，不能更新其他 attempt 或后来激活的界面。
本例对 PNG 预检尺寸，由显示 img 解码一次，不再完整预解码后重复显示。

## 从干净源码构建

准备 Host SDK 生产者回执，必须来自同一冻结 Host 源码、实际 SDK 构建和独立消费者验证。
Host 的 docs/developer/workflow.md 说明导出与定向验证。Plugins 只消费显式包，不引用本机隐藏源码。
在干净 Plugins 导出根执行，所有尖括号替换为实际回执路径，输出置于源码之外：

```text
python -B tooling/import_sdk.py --receipt <SDK消费者回执>
python -B tooling/build_managed_slice.py --extension live-screenshot --sdk-receipt <同一回执> --output <managed构建根>
node tooling/build_frontend.mjs --sdk-root <同源Host根> --work-root <依赖缓存根> --output <前端输出根>
python -B tooling/package_extension.py --build-receipt <managed构建回执> --sdk-receipt <同一回执> --frontend-receipt <前端输出根/build-receipt.json> --output <包根>
python -B tooling/build_specialized_slice.py --extension baah --sdk-receipt <同一回执> --output <specialized构建根>
python -B tooling/package_extension.py --build-receipt <specialized构建回执> --sdk-receipt <同一回执> --output <包根>
```

build_specialized_slice 的 PASS 只证明冻结来源和语法；还需 Host 解释器与业务测试。
packager 读取同源随包 README，核对全部成员和摘要，并要求重复装配字节一致。
不要手工写一个成功 receipt 或将任意编译文件塞入 ZIP 绕过闭包检查。

在仓外依赖根安装锁定 playwright-core 后可运行实际浏览器工厂：

```text
node tests/frontend/fixture.mjs --host-root <同源Host根> --work-root <依赖缓存根> --bundles <前端输出根> --report <报告根>
```

该 fixture 替换受控 I/O，证明组件契约，不等于真实 Host 安装通过。
原 ZIP 的受控安装测试在 Host 仓库，用 NEXUS_PACKAGED_EXTENSION_ROOT 指向包根，
NEXUS_PACKAGED_SCREENSHOT_RECEIPT 指向本次 LiveScreenshot 包回执，再执行：

```text
python -B tooling/nexus.py test --group storage --method NexusPipeline.StorageTests.ManagedInstalledTests.CapturesInstalledPreview --build-root <后端构建根> --output <报告根>
```

人工安装使用已验签 catalog/bundle 与正式安装入口，不能直接复制 DLL 到运行目录。
本地 Test bundle 由测试信任流程生成；正式包需要正式发布签名，不使用测试 key。

## Manifest、权限与持久状态

extension.json 声明稳定 extensionId、产品版本、能力、所需权限和 managed/specialized 入口。
构建把真实 SDK 版本及指纹写入 manifest，不由作者填一个“看起来兼容”的值。
LiveScreenshot 的 media.capture/ui.contribute 不授予任意文件权限；BAAH 明确选择 selected-script-root。
只申请实际需要的能力，声明存在不代表调用时仍获授权。

普通状态使用 Documents 的当前修订和 CAS；不要将秘密写入普通 JSON、日志或浏览器草稿。
秘密通过 Secrets/SecretDocuments 的保留、设置、清除语义操作，所需 subject 在 manifest 中明确声明。
需要普通状态和秘密协调时参考 GameCheckIn 的实际实现，不自行建立部分成功的双写流程。
网络必须使用 manifest 的精确来源和 Host 端口；路径、调用者字符串及客户端 DTO 不产生授权。

## 生命周期、错误与兼容拒绝

每个异步任务有取消源、异常接收方和释放 owner。激活失败、停用、卸载、断连及迟到回调都要释放资源。
写入结果未知时查询原操作，不换 operationId 重试。外部副作用只有满足宿主策略及冻结声明才可重试。
数据目录不是包目录；运行数据通过 Host 指定的输出 owner 保存，不写安装载荷。

SDK 的 .NET 公共 API、前端声明、公开 schema 和 UI ABI 共同形成兼容指纹。
改变签名后必须重新生成、构建实际声明并运行消费者。Host 不接受旧指纹、错版本或缺少声明入口的包。
只改 fingerprint 字符串不能修复兼容性。验收分别记录类型编译、组件 fixture、原 ZIP 集成和真实厂商环境，
不能把局部 PASS 拼成整插件通过。

## 同源本地化

专项 `extension.json.localization` 声明 defaultLocale 和 `i18n/<locale>.json`。
每份字典仅有 manifest、tasks、diagnostics 三组：manifest 为 displayName/gameName/summary，
tasks 按稳定任务 ID 保存 `{ "title": "..." }`，diagnostics 按真实 code 保存文本。
默认 manifest 文本必须与字典一致。打包投影 metadata.locales，adapter 生成 titleLocales；
不要再维护另一份商店或前端翻译。未知任务保留原标识与内容，不据当前词典补写历史。
诊断 code、任务 ID 和修订是事实；本地化不得改变能力、资源或执行次序。
createdAt/updatedAt 只能使用真实创建/发行事实，缺失保持缺失，不使用打包时间。

MaaEnd/MaaS 专项只含数据、JSON 和现有受限 adapter，调用用户已安装的上游程序。
不得捆绑 DLL/native/runtime/worker/compiler/provider/frontend，也不要求安装通用 Maa 插件。
源码归档和结构检查不等于真实上游业务验证。

instancePolicy 是 manifest 的实例业务约束；managed 驱动的受限 adapter 仅可引用其实际注册的自身 compiler/provider，数据专项的自身引用禁令保持。
