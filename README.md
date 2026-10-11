# NexusPipeline 官方插件

为 NexusPipeline 提供游戏脚本接入、签到、活动信息、外观与运行辅助功能。用户从 NexusPipeline 的插件页面安装、启用与更新；启停或更新后按界面提示重启。插件不包含游戏，专项插件也不包含上游自动化软件。

## 选择插件

下面的使用说明对应当前源码；商店可安装版本以软件内展示为准。当前源码要求 Host 0.17.2，Plugin API 2.2 / Frontend API 1.7；插件版本独立管理。

| 插件使用说明 | 源码版本 | 用途类别 |
| --- | --- | --- |
| [自定义壁纸](plugins/general/CustomWallpaper/README.md) | 0.3.2 | 通用功能 |
| [模拟器支持扩展](plugins/general/EmulatorSupport/README.md) | 0.2.2 | 通用功能 |
| [游戏活动](plugins/general/GameActivities/README.md) | 0.1.0 | 通用功能 |
| [游戏签到](plugins/general/GameCheckIn/README.md) | 0.4.3 | 通用功能 |
| [实时截图窗口](plugins/general/LiveScreenshot/README.md) | 0.3.2 | 通用功能 |
| [MaaFramework 框架直驱](plugins/general/MaaFrameworkDriver/README.md) | 0.2.2 | 通用功能 |
| [蔚蓝档案爱丽丝助手](plugins/specialized/BAAH/README.md) | 0.3.2 | 专项脚本接入 |
| [更好的原神](plugins/specialized/BetterGI/README.md) | 0.4.2 | 专项脚本接入 |
| [终末地小助手](plugins/specialized/MaaEnd/README.md) | 0.4.2 | 专项脚本接入 |
| [星塔助手](plugins/specialized/MaaStellaSora/README.md) | 0.3.2 | 专项脚本接入 |
| [三月七小助手](plugins/specialized/March7thAssistant/README.md) | 0.4.2 | 专项脚本接入 |
| [ok-nte 日常](plugins/specialized/OkNTE/README.md) | 0.2.2 | 专项脚本接入 |
| [ok-ww 日常](plugins/specialized/OkWutheringWaves/README.md) | 0.2.2 | 专项脚本接入 |
| [绝区零一条龙](plugins/specialized/ZenlessZoneZeroOneDragon/README.md) | 0.4.2 | 专项脚本接入 |

## 安装与使用

1. 在 NexusPipeline 插件页面查看说明并安装需要的插件。
2. 启用插件，按提示重启软件。
3. 通用插件在主页面、设置或独立功能页面使用；专项插件在新建脚本时选择，并绑定实际安装目录及用户配置。
4. 先手动运行并检查结果，再开启计划。旧配置、账号状态及上游版本限制请阅读对应插件说明。

稳定商店使用正式发行版本。开发预览面向测试，不能把源码版本或本机验收包视为已正式上架。卸载或重装前请保全用户配置与凭据。

## 开发与维护

插件作者请从 [贡献指南](CONTRIBUTING.md) 开始；[文档导航](docs/README.md)、[测试](docs/TESTING.md)、[发布](docs/RELEASING.md) 和 [上游项目支持索引](docs/projects/README.md) 提供工程说明。用户不需要 Node、npm 或自行构建。

## License

本仓库自有代码与文档采用 [MIT 许可证](LICENSE)。第三方依赖和资源遵循各自的许可证；MaaFramework 相关许可与声明见 [LICENSES](plugins/general/MaaFrameworkDriver/LICENSES/NOTICE.md)。
