import { phase, remaining, status, formatTime } from '../../plugins/managed/game-activities/frontend/src/time-view.ts';

export async function runActivityRules({test}) {
  await test('activity phase preserves incomplete and contradictory times',async()=>{
    const now=Date.parse('2026-10-24T00:00:00Z'),t=value=>value;
    const cases=[
      {start:'2026-10-23',end:undefined,expected:'unknown'},
      {start:undefined,end:'2026-10-25',expected:'unknown'},
      {start:'2026-10-26',end:'2026-10-25',expected:'unknown'},
      {start:'2026-10-24',end:'2026-10-24',expected:'unknown'},
      {start:undefined,end:'2026-10-23',expected:'ended'},
      {start:'2026-10-25',end:undefined,expected:'upcoming'},
      {start:'2026-10-23',end:'2026-10-25',expected:'ongoing'},
      {start:undefined,end:undefined,expected:'unknown'},
    ];
    for(const item of cases){
      const event={id:'event',title:'Fixture',startsAt:item.start,endsAt:item.end};
      if(phase(event,now)!==item.expected)throw Error('Unexpected phase: '+JSON.stringify(item));
      if(item.expected==='unknown'&&status(event,now,t)!=='时间待核验')throw Error('Unknown event has a known status label');
    }
    for(const [delta,expected] of [[1,'1 秒'],[59999,'59 秒'],[60000,'1 分钟 0 秒'],
      [3599999,'59 分钟 59 秒'],[3600000,'1 小时 0 分钟'],[172800000,'48 小时 0 分钟'],[259200000,'3 天 0 小时']]){
      const value=remaining({instantUtc:new Date(now+delta).toISOString()},now,t);
      if(value!=='距离结束 '+expected)throw Error('Countdown boundary changed: '+delta+' => '+value);
    }
    if(remaining({instantUtc:new Date(now).toISOString()},now,t)!=='已结束')throw Error('End boundary is not ended');
    if(formatTime(null,'UTC','zh-CN',t)!=='时间待核验')throw Error('Missing date has no explicit unverified label');
    if(formatTime({instantUtc:null,rawValue:'source text'},'UTC','zh-CN',t)!=='时间待核验 · source text')throw Error('Unverified source text was lost');
    const date=formatTime({instantUtc:'2026-10-24T00:00:00Z',timeBasis:'source-default',sourceZone:'Asia/Tokyo'},'UTC','zh-CN',t);
    if(!date.endsWith(' · 默认 UTC+9'))throw Error('Default source time zone lost its label');
  });
}
