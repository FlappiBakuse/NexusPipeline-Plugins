import { choose } from './controls.mjs';

export async function activitySurfaceCases({page,test}) {
  await test('activity error toast translates across live locale changes', async () => {
    await mount();
    await page.evaluate(() => { window.fixture.ports.refreshAll = async () => { throw Error('activity_state_invalid'); }; });
    await page.getByRole('button', { name: '刷新', exact: true }).click();
    await page.getByText('活动数据无效，请刷新活动。', { exact: true }).waitFor();
    await page.evaluate(() => window.fixture.setLocale('en-US'));
    await page.getByText('Activity data is invalid. Refresh activities.', { exact: true }).waitFor();
    await page.evaluate(() => window.fixture.setLocale('zh-CN'));
    await page.getByText('活动数据无效，请刷新活动。', { exact: true }).waitFor();
  });

  async function mount(localZone=false) {
    await page.evaluate(async localZone=>{
      const point={instantUtc:'2030-01-01T00:00:00Z',rawValue:'',timeBasis:'utc',sourceZone:'UTC'};
      const feed=(game,id,title,progression='cn')=>({id,game,server:progression==='cn'?'国服':'日服',progressionId:progression,
        contentLocale:'zh-CN',enabled:true,overview:{title,coverId:id,end:point},
        events:[{id:id+'-event',title:title+' Event',start:{...point,instantUtc:'2020-01-01T00:00:00Z'},playEnd:point}]});
      let state={revision:1,selectedFeedIds:['gi','hsr'],gameOrder:['genshin-impact','honkai-star-rail','blue-archive'],
        rotationSeconds:30,pauseOnHover:true,pauseWhenHidden:true,pauseOnInteraction:true,displayZone:'Asia/Shanghai',
        progressions:{'blue-archive':'cn'},progressionOptions:{'blue-archive':[{value:'cn',label:'国服'},{value:'jp',label:'日服'}]},
        feeds:[feed('genshin-impact','gi','Alpha'),feed('honkai-star-rail','hsr','Beta'),
          feed('blue-archive','ba-cn','Blue Archive'),feed('blue-archive','ba-jp','Blue Archive JP','jp')]};
      if(localZone)delete state.displayZone;
      window.activityReads=0;window.activityWrites=0;window.activityState=state;
      await window.testMount('game-activities',{readState:async()=>state,subscribe:()=>()=>{},refreshAll:async()=>state,
        readCover:async()=>{window.activityReads++;return window.fixturePng();},
        saveSettings:async value=>{window.activityWrites++;state={...value,revision:state.revision+1};window.activityState=state;return state;}},'overview.cards');
    },localZone);
    await page.locator('.activity-slide[aria-hidden=false]').getByText('Alpha',{exact:true}).waitFor();
  }

  await test('activity resize animates both directions and honors reduced motion', async () => {
    await mount();
    const height = () => page.locator('.activity-viewport').evaluate(element => element.getBoundingClientRect().height);
    const synchronizedCover = async () => {
      const result = await page.locator('.activity-viewport').evaluate(element => {
        const animations = element.getAnimations({ subtree: true });
        for (const animation of animations) { animation.pause(); animation.currentTime = 120; }
        const height = element.getBoundingClientRect().height;
        const cover = element.querySelector('.activity-slide[aria-hidden=false] .activity-cover');
        const coverHeight = cover?.getBoundingClientRect().height;
        for (const animation of animations) animation.play();
        return { height, coverHeight };
      });
      if (!result.coverHeight || Math.abs(result.height - result.coverHeight) > 1)
        throw Error('Cover and viewport did not resize together: ' + JSON.stringify(result));
    };
    const initial = await height();
    await page.getByRole('button', { name: '放大卡片', exact: true }).click();
    if (!await page.locator('.activity-viewport').evaluate(element => element.getAnimations().length > 0))
      throw Error('Expansion has no running height animation');
    await synchronizedCover();
    await page.waitForTimeout(300);
    const expanded = await height();
    if (expanded <= initial) throw Error('Expansion did not increase the card height');
    await page.getByRole('button', { name: '缩小卡片', exact: true }).click();
    if (!await page.locator('.activity-viewport').evaluate(element => element.getAnimations().length > 0))
      throw Error('Collapse has no running height animation');
    await synchronizedCover();
    await page.waitForTimeout(300);
    if (Math.abs(await height() - initial) > 1) throw Error('Collapse did not restore card height');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '放大卡片', exact: true }).click();
    if (!await page.locator('.activity-viewport').evaluate(element => element.getAnimations().length === 0))
      throw Error('Reduced motion retained a resize animation');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  await test('activity overview without an explicit display zone uses the browser local zone',async()=>{
    await mount(true);
    const time=await page.locator('.activity-slide[aria-hidden=false] .activity-deadline time').innerText();
    if(!await page.evaluate(()=>Intl.DateTimeFormat().resolvedOptions().timeZone==='Asia/Tokyo')||!time.endsWith('09:00'))
      throw Error('The local-zone deadline was rendered as a different time: '+time);
  });

  await test('activity selection preserves focus and returns from details',async()=>{
    await mount();
    await page.getByRole('button',{name:'下一款游戏',exact:true}).click();
    await page.locator('.activity-slide[aria-hidden=false]').getByText('Beta',{exact:true}).waitFor();
    if(!await page.getByRole('button',{name:'下一款游戏',exact:true}).evaluate(element=>element.matches(':focus-within')||document.activeElement===element))
      throw Error('Activity navigation lost keyboard focus');
    await page.getByRole('button',{name:'查看崩坏：星穹铁道活动详情',exact:true}).click();
    await page.getByRole('heading',{name:'Beta Event',exact:true}).waitFor();
    await page.keyboard.press('Escape');
    const exit=await page.evaluate(()=>{
      const modal=document.querySelector('nexus-modal');
      return {connected:!!modal,open:modal?.open,inert:modal?.inert,content:modal?.textContent.includes('Beta Event')};
    });
    if(!exit.connected||exit.open||!exit.inert||!exit.content)throw Error('Modal discarded its normal exit content: '+JSON.stringify(exit));
    await page.locator('nexus-modal').waitFor({state:'detached'});
    if(!await page.evaluate(()=>document.activeElement?.classList.contains('activity-hit')))throw Error('Modal did not return focus to the active card');
    await page.evaluate(()=>window.fixture.hide());
    await page.evaluate(()=>window.fixture.show());
    await page.locator('.activity-slide[aria-hidden=false]').getByText('Beta',{exact:true}).waitFor();
  });

  await test('activity settings retain active input while hidden and reject invalid completed values',async()=>{
    await mount();await page.getByRole('button',{name:'活动设置',exact:true}).click();
    const number=page.getByRole('spinbutton',{name:'轮播频率（秒）',exact:true});
    await number.fill('25');
    await page.evaluate(()=>window.fixture.hide());
    if(!await page.locator('nexus-modal').evaluate(element=>!element.open&&element.inert))throw Error('Hidden settings left an active modal');
    await page.evaluate(()=>window.fixture.show());
    if(await number.inputValue()!=='25')throw Error('Hidden settings lost their active input');
    const before = await page.evaluate(()=>window.activityWrites);
    for(const raw of ['121','10.5','']){
      await number.fill(raw);await page.locator('nexus-modal').getByRole('button',{name:'保存',exact:true}).click();
      if(await page.evaluate(()=>window.activityWrites)!==before)throw Error('Invalid numeric text caused a save: '+raw);
      if(await number.inputValue()!==raw)throw Error('Invalid numeric text was replaced: '+raw);
      if(await page.locator('nexus-number-input').getAttribute('aria-invalid')!=='true')throw Error('Numeric validity was not public');
    }
    await number.fill('-1');await page.locator('nexus-modal').getByRole('button',{name:'保存',exact:true}).click();
    await page.locator('nexus-modal').waitFor({state:'detached'});
    if(!await page.evaluate(before=>window.activityWrites===before+1&&window.activityState.rotationSeconds===-1,before))throw Error('Corrected interval did not save once');
  });

  await test('unsubscribed activity progression survives save without subscribing the game',async()=>{
    await mount();await page.getByRole('button',{name:'活动设置',exact:true}).click();
    const select=page.locator('nexus-select[aria-label="蔚蓝档案 内容进度"]');await choose(select,'jp');
    await page.locator('nexus-modal').getByRole('button',{name:'保存',exact:true}).click();await page.locator('nexus-modal').waitFor({state:'detached'});
    if(!await page.evaluate(()=>window.activityState.progressions['blue-archive']==='jp'
      &&window.activityState.selectedFeedIds.length===2&&!window.activityState.selectedFeedIds.some(id=>id.startsWith('ba-'))))throw Error('Dormant progression was discarded or subscribed');
    await page.getByRole('button',{name:'活动设置',exact:true}).click();
    if(await select.evaluate(element=>element.value)!=='jp')throw Error('Saved dormant progression did not reopen');
    if(await page.getByRole('switch',{name:'蔚蓝档案',exact:true}).getAttribute('aria-checked')!=='false')throw Error('Game was implicitly enabled');
    await page.keyboard.press('Escape');await page.locator('nexus-modal').waitFor({state:'detached'});
  });
}
