# 插件开发入门

目标：选定一个插件，使用真实 Host SDK 构建它的最小切片。安装与第一次使用见[用户入口](../user/README.md)，协作流程见 [CONTRIBUTING](../../CONTRIBUTING.md)。

## 环境与输入

准备配套 Host 与 Plugins 源码根、独立仓外工作根和需要修改的插件。CI 使用 Windows、Python 3.13、Node 24、.NET 10 稳定 SDK；两仓各自的 `global.json` 均从 10.0.100 起选择稳定功能带。具体依赖以项目和原生锁为准。

只准备当前任务所需组件。依赖、构建、测试实例和报告写显式仓外路径；本机放 `D:\Projects\Temp`。不要在源码树中运行 npm install 或把用户真实运行目录作为 fixture。

## 选择代码路径

| 任务 | 起点 | 说明 |
|---|---|---|
| 程序参数或配置发现 | 专项 `adapter/discovery.js` | [专项作者指南](../authors/specialized-adapters.md) |
| 任务、日志与重试 | 专项 adapter 与 `sources.json` | 对应[项目参考](../README.md#项目参考)及上游锁 |
| managed 业务 | 当前插件根内的 Domain、Application、Host 层 | [managed 作者指南](../authors/managed-extensions.md) |
| 浏览器页面 | 当前 `frontend/src`、共享 `frontend-ui` | [前端开发](../development/frontend.md) |
| 构建与包缺项 | manifest、现役 build/package 工具 | [构建指南](../development/building.md) |

## 第一次构建

1. 完成选定手写改动与必要断言；初次学习可使用当前源码。
2. 按[SDK 输入](../development/building.md#sdk-输入)从配套 Host 生成真实 SDK 和独立消费者回执，再导入镜像。已有有效同源输入可以复用。
3. 选择一个插件切片。例如在 Plugins 仓库根执行：

```text
python -B tooling/build_specialized_slice.py --extension oknte --sdk-receipt <真实SDK消费者回执绝对路径> --output <本轮仓外specialized根>
```

预期打印 PASS 和实际 `build-receipt.json` 路径，形成 manifest 与仓外 adapter。此命令验证 SDK/源码绑定及 JS 语法，产品向量与 Host/Jint 行为按[验证指南](../development/validation.md)另选。

4. 需要安装包时，按[打包](../development/building.md#插件包)消费实际回执。普通目录或 DLL 无安装资格，实际安装通过 Host 原包入口完成。

## 排障与后续

SDK 不匹配先查 producer、source lock、原包摘要和导入回执，不手改指纹。构建失败读本次原生日志；Maa 缺原生输入时按其 runtime lock 准备，数据专项不需要 worker 或 native DLL。

前端、managed 与 Jint 采用各自[最低验证层](../development/validation.md)。没有 Windows、浏览器或真实厂商条件时明确记未运行，保留已有结果的实际范围。未完成环境资格见[当前状态](../status.md)。
