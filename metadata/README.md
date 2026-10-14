# 发行元数据

`catalog/stable.json` 是 stable catalog 的唯一生成来源，根目录 `catalog.json` 是供已发布 Host 固定 URL 读取的同字节投影。`releases/stable-state.json` 保存 stable 发行源码游标和逐插件发行事实。候选工具同时生成三份文件，校验集合、字节和来源；stable publisher 在同一个受控提交中更新它们及 `packages/`。禁止独立人工编辑投影或将源码混入生成物提交。

`plugins-develop` Release 中的平面 `catalog.json` 继续使用 preview 协议，与本目录的 stable 元数据分别生成和校验。已发布 `packages/` URL 保持不变。

`contracts/host-compatibility.json` 声明 Host API、Frontend API 和语言兼容契约，不固定某次 SDK 编译 SHA。默认联调来源由 `tests/inputs.lock.json` 管理；`global.json`、`package.json` 和 `package-lock.json` 保持工具约定位置。
