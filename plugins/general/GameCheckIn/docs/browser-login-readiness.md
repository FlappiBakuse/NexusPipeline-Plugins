# 网页登录资格

资格按平台与采集规则版本维护；网页登录按钮只向可信本机 Electron 客户端显示。其他客户端继续手动配置与专用回读。真实平台验证不执行签到或领取奖励。

| 平台 | flow / extractor | 资格 | 已验证登录方式 |
| --- | --- | --- | --- |
| HoYoLAB | 1 / 1 | passed | 官方网页邮箱密码 |
| 米游社 | 1 / 1 | not_run | 未执行 |
| 森空岛 | 1 / 1 | not_run | 未执行 |
| SKPORT | 1 / 1 | not_run | 未执行 |
| 库街区 | 1 / 1 | not_run | 未执行 |

## 适配代码与采集边界

资格与代码完成度分别记录。米游社和库街区已有固定采集规则、规范化、只读核验和编辑器候选接线，仍未开放网页登录按钮。森空岛和 SKPORT 已有独立域名及 appCode 的原始通行证 Token 鉴权交换、签名用户查询与角色绑定查询；网页登录采集尚未接线，不能称为五平台完整网页登录通过。

| 平台 | 凭据消费类型与只读验证 | 未执行或未支持范围 |
| --- | --- | --- |
| 米游社 | 完整 Cookie 字符串，仅选 CookieToken/account ID 对应字段；角色绑定查询及现役 info 查询产生脱敏角色身份 | 实际 CookieToken 新旧字段采集、登录跳转与官方账号核验均 not_run |
| 库街区 | `www.kurobbs.com` 的 `localStorage.auth_token` 原始字符串，作为现役客户端 token header；查询两款游戏绑定，拒绝混合账号 | 实际登录方式、账号、网页 token 对现役客户端的兼容性均 not_run |
| 森空岛 | Hypergryph 原始通行证 Token；鉴权交换只在内存使用 cred/signToken；签名用户查询证明身份，绑定查询验证现役协议 | 当前网页只持久化派生 cred；原始 Token 采集未支持，真实平台 not_run |
| SKPORT | GRYPHLINE 原始通行证 Token，鉴权域名和 appCode 与森空岛分离；独立签名用户及绑定查询 | 原始 Token 经服务端 cookie store 读取；尚无已确认的固定 Cookie 捕获规则，真实平台 not_run |

米游社仅采集 `.mihoyo.com` / `.miyoushe.com`、`/` 下的 `cookie_token_v2/account_id_v2/account_mid_v2` 或旧 `cookie_token/account_id`；字段必须构成同一域内的完整组合，同名冲突与不同账号拒绝，不以 Cookie 中的 ID 直接证明身份。库街区不采集 `auth` 用户资料或账户中心 `accessToken`。两者都不导出完整 Cookie/storage。

采集依据来自[米游社官网](https://www.miyoushe.com/)及其[官方账号 SDK](https://webstatic.mihoyo.com/dora/biz/mihoyo-account-sdk/main.js)、[库街区官网](https://www.kurobbs.com/login-page)的当前前端。米游社 CookieToken 具体字段仍须实采确认；官网 SDK 的身份字段命名不能替代这项验证。

[森空岛官方账号 SDK 3.4.0](https://web.hycdn.cn/hg_account_web_sdk/lib/3.4.0/hg-account-web-sdk.min.js)通过服务端账户会话读取原始 Token，网页保存的 `SK_OAUTH_CRED_KEY` 是派生 cred。[GRYPHLINE 官方账号 SDK 2.0.0](https://web-static.hg-cdn.com/gl_account_web_sdk/2.0.0/gl-account-web-sdk.min.js)通过固定 cookie-store API 读取原始 Token。`HG_OAUTH_TOKEN` 是应用授权缓存，不能认定为原始通行证 Token。现役 Host 只提供固定 Cookie/storage 采集，不提供页面任意脚本、网络响应拦截或全部 Cookie 导出，因此不注册猜测字段的森空岛/SKPORT flow。接线需先确认能返回原始 Token 的有限字段或经审核的固定交换方案，再做真实资格核验。

新增只读核验拒绝 HTTP 错误、缺字段、重复认证字段、超限响应和非法 Token；米游社/库街区的空角色响应不能证明身份。森空岛/SKPORT 只有独立用户查询已证明身份后，才允许空绑定列表。只读核验不调用签到、社区任务或奖励接口；既有签到仍按平台业务响应解释“今日已签到”。受控用例覆盖不等于官方平台验证。

## 已知平台行为

用户已完成人工界面验收，并反馈 HoYoLAB 部分游戏返回“需要手动完成验证码，本次已停止”。该结果属于平台人工验证要求；本版记录现象，保留停止处理，不增加验证码自动处理或自动重试。此反馈不能作为这些游戏实际签到成功的证据。

## HoYoLAB 已有真实资格

HoYoLAB 在 2026-10-10（Asia/Shanghai）、Windows 11 x64、Electron 44.5.1、Host 0.17.2 / Plugin API 2.2 / Frontend API 1.7、GameCheckIn 0.4.2 的本机独立核验环境完成真实人工验证。验证使用实际桌面窗口、监督管道、当前 SDK 和实际插件服务；资格环境仅开放 HoYoLAB，并拦截实际签到写入。

导航规则限定 `www.hoyolab.com`、`account.hoyoverse.com` 和 `account.hoyolab.com` 的 HTTPS origin。本次邮箱密码链路在此允许范围内完成；其他登录方式和额外跳转域为 `not_run`。实际采集只包含 `.hoyolab.com`、`/` 下的 `ltoken_v2`、`ltuid_v2`、`ltmid_v2`，没有 storage。兼容旧字段 `ltoken/ltuid` 的格式处理通过受控测试，其真实登录采集为 `not_run`。

只读身份来自 `api-account-os.hoyolab.com/binding/api/getUserGameRolesByLtoken` 的已认证角色响应，使用返回的 `game_uid` 生成脱敏身份；原神 `sg-hk4e-api.hoyolab.com/event/sol/info` 确认同一凭据适用于现役查询。两者实际返回 HTTP 200 / retcode 0。空角色响应不构成可靠身份，本次拒绝生成候选；其他游戏的角色回退验证为 `not_run`。实际签到状态查询另已对原神、星铁、绝区零返回成功，但签到写入被核验环境拒绝，不能记为真实签到通过。

人工确认了成功后脱敏候选与保存、自动凭据首次显示确认/取消/确认后显示/隐藏、清除后取消保留、重新开窗为未登录环境以及直接取消保留旧凭据。未登录时点击完成返回 `credential_fields_missing`，关闭后实际终态为 Cancelled；成功终态 Completed 在窗口清理之后发布。独立 Host 退出及重启成功，临时登录会话未复用。

客户端隔离、24 小时单调期限、撤销、晚到候选、回滚和写入失败由受控测试覆盖，不将推进时钟或注入故障称为真实平台异常。真实平台过期/风控/未绑定账号、第三方登录及长时间浸泡为 `not_run`。改变 flow/采集规则或平台协议后须重新核验，不能沿用版本不匹配的资格。
