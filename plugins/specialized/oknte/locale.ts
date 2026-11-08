export const locales = {
  "en-US": {
    "manifest": {
      "displayName": "ok-nte daily",
      "gameName": "Neverness to Everness",
      "summary": "Single-account daily task plans and observations."
    },
    "tasks": {
      "cinema_date": {"title": "Cinema date"},
      "coffee": {"title": "Coffee"},
      "daily_anomaly": {"title": "Anomaly Realm"},
      "daily_anomaly_hunter": {"title": "Anomaly Hunt"},
      "daily_claim": {"title": "Daily rewards"},
      "fountain": {"title": "Fountain check-in"},
      "furniture": {"title": "Anomaly furniture"},
      "gift": {"title": "Gifts"}
    },
    "diagnostics": {
      "runtime_unqualified": "Official release identity or updater state is not ready. Automatic execution is blocked. Initialize and close the official Global launcher, then check the supported version.",
      "oknte_item_completed": "Daily item reported completion",
      "oknte_item_failed": "Daily item reported failure",
      "oknte_item_language_unsupported": "This task is unavailable in the current language",
      "oknte_item_started": "Daily item started",
      "oknte_item_unhandled_exception": "The current item stopped with an unhandled exception",
      "oknte_routine_aborted_before_item": "The routine aborted before this item ran",
      "runtime_installation": "Cannot confirm the official installation ({channel} / {version}). Initialize a supported official channel.",
      "runtime_version": "This release has not been qualified ({channel} / {version}). Check the installed version.",
      "runtime_restricted": "The newer official release {channel} / {version} has not qualified for advanced task interpretation. Only the base run is available; task results remain unverified.",
      "runtime_base_unqualified": "Cannot confirm the official origin or base entry for this newer release ({channel} / {version}). Finish updating or repair the installation.",
      "runtime_busy": "The updater or application is not ready ({channel} / {version}). Finish updating and close it before checking again.",
      "runtime_repository": "Local HEAD/tag differs from the qualified release ({channel} / {version}). Check the official installation.",
      "runtime_code": "Required runtime files are missing or differ from the qualified release ({channel} / {version}). Repair the official installation and check again.",
      "oknte_unknown_enabled_routine_item_preserved": "Enabled unknown routine items are preserved. Safe retry is unavailable.",
      "oknte_dedicated_routine_config_defaults_used": "Dedicated routine settings are absent. Upstream defaults are used and the original configuration is preserved.",
      "oknte_complete_explicit_selection_required_for_retry": "The routine configuration does not contain every task switch. Safe retry requires a complete explicit selection.",
      "oknte_game_target_path_required": "Set the game path in the device configuration."
    }
  },
  "zh-CN": {
    "manifest": {
      "displayName": "ok-nte 日常",
      "gameName": "异环",
      "summary": "单账号日常任务计划、配置隔离与任务结果判定"
    },
    "tasks": {
      "cinema_date": {"title": "影院约会"},
      "coffee": {"title": "一咖舍"},
      "daily_anomaly": {"title": "异象界域"},
      "daily_anomaly_hunter": {"title": "异象追猎"},
      "daily_claim": {"title": "日常领取"},
      "fountain": {"title": "喷泉签到"},
      "furniture": {"title": "异象家具"},
      "gift": {"title": "羁遇赠礼"}
    },
    "diagnostics": {
      "runtime_unqualified": "官方发行版本或更新状态未就绪，已阻止自动运行。请先完成官方 Global 启动器初始化并关闭它，再检查支持版本。",
      "oknte_item_completed": "日常子任务报告完成",
      "oknte_item_failed": "日常子任务报告失败",
      "oknte_item_language_unsupported": "当前语言不支持此任务",
      "oknte_item_started": "日常子任务已开始",
      "oknte_item_unhandled_exception": "当前任务因未处理异常中断",
      "oknte_routine_aborted_before_item": "日常流程中断，此任务尚未执行",
      "runtime_installation": "无法确认官方安装身份（{channel} / {version}），请初始化受支持的官方渠道。",
      "runtime_version": "当前发行版本尚未通过适配验证（{channel} / {version}），请检查安装版本。",
      "runtime_restricted": "官方新发行 {channel} / {version} 尚未验证高级任务判定；本次仅运行基础流程，任务结果保持未核验。",
      "runtime_base_unqualified": "新发行的官方身份或基础入口无法确认（{channel} / {version}），请完成更新或修复安装。",
      "runtime_busy": "更新器或上游程序尚未就绪（{channel} / {version}），请完成更新并关闭后重新检查。",
      "runtime_repository": "本地 HEAD/tag 与受支持发行不一致（{channel} / {version}），请核对官方安装。",
      "runtime_code": "关键运行文件缺失或与已验证发行不同（{channel} / {version}），请修复官方安装后重新检查。",
      "oknte_unknown_enabled_routine_item_preserved": "已保留启用的未知日常任务；安全重试不可用。",
      "oknte_dedicated_routine_config_defaults_used": "未提供独立日常设置，当前使用上游默认值，原配置保持原样。",
      "oknte_complete_explicit_selection_required_for_retry": "日常配置未完整保存任务开关，安全重试需要明确的完整选择。",
      "oknte_game_target_path_required": "请在设备配置中填写游戏路径。"
    }
  }
} as const;
