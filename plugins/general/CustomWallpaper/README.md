# 自定义壁纸

`custom-wallpaper` v0.2.0 使用 NexusPipeline Plugin API 1.6 与 Frontend API 1.5：壁纸配置、单文件与总量配额、文件头校验、SHA256 去重、排序、当前壁纸、按时间或启动轮换、配色推导和插件自有 Web API 全部由插件实现，宿主只提供通用插件资产存储、二进制 Web API 传输与通用外观表面。插件通过 `nxp-collapsible-card`、`nxp-switch-setting`、`nxp-select`、`nxp-number-input`、`nxp-range`、`nxp-file-picker`、`nxp-badge` 等公开元素渲染设置卡片，样式使用插件自有 `cw-*` 命名空间与宿主 `--nx-*` design token。

插件校验图片类型、文件魔数、单文件 8192 KB 上限、32 张数量上限和 256 MiB 总容量，并在前端根据图片内容生成自适应强调色与主界面内容卡片表面色；启用壁纸后仍可使用宿主主题切换按钮。卡片与侧边栏透明度可在 0% 至 50% 之间调节，浅色、深色和跟随系统主题均保持有效。

升级到 v0.2.0 时，宿主会把 `config/appearance.json`、`user-assets/appearance/wallpapers/` 与外观轮换游标一次性搬迁到插件命名空间（保留原文件），插件在初始化时导入壁纸、顺序、当前壁纸、轮换方式、显示效果与已保存配色，随后删除搬迁载荷。
