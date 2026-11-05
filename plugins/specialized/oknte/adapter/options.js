'use strict';

function oknteChildOption(id, key, value) {
  const finite = (minimum, maximum) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;
  if (['daily_anomaly', 'daily_anomaly_hunter'].includes(id) && key === '目标消耗体力') return finite(0, 100000);
  if (id === 'daily_anomaly') {
    const choices = { 任务类型: ['经验与甲硬币', '异能升级材料', '弧盘突破材料', '空幕'], 具体奖励目标: ['角色经验', '弧盘经验', '甲硬币'],
      循环模式: ['停用', '自动循环序号/目标', '自定义循环'] };
    if (choices[key]) return choices[key].includes(value);
    if (['异能材料序号', '弧盘材料序号', '空幕序号'].includes(key)) return finite(1, key === '空幕序号' ? 6 : 5);
    if (key === '循环序列') {
      const allowed = ['角色经验', '弧盘经验', '甲硬币'];
      for (const [name, max] of [['异能升级材料', 5], ['弧盘突破材料', 5], ['空幕', 6]])
        for (let number = 1; number <= max; number++) allowed.push(name + ': ' + number);
      return Array.isArray(value) && value.length <= allowed.length && new Set(value).size === value.length && value.every(item => allowed.includes(item));
    }
  }
  if (id === 'daily_anomaly_hunter' && key === '追猎目标') return ['音霸魔王', '无首铁驭', '塞润尼缇', '黑之书', '海囚', '围巢鸟', '斑蝶'].includes(value);
  if (id === 'daily_claim' && ['邮件', '活跃度奖励', '环期任务奖励'].includes(key) || id === 'furniture' && key === '挑战玛门') return typeof value === 'boolean';
  if (id === 'cinema_date' && key === '约会目标') return typeof value === 'string' && value.length <= 256;
  if (id === 'fountain' && key === '签到方式') return ['签到', '捞币'].includes(value);
  if (id === 'coffee') {
    if (['领取收益', '补货货物', '购买货物送货上门', '优化商品'].includes(key)) return typeof value === 'boolean';
    if (key === '模式') return value === '领取/补货';
    if (key === '商品位数量') return ['auto', '1', '2', '3', '4', '5'].includes(value);
    if (key === '价格表') return ['auto', 'disabled'].includes(value);
    if (key === '补货时长') return ['auto', '2小时', '4小时', '8小时', '24小时'].includes(value);
  }
  return false;
}
