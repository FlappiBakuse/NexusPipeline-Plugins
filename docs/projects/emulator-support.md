# EmulatorSupport 0.5.0

目标 Host 0.18.0 / SDK 0.1.0。插件拥有厂商语义和选择策略，Host 拥有安装/文件/工具快照、进程与资源授权、超时取消、ADB、Android 应用和媒体生命周期。源码不使用文件系统、注册表、网络或进程旁路。PC 专用脚本不能获得 Android 目标。

| 厂商 | 发现与实例 | 固定控制 argv | ADB 与关闭 |
| --- | --- | --- | --- |
| 雷电 | 所有 ldconsole/dnconsole 安装；list2 的索引、标题、窗口字段、启动状态、PID 分开解析；保留逗号标题与既有简表 | `list2`；`launch --index <index>`；`quit --index <index>` | bundled adb.exe；端口公式只产生候选，仍须 Host 证明实际设备；关闭需确认离线 |
| 夜神 | NoxConsole list 的 VM 身份、显示名、数字索引和控制名称分开；BignoxVMS 的 .vbox 精确路径身份与 guest 5555 TCP 转发 | `list`；`launch -index:<index>` 或 `launch -name:<controlName>`；对应 `quit` | bundled nox_adb.exe；不把其他 guest 端口当 ADB；拒绝 XML DTD、实体和重复映射 |
| BlueStacks | HD-Player 安装与 bluestacks.conf；实例 ID 独立于 display_name，status.adb_port 优先于静态端口；保留既有 INI/外部 JSON 形状 | `--instance <id>`，由 Host 持有启动动作 | bundled HD-Adb.exe；先由 Host 对所选设备关闭；进程回退还须唯一精确 `--instance` 参数、映像物理 ID/SHA、启动时间与冻结 opaque evidence |

每个安装携带物理 root、控制程序及 bundled ADB 的路径/物理 ID/SHA/revision。配置保留原始字节 SHA、物理 ID、revision 与相对路径，严格解码 UTF-8 或带 BOM 的 UTF-16。目标指纹绑定完整来源证明、明确实例、端点与候选映射，不依赖显示名或进程名。更新、重装、替换工具、配置或端点变化必须重新发现与冻结。

发现保留所有安装与实例。单一厂商失败不隐藏其他厂商，但空列表、未知输出、非零退出、超时、ADB 缺失和配置映射缺失有不同诊断。没有安装的厂商保持独立缺口。CLI 成功或插件存在不代表设备 ready。

数字索引、VM 名和实例 ID 可能在删除后复用，选择 ID 不代替物理实例证明。会话首次操作须取得 Host 签发且绑定实际实例 generation 的证据，后续变化立即拒绝。Host 返回的 ADB session 还须匹配该证据、目标、端点与设备身份；重连到其他设备立即拒绝。截图要求 Host 验证并发布的非空媒体身份、类型与尺寸。关闭先验证冻结来源，厂商 quit 与 ADB 关闭均需实际离线事实；最后的精确进程回退须重新枚举并匹配同一冻结进程身份。取消仅撤销 Host 签发的动作 ID，不提升缓存 PID 为关闭权限；未拥有的既有实例不能随取消关闭。

正常启动可能更新 BlueStacks 的运行状态。Host 在执行准入和运行期核对同一物理实例 generation；普通配置原子替换可以保留该身份，VM 目录重建或端点重分配则拒绝并要求重新发现。启动 Job 在主任务结束前持续归 Host 持有，保留实例时显式移交整个存活进程族，不自行重定向到新端口。

`tests/emulator-support/verify.py` 当前 79/79：实际编译生产解析/发现/选择/会话源码并绑定准确的 SDK 包，使用合成 Host 工具、ADB 与媒体记录。覆盖三厂商格式和 argv、多安装/同名/歧义、原字节变化、实例与 PID 复用、错误码/超时、设备重连、截图失败和取消。组件测试不执行任何真实厂商程序，不构成实际 CLI 或设备资格。

固定 SDK 提供 `IEmulatorRegistration`、`IEmulatorInventory`、`IEmulatorHost` 和 `IEmulatorSession`。
managed manifest 的 `emulators` 与 `emulator.provide` 必须成对声明；原包生产入口实际注册 `vendors`。
Host 只有在安装激活发布后才能调用，撤销取消并排空进行中的调用，旧对象失去使用权。
三项原始 ZIP 的 Host 集成验证覆盖三厂商受控库存、会话和撤销；设备与媒体为明确的受控 port。

`EmulatorInventoryScope` 从 Host 明确给出的根捕获目录、控制程序及其运行文件、配置原字节，
保持原物理身份和只读句柄，只准许固定的 `list2`/`list` 枚举。程序返回、管道完成及整个
实际 Job 停止后才返回结果；超时同样先停止。三项受控真实 CLI 测试覆盖正常、非零退出与超时。
库存入口已接入注册表和显式便携根、正式 Android 脚本选择及计划冻结。运行期采用 Host 的 Android 命令、ADB、截图与收集 owner；三厂商受控 CLI/Job 验证启动、截图、关闭、取消与保留实例交接，不能替代实际厂商安装资格。

本机三家实际厂商程序均未安装，真程序 CLI/ADB/截图/关闭分别为 NOT_RUN。
不能用另一家或受控 CLI 替代该资格；无需真实游戏长跑。

官方协议参考：[雷电 CLI](https://www.ldplayer.net/support/introduction-to-ldplayer-command-line-interface.html?n=1996)、[夜神 CLI](https://support.bignox.com/en/function/command)、[BlueStacks ADB](https://support.bluestacks.com/hc/en-us/articles/23925869130381-How-to-enable-Android-Debug-Bridge-on-BlueStacks-5)、[BlueStacks 多实例端口说明](https://support.bluestacks.com/hc/en-us/articles/360061342631-How-to-transfer-your-apps-from-BlueStacks-4-to-BlueStacks-5)。BlueStacks CLI/配置兼容表以既有项目业务源码为支持依据，仍需实际厂商程序核验。三个闭源产品未登记官方 GitHub 源码，不编造最新 Release tag 或 source SHA。
