# NexusPipeline 官方插件

为 NexusPipeline 提供游戏脚本接入、签到、活动信息、外观与运行辅助功能。用户从 NexusPipeline 的插件页面安装、启用与更新；启停或更新后按界面提示重启。插件不包含游戏，专项插件也不包含上游自动化软件。

## 选择插件

下表链接到各插件的使用说明。可安装版本、更新内容与最低宿主要求以软件内插件页面展示为准；各插件独立管理版本。

| 插件使用说明 | 用途类别 | 适用对象 | 主要功能 |
| --- | --- | --- | --- |
| [自定义壁纸](plugins/general/CustomWallpaper/README.md) | 通用功能 | 宿主界面 | 背景图片、轮换与透明度设置 |
| [模拟器支持扩展](plugins/general/EmulatorSupport/README.md) | 通用功能 | 雷电、夜神、BlueStacks | 模拟器识别、启动、截图与关闭 |
| [游戏活动](plugins/general/GameActivities/README.md) | 通用功能 | 支持的游戏与区服 | 活动订阅、版本轮播与截止倒计时 |
| [游戏签到](plugins/general/GameCheckIn/README.md) | 通用功能 | 支持的游戏平台 | 多平台签到任务、计划与结果通知 |
| [实时截图窗口](plugins/general/LiveScreenshot/README.md) | 通用功能 | 游戏窗口与安卓模拟器 | 在运行任务卡片查看画面预览 |
| [MaaFramework 框架直驱](plugins/general/MaaFrameworkDriver/README.md) | 通用功能 | MaaFramework 本地项目 | 读取已有配置并直接运行框架任务 |
| [蔚蓝档案爱丽丝助手](plugins/specialized/BAAH/README.md) | 专项脚本接入 | 蔚蓝档案 | 接入 BAAH 自动化任务 |
| [更好的原神](plugins/specialized/BetterGI/README.md) | 专项脚本接入 | 原神 | 接入 BetterGI 自动化任务 |
| [终末地小助手](plugins/specialized/MaaEnd/README.md) | 专项脚本接入 | 明日方舟：终末地 | 接入 MaaEnd 自动化任务 |
| [星塔助手](plugins/specialized/MaaStellaSora/README.md) | 专项脚本接入 | 星塔旅人 | 接入 MaaStellaSora 自动化任务 |
| [三月七小助手](plugins/specialized/March7thAssistant/README.md) | 专项脚本接入 | 崩坏：星穹铁道 | 接入 March7thAssistant 自动化任务 |
| [ok-nte 日常](plugins/specialized/OkNTE/README.md) | 专项脚本接入 | 异环 | 接入 ok-nte 自动化任务 |
| [ok-ww 日常](plugins/specialized/OkWutheringWaves/README.md) | 专项脚本接入 | 鸣潮 | 接入 ok-ww 自动化任务 |
| [绝区零一条龙](plugins/specialized/ZenlessZoneZeroOneDragon/README.md) | 专项脚本接入 | 绝区零 | 接入绝区零一条龙自动化任务 |

## 安装与使用

1. 在 NexusPipeline 插件页面查看说明并安装需要的插件。
2. 启用插件，按提示重启软件。
3. 通用插件在主页面、设置或独立功能页面使用；专项插件在新建脚本时选择，并绑定实际安装目录及用户配置。
4. 先手动运行并检查结果，再开启计划。旧配置、账号状态及上游版本限制请阅读对应插件说明。

稳定商店使用正式发行版本。开发预览面向测试，不能把源码版本或本机验收包视为已正式上架。卸载或重装前请保全用户配置与凭据。

官方八专项支持任务识别降级：保留原入口与未知选择，并在整体成功结果中披露未逐项核验范围。

## 开发与维护

插件作者请从 [贡献指南](CONTRIBUTING.md) 开始；[文档导航](docs/README.md)、[测试](docs/testing/README.md)、[发布](docs/development/release.md) 和 [上游项目支持索引](docs/projects/README.md) 提供工程说明。用户不需要 Node、npm 或自行构建。

## License

本仓库自有代码与文档采用 [MIT 许可证](LICENSE)。第三方依赖和资源遵循各自的许可证；MaaFramework 相关许可与声明见 [LICENSES](plugins/general/MaaFrameworkDriver/LICENSES/NOTICE.md)。
