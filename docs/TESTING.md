# 核心测试

在仓库根执行，显式提供包含测试工具的实际 Host 源码：

```text
node tests/run.mjs list --json
node tests/run.mjs plugin --plugin GameCheckIn --host-root <Host>
node tests/run.mjs daily --changed --base <完整基线SHA> --host-root <Host>
node tests/run.mjs daily --all-core --host-root <Host>
node tests/run.mjs plan --base <完整基线SHA> --include-working-tree --output <外部scope.json>
node tests/run.mjs batch --plan <外部scope.json> --batch <control或batch-01至batch-05> --host-root <固定Host检出>
node tools/check-doc-links.mjs
node tests/run.mjs gate --id plugins.plugin.package:GameCheckIn --host-root <固定Host检出>
node tests/run.mjs gate --id plugins.ci-policy --host-root <固定Host检出>
```

`tests/policy.json` 登记当前插件清单、组件方法和有限适配轨迹（当前 13 个，数量不是扩展上限）；源码 manifest 必须与登记精确一致。未知插件、重复参数、空变化集合、遗漏报告、零用例和 skip 均失败。变化只属于一个插件时只选该插件；共享、删除、改名和未知输入保守选择全部。纯文档变化为 NOT_APPLICABLE，CI 仍生成范围与汇总检查。

正式 PR 门禁由 `plan` 将逻辑义务合并为执行单元，分配到可选 control 与最多五个 batch；容量不足明确失败，不删除义务。`gate --id` 是显式诊断。batch 工作窗口 130 秒、硬截止 180 秒（最后 50 秒用于收尾），所有准备、子进程、报告与清理继承父截止；过程加准备上限 150 秒只证明本地预算。包内容 gate 实际构建所选插件 ZIP，核对名称、版本、内容边界、大小和 SHA256。`plugin` 与 `daily` 保留为本地诊断入口；同一次命令仍共享 180 秒预算，但不再采用 30/60/120 秒的固定插件合格线。超时为 5、清理失败为 6、缺少所需能力为 7、报告错误为 4、取消为 130。

运行目录和依赖缓存位于已登记的外部 `NEXUS_TEST_ARTIFACT_ROOT`；不设置时使用 runner 或系统临时目录。源码按原字节复制并记录完整指纹，Host 与 Plugins 构建各有独占 lease。不可并行执行两个写入同一缓存的命令。失败证据保留，不覆盖已有 run ID。

| 范围 | 实际证明 | 替代边界 |
|---|---|---|
| GameCheckIn | 真实 Host 加载、浏览器编辑/签到、四任务两凭据、结果映射、重复运行与重启持久化 | 固定第三方 HTTPS 响应，合成凭据 |
| CustomWallpaper | 三资源、浏览器启用、八次选择、原始字节、删除与无效资源保护 | 合成 PNG |
| LiveScreenshot | 运行 ID 归属、八轮实际前端挂载卸载、两帧实际解码内容 | 受控 ADB 输出；像素只辨别数据内容，不做外观基线 |
| EmulatorSupport | 实际 Host discovery/launch/close 接线和重复运行、各厂商窄解析 | 两实例的受控厂商 CLI/ADB |
| 八专项 | 生产 Jint discover/observe/retry、12 次观察及新 run 隔离、固定日志轨迹；BetterGI/ZZZ 生产编辑脚本 | 合成配置、日志和账号 |
| MaaFrameworkDriver | 18 项编译/授权规则、6 次预览、2 次实际 native worker 与拥有窗口 | 最小 DirectHit/DoNothing PI，不证明真实游戏任务 |

Maa native 输入单独准备并验证官方压缩包及文件 hash：

```text
python tests/bootstrap-native.py --output <新的外部目录> [--archive <已下载ZIP>]
```

随后设置进程环境 `NEXUS_MAA_NATIVE_ROOT` 指向该目录。版本、URL、大小和 SHA256 在 `tests/inputs.lock.json`；测试不自动下载或忽略未知版本。受控 WinForms 窗口必须实际可见，以供 Win32 controller 绑定；场景结束必须退出。

CI 的范围 job 启动可选轻量 control 和最多五个 Windows batch；全清单与架构合同在 control 执行一次，数据、managed 与 native 按准备图分层，生产包与 Test Host key 分离。每物理 job 三分钟硬停止，Required 汇总独立核验本次报告和 Actions API 完整前序 job 时长。完成后以 `python tests/audit-jobs.py --run-id <ID> --attempt <N>` 只读检查包括 Required 在内的最终时长；可信 main 的 begin 控制器先登记同 PR/head/run/attempt 身份，finalize 在 CI 完成后审计所有物理 job，写入 `Plugins / Final Budget` 检查；该检查须与 `Plugins / Required` 一同绑定到 main 规则。回写检查不存在或失败时不得合并。测试专用 Host SHA 只写入 `tests/inputs.lock.json`，不改变兼容元数据 `host.lock.json`。当前锁要求填写真实合入且包含工具的 Host 提交；缺失时明确失败，不追随浮动 main。本地开发树可带已确认改动，但报告标明源码指纹，不充当正式资格。

`python tools/repository.py verify`、全部历史 TaskProtocol fixture 和前端模拟 Host 工具保留为显式诊断；其边界不替代上述实际能力证据。生产打包、来源、hash 和 publisher 校验继续由现役发行工具维护。

正式完整资格为每物理 job 150 秒，包含 checkout、工具/依赖准备、上传及 post-action；scope + 可选 control + 五批 + Required + begin + finalize 最多十个 job。Required 自身和 finalize 收尾须用完成后的服务端记录复核。schemaVersion 2 报告绑定原生证据 hash、source/partner/policy/control manifest；缺失、skip、零用例、错 attempt、路径越界及规范化与原生不一致均失败。当前远端启用状态见 [STATUS](STATUS.md)。轻量文档义务只检查真实文件、内链和命令入口，不准备 .NET、Host 或浏览器；语义仍需人工审查。

### 同 SHA 完整重跑

首次 CI 由 `requested` 事件登记一次可信 begin。完整重跑不产生该事件，须由已审核 `main` 显式登记新的 attempt；新 Required 只接受本次 PR/head/run/attempt 身份，未登记时失败。先重跑整个生产者，读取新的 attempt，再执行：

```text
gh run rerun <producer-run-id> --repo FlappiBakuse/NexusPipeline-Plugins
gh workflow run final-budget.yml --repo FlappiBakuse/NexusPipeline-Plugins --ref main -f run_id=<producer-run-id> -f attempt=<新的attempt> -f phase=begin
```

不要只重跑失败 job 来替代完整资格。CI 完成后自动触发 finalize；检查成功后仍须读取生产者与两个控制器的完整服务端作业记录，包括 post-action。
