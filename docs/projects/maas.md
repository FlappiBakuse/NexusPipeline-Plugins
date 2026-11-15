# MaaStellaSora 专项

实例和参数由 [adapter](../../plugins/specialized/maas/adapter/discovery.js)维护，支持身份见 [upstream.json](../../plugins/specialized/maas/upstream.json)。纯数据包、冻结只读资料和 Host 配置恢复的共同规则见[专项指南](../authors/specialized-adapters.md#maa-数据专项共同边界)。

以 `config/instances` 中稳定文件 ID 选择实例，使用 `--instance`。配置继承顺序为 local 非 null → 当前实例 global → default global → global 普通字段；DefaultConfig 缺失时保留原有 `config/config.json` 来源选择。

单文件快照使用已绑定 sourcePath 识别实例，写回继续使用快照内 relativePath 与原修订。配置提案只覆盖授权选择，保留其他实例和未知字段。

日志只接收上游 Monitor 来源、MonitorLog 操作和所选实例范围；顺序与有限重复用于归属，同名歧义保持未核实。原生编辑对绑定 settings 的 NoAutoStart 使用有限 prepare/commit 补丁，取消恢复原字节且不执行 commit。

验证归属见[Maa 覆盖](../reference/maa-coverage.md)，组件入口见[验证指南](../development/validation.md)。真实发行程序与设备资格见[当前状态](../status.md)。
