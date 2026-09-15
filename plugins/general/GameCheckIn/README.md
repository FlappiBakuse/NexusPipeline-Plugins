# 游戏自动签到

`game-checkin` v0.2.0 在用户脚本开始运行时，按已选择的平台执行游戏内签到，并通过 Plugin API v1.5 的本地化资源提供 zh-CN/en-US 展示文案。

支持的平台与游戏：

- 米游社：原神、崩坏：星穹铁道、绝区零、崩坏3
- HoYoLAB：Genshin Impact、Honkai: Star Rail、Zenless Zone Zero、Honkai Impact 3rd
- 森空岛：明日方舟、明日方舟：终末地
- SKPORT：Arknights: Endfield
- 库街区：鸣潮、战双帕弥什

米游社、HoYoLAB、森空岛、SKPORT 与库街区使用独立凭据。米游社与 HoYoLAB 流程会查询角色与当日状态；返回验证码时记录需要手动处理的状态并停止该账号当前平台的后续请求。森空岛与 SKPORT 使用通行证 Token、临时授权凭据和请求签名；库街区使用 Token 查询角色并提交游戏签到表单。

用户设置使用 schema v3。米游社和 HoYoLAB 的既有 `cn:*`、`os:*` 状态键继续保留；新平台使用 `skland:*`、`skport:*`、`kuro:*` 状态键。凭据仅通过宿主 secret 存储与读取投影使用，用户列表徽章只显示汇总状态。

签到凭据与第三方接口可能受账号状态、设备指纹、验证码和风控影响。真实账号验证时请在 NexusPipeline 设置页面填写凭据，避免将 Cookie 或 Token 写入日志、测试 fixture 或对话内容。
