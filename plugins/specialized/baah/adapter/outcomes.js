'use strict';

const BAAH_FAILURE_TEXTS = {
  InWanted: ["无法打开通缉页面，任务退出", "Can't open wanted page, task quit"],
  InSpecial: ["Can't open special page, task quit"],
  InExchange: ["无法打开交换页面，任务退出", "Can't open exchange page, task quit"],
  InEventRecap: ['无法进入剧情一览页面', 'Unable to enter the event recap page',
    'Status_error: 推剧情任务执行失败, 返回', 'STATUS_ERROR: Event story task execution failed, returning'],
  InMomotalk: ['未检测到momotalk弹窗，跳过此任务', 'The momotalk popup is not detected. Skip this task'],
  BuyAP: ['未找到购买按钮', "Can't find buy button", '購入ボタンが見つかりません', '识别单价失败', 'Recognize price failed', '価格の認識に失敗しました'],
  Attendance: ['进入统合出席簿失败', 'Failed to enter the Attendance page']
};
const BAAH_NORMAL_TEXTS = {
  InMomotalk: ['未检测到红点标记，跳过此任务', 'No red dot detected, skipping this task'],
  BuyAP: ['价格超过限制，不购买', 'Price exceeds the limit, not buy', '価格が制限を超えているため、購入しない'],
  InWanted: ['今天轮次中无悬赏通缉关卡，跳过', "There is no wanted level in today's round, skip"],
  InSpecial: ['今天轮次中无特殊关卡，跳过', "There is no special level in today's round, skip", '设置为没有活动不进行，跳过', 'event is not open, skip'],
  InExchange: ['今天轮次中无学院交流会关卡，跳过', "No exchange level in today's round, skip", '设置为没有活动不进行，跳过', 'event is not open, skip']
};

function baahResult(state, taskId, outcome, reason, generation, recovered = false) {
  const prior = state.results.find(item => item.taskId === taskId);
  if (prior?.state === 'failed' && !recovered) return;
  const result = { taskId, state: outcome, reasonCode: reason, generation };
  if (prior) Object.assign(prior, result);
  else state.results.push(result);
}

function baahFail(state, root, reason) {
  if (!root?.taskId) return;
  root.failed = true;
  baahResult(state, root.taskId, 'failed', reason, state.generation);
  if (state.incidents.length >= 128) throw new Error('baah_incident_limit');
  state.incidents.push({ taskId: root.taskId, generation: state.generation, reasonCode: reason });
}
