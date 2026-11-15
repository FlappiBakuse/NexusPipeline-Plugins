# SDK、切片与插件包构建

从 Plugins 仓库根执行。本页维护构建命令；选中范围、产品测试和失败处理见[验证](validation.md)。所有尖括号参数须替换为实际绝对路径或回执。

## SDK 输入

Host 的 `contracts/schemas`、公共 .NET/前端 SDK 与 UI 元数据为权威。Plugins 的 `contracts` 是 [import_sdk.py](../../tooling/import_sdk.py) 按真实 SDK 包导入的镜像，[sdk-source-lock.json](../../contracts/sdk-source-lock.json)绑定来源及摘要。

在配套 Host 根使用现役入口生成 SDK；只编译/打包可选择 compile-only：

```text
python -B tooling/nexus.py sdk-packages --build-root <Host仓外构建槽> --consumer-root <Plugins根/tests/consumers> --output <仓外SDK根> --cache <仓外共用缓存> --compile-only
```

在 Plugins 根导入本次成功的 SDK 消费者回执：

```text
python -B tooling/import_sdk.py --receipt <HostSDK消费者回执>
```

compile-only 生成真实 SDK 与独立 consumer 编译结果；runtimeConsumers 与 lifecycle 按实际为 NOT_RUN。运行消费者或生命周期只按选中的产品假设增加。镜像、来源和摘要始终由 producer/importer 核验。

## 插件切片

按类型选择一个入口：

```text
python -B tooling/build_managed_slice.py --extension live-screenshot --sdk-receipt <同一回执> --output <仓外managed根>
python -B tooling/build_specialized_slice.py --extension baah --sdk-receipt <同一回执> --output <仓外specialized根>
```

切片回执分别记录 adapter 语法、managed/worker 编译和构建结果。以实际打印的回执为后续输入；编译和包完整性分别记录，产品行为另选测试。

## 浏览器模块

```text
node tooling/build_frontend.mjs --sdk-root <同源Host根> --work-root <仓外依赖根> --output <仓外bundle根> --extension live-screenshot
```

`--extension` 可重复；省略会选择五个模块。已有回执下共享输入改变可能扩大实际消费者，记录工具输出的 `selectedExtensions`。该入口串联命名、类型与 bundle，统一执行一次；依赖在 work-root 准备。

## 插件包

```text
python -B tooling/package_extension.py --build-receipt <切片构建回执> --sdk-receipt <同一SDK回执> --frontend-receipt <bundle根/build-receipt.json> --output <仓外包根>
```

数据专项和没有浏览器模块的 emulator-support 省略 `--frontend-receipt`。Maa 直驱另外提供匹配 `runtime.release.json` 的 `--runtime-receipt`；仅在该产物属于交付范围时准备实际原生输入。

打包核对 manifest、实际成员、原字节及各回执。失败或不同源回执拒绝打包，未知文件不通过遗漏清单处理。随包 README 与双语 changelog 属于发行输入。

## 本地化与来源

各插件 `locale.ts` 的 `locales` 常量维护包、任务和诊断词条，采用显式对象字面量。`tooling/localization.py` 校验重复键、语言与长度，构建/打包生成 manifest 声明的 JSON。前端界面词条由各前端 TS 模块维护，不手改生成资源。

构建、包、安装 Host、真实上游及正式发行分别记录资格。正式候选与 Publisher 见[发行](../operations/release.md)；本地未提交输入使用 local-uncommitted，保留实际产物身份。
