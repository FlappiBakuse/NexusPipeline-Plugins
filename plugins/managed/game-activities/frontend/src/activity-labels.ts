import type { Translate } from '../../../frontend-ui/src/localize.js';

export const activityGames = [
  ['blue-archive', '蔚蓝档案'],
  ['genshin-impact', '原神'],
  ['arknights-endfield', '明日方舟：终末地'],
  ['stella-sora', '星塔旅人'],
  ['honkai-star-rail', '崩坏：星穹铁道'],
  ['neverness-to-everness', '异环'],
  ['wuthering-waves', '鸣潮'],
  ['zenless-zone-zero', '绝区零']
] as const;

export function gameName(id: string, t: Translate): string {
  return t(activityGames.find((item) => item[0] === id)?.[1] ?? id);
}
