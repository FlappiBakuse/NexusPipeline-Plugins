# 专项适配器开发

专项解释真实程序入口、配置、任务和日志，Host 管理文件、进程、事务和恢复。固定上游身份见[来源索引](../reference/upstream-oracles.md)，插件特有语义见[项目参考](../README.md#项目参考)。

## 代码入口

| 位置 | 职责 |
|---|---|
| `plugins/specialized/<id>/extension.json` | 能力、权限、实例策略与本地化声明 |
| `adapter/discovery.js` | 用所选根的受限输入发现程序、参数、资源与候选 |
| `adapter/main.js`、`sources.json` 闭包 | 解释四阶段任务、配置、观察与重试请求 |
| `adapter-runtime/core` | 多个实际消费者共有的纯协议规则 |
| `adapter-runtime/frameworks` | 已支持框架的共同配置与日志语义 |

手写源按 sources.json 顺序合并到仓外 bundle，不提交生成脚本。适配器不直接启动程序、写文件、联网或加载 native 对象。

## 协议和修复

请求保留 format/version/direction、插件、phase、operationId 和 run/attempt/plan 身份。配置提案绑定资源、原 SHA、revision、expected 值与精确 selector；Host 核验权限、物理来源与事务。

### BAAH 修复闭环

文件日志关闭时，配置阶段返回运行阻断诊断和 false→true 的精确修复。Host 的 preview/apply 对候选重新核验，保留摘要、修订、原操作、expected-value 和受保护字段。陈旧候选拒绝。运行诊断与修复准入分别归所属 owner，具体键和来源见[BAAH](../projects/baah.md)。

OkNTE 日常参数、BAAH 日志 glob 和主流来源的独立依据见[上游参考](../reference/upstream-oracles.md)，本页不重复维护参数表。

## 配置接续与重试

普通调用的活动配置接续由 Host 维护。专项只提出冻结范围内的任务选择或原入口续跑建议，保留原生进度、日期、额度、次数、未知字段和其他实例。

失败子集只包含已选、启用、明确失败且获准安全重试的任务；partial、unknown 和未知副作用保持原事实。技术准备依赖由当前插件声明，Host 冻结并核验 writer 停止、配置还原及预算。

## Maa 数据专项共同边界

MaaEnd/MaaStellaSora 调用用户自行安装的上游程序。两者保持数据包：manifest、adapter、说明与本地化；无 DLL、worker、native 或浏览器模块，也不要求安装通用 MaaFramework 驱动。

账号配置使用保存快照；interface/import/locale 的只读资料按声明闭包冻结，独立于配置交换。任务保留顺序、选项、自定义名称和未知原值。未知禁用项保留，未知启用项的诊断与重试按各插件实现处理。

日志核对 source、epoch、sequence 与最终 drain，真实进程和恢复事实归 Host。原生编辑通过已有配置事务启动、采集和还原，停止证明通过后才发布结果。各插件实例、格式和日志规则见对应项目页；专项与通用框架的验证归属见[Maa 覆盖](../reference/maa-coverage.md)。

## 验证与构建

按修改选择固定入口消费者、真实日志来源、配置 CAS、任务结果和重试范围等产品假设。共享 runtime 改动扩大到实际消费者。Node 与 Host/Jint 的现役命令由[验证指南](../development/validation.md)维护，构建与打包由[构建指南](../development/building.md)维护。
