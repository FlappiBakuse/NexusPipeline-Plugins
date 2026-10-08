# 核心测试

GitHub PR 只运行固定 `Plugins / 打包检查`，单 job 十分钟内执行受影响插件的实际生产打包、清单及 ZIP 边界验证，不运行项目测试。文档和纯本机测试变更生成固定成功结果。本机测试保留原生结果、输入身份、计数、场景和清理验证，不设执行预算。

在仓库根执行，显式提供包含测试工具的实际 Host 源码：

```text
node tests/run.mjs list --json
node tests/run.mjs plugin --plugin GameCheckIn --host-root <Host>
node tests/run.mjs daily --changed --base <完整基线SHA> --host-root <Host>
node tests/run.mjs daily --all-core --host-root <Host>
node tests/run.mjs plan --base <完整基线SHA> --include-working-tree --output <外部scope.json>
node tests/run.mjs batch --plan <外部scope.json> --batch <control或batch-01至batch-05> --host-root <固定Host检出>
python tools/repo.py check docs
node tests/run.mjs gate --id plugins.plugin.package:GameCheckIn --host-root <固定Host检出>
node tests/run.mjs gate --id plugins.ci-policy --host-root <固定Host检出>
```

`tests/policy.json` 登记当前插件清单、组件方法和有限适配轨迹（当前 13 个，数量不是扩展上限）；源码 manifest 必须与登记精确一致。未知插件、重复参数、空变化集合、遗漏报告、零用例和 skip 均失败。变化只属于一个插件时只选该插件；共享、删除、改名和未知输入保守选择全部。纯文档变化为 NOT_APPLICABLE，GitHub 仍生成固定生产检查结果。

本机 plan、batch、gate 按实际准备依赖组织测试，记录准备、原生命令、真实场景和清理的完整耗时。缺少报告、失败、取消、空用例或意外跳过不能成功。操作协议与进程退出保留有限等待。

配对核验继续严格检查实际 commit、tree、policy、input lock 和可信 main 登记；核验子进程不设执行时间预算。

运行目录和依赖缓存位于已登记的外部 `NEXUS_TEST_ARTIFACT_ROOT`；不设置时使用 runner 或系统临时目录。源码按原字节复制并记录完整指纹，Host 与 Plugins 构建各有独占 lease。不可并行执行两个写入同一缓存的命令。失败证据保留，不覆盖已有 run ID。

| 范围 | 实际证明 | 替代边界 |
|---|---|---|
| GameCheckIn | 真实 Host 加载、浏览器编辑/签到、四任务两凭据、结果映射、重复运行与重启持久化 | 固定第三方 HTTPS 响应，合成凭据 |
| CustomWallpaper | 三资源、浏览器启用、八次选择、原始字节、删除与无效资源保护 | 合成 PNG |
| LiveScreenshot | 运行 ID 归属、八轮实际前端挂载卸载、两帧实际解码内容 | 受控 ADB 输出；像素只辨别数据内容，不做外观基线 |
| EmulatorSupport | 实际 Host discovery/launch/close 接线和重复运行、各厂商窄解析 | 两实例的受控厂商 CLI/ADB |
| 八专项 | 生产 Jint discover/observe/retry、12 次观察及新 run 隔离、固定日志轨迹；BetterGI/ZZZ 生产编辑脚本 | 合成配置、日志和账号 |
| MaaFrameworkDriver | 18 项编译/授权规则、6 次预览、2 次实际 native worker 与拥有窗口 | 最小 DirectHit/DoNothing PI，不证明真实游戏任务 |

Host Test Host 与插件组件使用独立的恢复和输出图，可以并行准备；共享生产 SDK/TestKit 的组件工程仍串行构建。选中的插件前端共用一次 npm workspace 依赖安装，类型检查与构建逐插件执行。组件发现、原生测试、真实 Host 能力、包构建和清理继续逐项记录，并共享同一个父命令计时。

完成共享组件构建后，纯 managed-code 选择最多使用两个插件执行槽位。每个插件的原生发现、用例和真实能力场景仍有独立报告、进程、端口和运行目录，全部槽位继承同一父命令计时并等待收尾；任一失败或清理不完整使整条命令失败。包含专项插件的选择保持单槽位。

Maa native 输入单独准备并验证官方压缩包及文件 hash：

```text
python tests/bootstrap-native.py --output <新的外部目录> [--archive <已下载ZIP>]
```

随后设置进程环境 `NEXUS_MAA_NATIVE_ROOT` 指向该目录。版本、URL、大小和 SHA256 在 `tests/inputs.lock.json`；测试不自动下载或忽略未知版本。受控 WinForms 窗口必须实际可见，以供 Win32 controller 绑定；场景结束必须退出。


生产检查复现入口：

```text
python tools/ci_check.py plan --base <完整base SHA> --head <完整head SHA> --checkout <实际checkout SHA> --report <外部plan.json>
python tools/ci_check.py run --plan <同一plan.json> --output <新的外部输出目录> [--host-root <固定干净Host SDK检出>]
```

计划绑定源码原字节、完整 tree 和一次固定的官方 Host SHA。数据插件不准备 .NET 或浏览器，managed 包实际构建程序集及声明的前端。删除、改名和共享输入按生产依赖扩大闭包。run 重新推导计划并核对输入，不能篡改计划跳过目标。测试专用 Host SHA 继续由 `tests/inputs.lock.json` 独立管理。

配置编辑生成一致性使用 `python tools/repo.py generate editors --check`；准备行为使用 `node tests/config-editors/run.mjs`；修复真实 Jint 使用 Host 工具 `--plugin-root <Plugins> --config-repair <新报告.json>`，账号隔离使用 `--account-isolation <新报告.json>`。这些是实际调用和字段效果验证，不能用语法检查替代。
