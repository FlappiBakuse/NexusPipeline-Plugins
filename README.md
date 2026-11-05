# NexusPipeline 官方插件

目标为 14 个官方插件 0.5.0，消费 NexusPipeline Extensibility SDK 0.1.0。
源码包含六个 managed 插件和八个专项插件，安装候选由下述入口从明确输入生成。
MaaFramework 声明独立 worker 和固定官方原生库，GameCheckIn 包含登录与签到流程。
五个浏览器模块均导出实际 `createFrontend` transport，并保留公共 SDK 表面与独立类型检查。组件证据、实际原包安装和浏览器业务分别记录，候选包不代表全部插件或完整软件验收。

managed 源码归 `plugins/managed/<extension-id>`，专项声明归 `plugins/specialized/<extension-id>`。
纯共享协议归 `adapter-runtime/core`，框架适配归 `adapter-runtime/frameworks`。
契约只能从固定 SDK 产物导入，禁止手写第二套 Host DTO。

源码、用户运行数据、测试 fixture 与发行产物必须分离。

本地 SDK 与纵切构建：

```text
python -B tooling/import_sdk.py --receipt <仓外SDK消费者回执>
python -B tooling/build_managed_slice.py --extension live-screenshot --sdk-receipt <同一回执> --output <仓外构建根>
python -B tooling/package_extension.py --build-receipt <实际后端构建回执> --sdk-receipt <同一回执> --frontend-receipt <五bundle构建目录/build-receipt.json> --output <仓外包目录>
```

SDK 回执绑定真实包摘要与 Host 新源码快照；`contracts/sdk-source-lock.json` 记录来源身份。
构建复用同一仓外工作区，并保存各次原生命令、日志和不可变源码摘要，不写入项目输出目录。
managed 编译按项目、传递源码、SDK 包、工具及环境核验输入，文档与前端资源不强制重编译未变程序集。
复用引用原编译回执并核验全部输出；每次仍保存当前完整来源和 manifest，打包读取本次随包文档。

MaaFramework 的 managed 构建同时编译 manifest 声明的独立 worker。打包时必须额外传
`--runtime-receipt <已核验官方资产与逐文件指纹回执>`，并与仓内 `runtime.release.json`
精确一致；缺少声明的原生库、worker 闭包或前端证据时拒绝生成包。
打包核对前后端来源、真实 SDK 生产者、全部包成员及逐项摘要；两次装配必须字节一致。
前端回执按摘要另存不可变副本。ZIP 通过结构与来源核验不表示业务或完整软件已经验收。

五份浏览器 bundle：

```text
node tooling/build_frontend.mjs --sdk-root <Host源码根> --work-root <仓外依赖目录> --output <仓外bundle目录>
node tests/frontend/fixture.mjs --host-root <Host源码根> --work-root <含playwright-core的仓外依赖目录> --bundles <上一步bundle目录> --report <仓外报告目录> --browser <实际浏览器exe> --extension game-checkin --scenario all
```

浏览器 fixture 使用显式浏览器和 Host 公开 nexus 元素，`playwright-core` 需安装在指定的仓外依赖目录。当前前端接入边界见 [浏览器模块](docs/developer/frontend.md)。

- [插件作者入门与可运行示例](docs/authors/README.md)
- [PR 打包检查与发行来源](docs/developer/release.md)
