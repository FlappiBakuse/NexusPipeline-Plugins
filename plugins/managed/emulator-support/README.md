# EmulatorSupport 0.5.0

为 Android 脚本提供雷电、夜神与 BlueStacks 模拟器的发现和实例选择，并协助管理所选实例的启动与关闭。

为已声明 Android 支持的脚本提供雷电、夜神与 BlueStacks 的厂商发现、实例选择和控制策略。Generic ADB、MuMuManager、应用启动及前台包识别继续归 Host Android owner。

实例按安装物理身份、厂商实例身份和明确选择绑定。显示名可以相同；多个安装、端口冲突、重复配置、工具或配置变化均不能任意选第一个。厂商命令只生成固定 argv，由 Host 在预算和资源授权内执行；插件源码不读取注册表或文件，不自行启动或终止进程。

启动必须确认实际 ADB session 与设备身份，截图由 Host 媒体 owner 发布。关闭只针对所选实例；取消仅交给 Host 撤销本次动作。精确进程回退还要求同一物理映像、启动时间及 opaque 进程证据，绝不按进程名清理其他实例。

生产入口通过固定 SDK 的 `context.Emulators` 注册 manifest 声明的 `vendors` provider。
原始 ZIP 已在实际 Host 安装，三家厂商的受控库存、选择与会话调用均经过该入口，
撤销后旧 provider 与会话不能继续调用 Host。79 项组件验证消费准确的已打包 SDK。

Host 的库存 scope 从明确选中的目录捕获工具、原配置字节和物理身份，持有只读租约，
只受理所绑定控制程序的固定枚举参数；受控真实 CLI 的正常、非零退出和超时均已验证完整停止。
注册表/便携安装根入口、正式脚本目标准入以及 ADB/媒体运行桥仍待接续。
本机三家厂商均未安装，其真实程序、CLI、ADB、截图与关闭分别保持 NOT_RUN；
受控 Host 或 CLI 记录不替代真程序资格。

业务与验证边界见 [项目说明](../../../docs/projects/emulator-support.md)。
