# MaaFramework 框架直驱

直接读取 MaaFramework 项目的任务声明，在 NexusPipeline 中配置并运行任务。

当前版本 0.2.2，需要 NexusPipeline 0.17.2 或更高的兼容版本，运行环境为 Windows 11 x64。

## 开始使用

1. 在插件页面安装并启用插件，按提示重启 NexusPipeline。安装版本以插件页面为准；本文说明当前源码对应的功能。
2. 新建脚本并选择 MaaFramework 框架直驱，指定已准备好的项目根目录。
3. 读取项目，选择运行库、控制器、资源、任务、顺序及参数。Win32 指定完整程序路径与窗口条件；ADB 指定 adb.exe 和设备地址。
4. 执行只读预览，核对授权摘要并确认保存独立配置，最后保存脚本。绑定用户后加入队列运行。

## 使用范围

可显式导入支持的 MXU 或 MaaPiCli 配置：先预览，再载入草稿并重新授权。不会自动迁移 MaaEnd、MaaStellaSora 或同步源配置。

项目 Agent 和运行前任务会执行项目代码，进程隔离不提供文件系统或网络沙箱，请只授权信任的项目。项目代码、程序或资源变化后可能需要重新授权。

## 常见问题

窗口有多个匹配时，收紧完整 EXE 路径及窗口条件。运行库版本、架构或接口不匹配时不会执行；请使用项目要求的运行库。原生引擎完成不一定代表游戏业务成功，请结合任务历史和游戏结果检查。

## 更多说明

[框架配置与支持范围](https://github.com/FlappiBakuse/NexusPipeline-Plugins/blob/main/docs/frameworks/MAAFRAMEWORK_DRIVER.md)。
