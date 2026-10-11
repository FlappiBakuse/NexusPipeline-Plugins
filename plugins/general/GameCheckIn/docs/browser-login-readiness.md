# 网页登录范围与认证

网页登录按钮只向可信本机 Electron 客户端显示。其他客户端使用手动配置与专用回读。网页登录认证仅执行只读查询，签到由任务执行流程发起。

| 平台 | flow / extractor |
| --- | --- |
| HoYoLAB | 1 / 1 |
| 米游社 | 3 / 2 |
| 森空岛 | 5 / 3 |
| SKPORT | 7 / 3 |
| 库街区 | 3 / 2 |

## 起始页面

插件固定维护起始网址，不保存最后浏览页面。米游社为 `https://www.miyoushe.com/ys/`，库街区为 `https://www.kurobbs.com/mc/home/9`；森空岛、SKPORT 和 HoYoLAB 分别为各自官网根路径。每次开窗或刷新起始页重新尝试登录入口，已登录或已有登录框时跳过；HoYoLAB 不注册初始化脚本，保留网站自行弹出登录。SKPORT 先打开头像菜单，再点击文字明确且唯一的登录项，每步每次加载至多一次；菜单出现退出项时按已登录处理，未知或歧义菜单保留手动操作；其余三站入口只点击一次。页面异步入口最多等待 30 秒，同一地址的 history 初始化不终止等待；离开登记路径、取消或采集时停止自动操作。米游社脚本资源为 `miyoushe.js`，对应固定平台 ID `cn`。自动操作失败可继续手动登录和采集。

## 采集与可用状态

五个平台均支持本机桌面网页登录。采集规则与平台参数由插件维护；平台身份核实后生成候选，保存任务后凭据才持久化。

| 平台 | 固定采集与只读验证 |
| --- | --- |
| 米游社 | 同域 CookieToken/account ID 固定字段组合；无目标 UID 的 getUserFullInfo 当前用户查询、getUserGameRolesByCookieToken 角色绑定及现役 info 查询 |
| HoYoLAB | 固定 ltoken/ltuid 字段组合；角色绑定及现役 info 查询 |
| 库街区 | www.kurobbs.com 的 localStorage.auth_token 与可选 distinct_id；H5 参数查询 mineV2 当前用户及两款游戏绑定 |
| 森空岛 | 当前临时浏览器会话 POST https://web-api.skland.com/account/info/hg/check，仅提取 data.content 原始通行证 Token，同时读取 localStorage.SK_SHUMEI_DEVICE_ID_KEY 中的实际设备信息 |
| SKPORT | 当前临时浏览器会话 GET https://web-api.skport.com/cookie_store/account_token，仅提取 data.content 原始通行证 Token |

通行证读取依据为[森空岛官网](https://www.skland.com/)所配置的 web-api.skland.com 与[官方账号 SDK](https://web.hycdn.cn/hg_account_web_sdk/lib/3.4.0/hg-account-web-sdk.min.js)，以及 [GRYPHLINE 官方账号 SDK](https://web-static.hg-cdn.com/gl_account_web_sdk/2.0.0/gl-account-web-sdk.min.js) 的固定 cookie-store 查询。登录导航须处于平台注册的 HTTPS origin 与路径范围内；额外第三方跳转可能不受支持。

森空岛与 SKPORT 不采集派生 cred 或应用授权缓存作为通行证。Host 仅在用户点击完成登录后执行已注册的固定请求，页面初始化函数只操作登录 UI；采集不接受任意脚本、任意请求参数、网络拦截或全部 Cookie 导出。两款平台分别执行原始 Token 鉴权交换、签名用户查询和角色绑定查询，使用独立域名与 appCode，不执行签到或领取奖励来核验登录。

请求限定 HTTPS、精确地址、GET 或空 POST、无重定向、JSON 类型和 64 KiB 响应上限，只返回指定路径的字符串；取消即终止请求并清理临时会话。凭据继续绑定当前客户端、编辑会话和字段代次，窗口清理成功后才发布候选，保存任务才持久化。

## 已知平台行为

HoYoLAB 部分游戏可能返回“需要手动完成验证码，本次已停止”。插件停止本次处理，保留人工验证要求，不自动绕过验证码或自动重试。

## HoYoLAB 认证

导航限定 `www.hoyolab.com`、`account.hoyoverse.com` 和 `account.hoyolab.com` 的 HTTPS origin。采集 `.hoyolab.com`、`/` 下的 `ltoken_v2`、`ltuid_v2`、`ltmid_v2`，兼容旧字段 `ltoken/ltuid`；不读取 storage。

只读身份来自 `api-account-os.hoyolab.com/binding/api/getUserGameRolesByLtoken` 的已认证角色响应，使用返回的 `game_uid` 生成脱敏身份，并通过现役签到 info 查询核验。空角色响应不足以确认身份，不生成候选。

候选绑定当前客户端与编辑会话，创建满两小时或 30 分钟未活动后失效；自动凭据的明文回读确认最长 24 小时，期限使用单调时钟。临时窗口与会话清理成功后才发布 Completed；取消、关闭或过期候选不能替换已保存凭据。

## 网页认证与诊断

米游社、森空岛、SKPORT 和库街区必须由当前用户接口核实身份；已认证但没有游戏角色时允许保存，任务执行按无角色结果处理。米游社有角色时还需通过现役签到 info 只读核验。

森空岛授权交换、用户及绑定签名查询使用同一网页设备 dId、platform 3 与 vName 1.0.0；缺失设备信息提示重新登录。SKPORT 用户接口为 /web/v2/user，当前用户身份读取 data.user.basicUser.id；森空岛 /web/v1/user 读取 data.user.id。分别校验精确响应结构，不回退到其他账号字段。SKPORT 使用独立官网参数，不生成森空岛设备身份。库街区新网页凭据的验证与执行均使用 source h5；旧手动记录保留原参数。必要网页上下文随专用凭据密文持久化，普通 DTO、明文回读和日志不返回上下文；修改凭据明文会清除上下文，旧记录不自动改写。

森空岛网页设备 ID 作为不透明字符串原样参与授权和签名；校验长度及 HTTP Header 字符，不假定前缀或编码格式。签名 Header JSON 使用与官网 JSON.stringify 一致的字符编码。两站当前用户响应中的字符串 ID 支持数字、字母、下划线与连字符，校验长度并遮罩显示，不将凭据或 Cookie ID 视为身份。

官方登录后的页面刷新继续使用同一临时会话。刷新完成后点击“完成登录”，读取当前会话的指定字段；成功或取消后清理临时会话。“新凭据待保存”显示在对应输入框的 placeholder，保存成功后恢复已配置状态。

验证日志只含平台、operation、固定阶段、HTTP 状态、业务码和失败类别，不含凭据、账号、响应正文或请求 URL。阶段区分 capture、passport_grant、credential_exchange、current_user、bindings、roles_游戏代码与 info_游戏代码。主动取消保持静默；真实失败由编辑器提示一次。
