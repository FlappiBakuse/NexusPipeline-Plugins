export const locales = {
  "en-US": {
    "manifest": {
      "displayName": "BetterGI",
      "gameName": "Genshin Impact",
      "summary": "Manage BetterGI script instances and resolve the program, configuration, log, and startup paths."
    },
    "tasks": {
      "claim_mail": {"title": "Claim mail"},
      "condensed_resin": {"title": "Craft Condensed Resin"},
      "domains": {"title": "Auto domains"},
      "bosses": {"title": "Auto boss hunting"},
      "stygian_onslaught": {"title": "Auto Stygian Onslaught"},
      "ley_line_blossoms": {"title": "Auto Ley Line blossoms"},
      "daily_rewards": {"title": "Claim daily rewards"},
      "serenitea_pot_rewards": {"title": "Claim Serenitea Pot rewards"}
    },
    "diagnostics": {
      "bettergi_finish_action": "The action after BetterGI finishes may affect subsequent queue work.",
      "bettergi_leyline_failed": "Ley Line task reported failure",
      "bettergi_daily_guild_exception": "Daily commission reward exception",
      "bettergi_resin_exception": "Resin task exception",
      "bettergi_mail_claim": "Mail claim confirmed",
      "bettergi_mail_empty": "No mail to claim",
      "bettergi_mail_exception": "Mail claim exception",
      "bettergi_leyline_not_due": "Ley Line task is not due",
      "bettergi_omitted_tasks_preserved": "Tasks outside the execution order are preserved and remain unselected.",
      "bettergi_undeclared_tasks_preserved": "Tasks without a complete definition or switch are preserved. Check the One Dragon configuration.",
      "bettergi_cursor_unknown": "The resume position does not match a current task. Check the One Dragon resume settings first.",
      "bettergi_completion_action_requires_host_policy": "Set the One Dragon completion action to None and let the queue handle completion actions.",
      "bettergi_selected_configuration_mismatch": "The One Dragon configuration selected in the program differs from this account configuration."
    }
  },
  "zh-CN": {
    "manifest": {
      "displayName": "更好的原神",
      "gameName": "原神",
      "summary": "BetterGenshinImpact 专项脚本实例配置接管（自动推导主程序、配置、日志路径与自启动参数，按用户接管指定的一条龙配置）"
    },
    "tasks": {
      "claim_mail": {"title": "领取邮件"},
      "condensed_resin": {"title": "合成树脂"},
      "domains": {"title": "自动秘境"},
      "bosses": {"title": "自动首领讨伐"},
      "stygian_onslaught": {"title": "自动幽境危战"},
      "ley_line_blossoms": {"title": "自动地脉花"},
      "daily_rewards": {"title": "领取每日奖励"},
      "serenitea_pot_rewards": {"title": "领取尘歌壶奖励"}
    },
    "diagnostics": {
      "bettergi_finish_action": "BetterGI 一条龙完成后的系统动作可能影响队列后续工作。",
      "bettergi_leyline_failed": "地脉任务报告失败",
      "bettergi_daily_guild_exception": "每日委托领奖异常",
      "bettergi_resin_exception": "树脂任务异常",
      "bettergi_mail_claim": "已确认领取邮件",
      "bettergi_mail_empty": "没有可领取邮件",
      "bettergi_mail_exception": "领取邮件异常",
      "bettergi_leyline_not_due": "当前无需执行地脉任务",
      "bettergi_omitted_tasks_preserved": "执行顺序未包含的任务已保留，当前未选中。",
      "bettergi_undeclared_tasks_preserved": "缺少完整定义或开关的任务已保留，请检查一条龙配置。",
      "bettergi_cursor_unknown": "续跑位置未匹配当前任务，请先检查一条龙续跑设置。",
      "bettergi_completion_action_requires_host_policy": "请将一条龙结束动作设为无操作，由队列统一处理后续动作。",
      "bettergi_selected_configuration_mismatch": "主程序当前选择的一条龙配置与账号配置不一致。"
    }
  }
} as const;
