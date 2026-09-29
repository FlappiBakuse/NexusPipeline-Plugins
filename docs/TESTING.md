# 核心测试

在仓库根执行，显式提供包含测试工具的实际 Host 源码：

```text
node tests/run.mjs list --json
node tests/run.mjs plugin --plugin GameCheckIn --host-root <Host>
node tests/run.mjs daily --changed --base <完整基线SHA> --host-root <Host>
node tests/run.mjs daily --all-core --host-root <Host>
node tests/run.mjs plan --base <完整基线SHA> --include-working-tree
node tests/run.mjs gate --id plugins.plugin.package:GameCheckIn --host-root <固定Host检出>
node tests/run.mjs gate --id plugins.ci-policy --host-root <固定Host检出>
```

`tests/policy.json` 固定十三插件、组件方法和有限适配轨迹。未知插件、重复参数、空变化集合、遗漏报告、零用例和 skip 均失败。变化只属于一个插件时只选该插件；共享、删除、改名和未知输入保守选择全部。纯文档变化为 NOT_APPLICABLE，CI 仍生成范围与汇总检查。

正式 PR 门禁按 `plan` 选择，每个 `gate --id` 独立计时，完整本地资格线为 150 秒，硬停止线为 180 秒。包内容 gate 实际构建所选插件 ZIP，核对名称、版本、内容边界、大小和 SHA256。`plugin` 与 `daily` 保留为本地诊断入口；同一次命令仍共享 180 秒预算，但不再采用 30/60/120 秒的固定插件合格线。超时为 5、清理失败为 6、缺少所需能力为 7、报告错误为 4、取消为 130。

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

CI 的范围 job 只启动选中插件的 Windows job，每 job 三分钟，Required 汇总独立核验本次报告和 Actions API 完整前序 job 时长。完成后以 `python tests/audit-jobs.py --run-id <ID> --attempt <N>` 只读检查包括 Required 在内的最终时长；终结 job 自动回写仍待受控远端部署。保留 `Plugins / Required` 名称，不自动修改远端规则。测试专用 Host SHA 只写入 `tests/inputs.lock.json`，不改变兼容元数据 `host.lock.json`。当前锁要求填写真实合入且包含工具的 Host 提交；缺失时明确失败，不追随浮动 main。本地开发树可带已确认改动，但报告标明源码指纹，不充当正式资格。

`python tools/repository.py verify`、全部历史 TaskProtocol fixture 和前端模拟 Host 工具保留为显式诊断；其边界不替代上述实际能力证据。生产打包、来源、hash 和 publisher 校验继续由现役发行工具维护。
