export async function runRefreshCases({page,test}) {
  await test('wallpaper unchanged 30-second poll reuses validated asset and display URL',async()=>{
    await page.evaluate(async()=>{
      window.wallpaperCounts={reads:0,states:0,validations:0,created:0,revoked:0};
      const bitmap=window.createImageBitmap,create=URL.createObjectURL,revoke=URL.revokeObjectURL;
      window.createImageBitmap=(...args)=>{window.wallpaperCounts.validations++;return bitmap(...args);};
      URL.createObjectURL=(...args)=>{window.wallpaperCounts.created++;return create(...args);};
      URL.revokeObjectURL=(...args)=>{window.wallpaperCounts.revoked++;return revoke(...args);};
      window.restoreWallpaper=()=>{window.createImageBitmap=bitmap;URL.createObjectURL=create;URL.revokeObjectURL=revoke;};
      window.wallpaperState={revision:1,enabled:true,effectiveEnabled:true,assets:[{id:'one',name:'One',sizeBytes:69}],order:['one'],
        currentId:'one',rotation:{mode:'off',intervalMinutes:30},
        effects:{blurPx:0,dimPercent:0,surfaceTransparencyPercent:0,secondaryTransparency:false}};
      await window.testMount('custom-wallpaper',{
        connectionKind:async()=>'remote',readState:async()=>{window.wallpaperCounts.states++;return window.wallpaperState;},
        readAsset:async()=>{window.wallpaperCounts.reads++;return window.fixturePng();},
        subscribe:listener=>{window.publishWallpaper=listener;return()=>{};},
      },'application.appearance');
    });
    try{
      await page.waitForFunction(()=>document.querySelector('.wallpaper-appearance-image')?.style.backgroundImage);
      await page.waitForTimeout(30100);
      const unchanged=await page.evaluate(()=>({...window.wallpaperCounts}));
      if(unchanged.states<2||unchanged.reads!==1||unchanged.validations!==1||unchanged.created!==1)
        throw Error('Unchanged asset repeated work: '+JSON.stringify(unchanged));
      await page.evaluate(()=>{
        window.wallpaperState={...window.wallpaperState,revision:2,effects:{...window.wallpaperState.effects,blurPx:8}};
        window.publishWallpaper(window.wallpaperState);
      });
      await page.waitForFunction(()=>document.querySelector('.wallpaper-appearance-image')?.style.filter==='blur(8px)');
      const effect=await page.evaluate(()=>({...window.wallpaperCounts}));
      if(effect.reads!==1||effect.validations!==1||effect.created!==1)throw Error('Effect change reloaded its asset');
      await page.evaluate(()=>{
        window.wallpaperState={...window.wallpaperState,revision:3,assets:[{id:'two',name:'Two',sizeBytes:69}],order:['two'],currentId:'two'};
        window.publishWallpaper(window.wallpaperState);
      });
      await page.waitForFunction(()=>window.wallpaperCounts.created===2);
      await page.evaluate(()=>window.fixture.dispose());
      const final=await page.evaluate(()=>({...window.wallpaperCounts}));
      if(final.reads!==2||final.validations!==2||final.created!==final.revoked)throw Error('Changed asset or URL owner mismatch: '+JSON.stringify(final));
    }finally{await page.evaluate(()=>{window.fixture?.dispose();window.restoreWallpaper();});}
  });
  await test('wallpaper polling and subscriptions follow appearance and settings visibility', async () => {
    for (const target of ['application.appearance', 'settings.panels']) {
      const result = await page.evaluate(async target => {
        const interval = window.setInterval, clear = window.clearInterval;
        const callbacks = new Map();
        window.setInterval = (callback, delay, ...args) => {
          if (delay !== 30000) return interval(callback, delay, ...args);
          const id = interval(() => {}, 3600000); callbacks.set(id, callback); return id;
        };
        window.clearInterval = id => { callbacks.delete(id); clear(id); };
        let reads = 0, subscriptions = 0;
        let state = { revision: 1, enabled: false, effectiveEnabled: false, assets: [], order: [],
          rotation: { mode: 'off', intervalMinutes: 30 },
          effects: { blurPx: 0, dimPercent: 0, surfaceTransparencyPercent: 0, secondaryTransparency: false } };
        const settle = () => new Promise(resolve => setTimeout(resolve, 30));
        try {
          await window.testMount('custom-wallpaper', {
            connectionKind: async () => 'remote', readState: async () => { reads++; return state; },
            subscribe: () => { subscriptions++; return () => { subscriptions--; }; }
          }, target);
          await settle();
          const active = callbacks.size === 1 && subscriptions === 1;
          window.fixture.hide(); await settle();
          const hiddenReads = reads;
          for (const callback of callbacks.values()) callback();
          await settle();
          const hidden = reads === hiddenReads && callbacks.size === 0 && subscriptions === 0;
          state = { ...state, revision: 2 };
          window.fixture.show(); await settle();
          const restored = reads > hiddenReads && callbacks.size === 1 && subscriptions === 1;
          window.fixture.dispose();
          return { active, hidden, restored, released: callbacks.size === 0 && subscriptions === 0 };
        } finally {
          window.fixture?.dispose(); window.setInterval = interval; window.clearInterval = clear;
        }
      }, target);
      if (Object.values(result).some(value => !value)) throw Error(target + ': ' + JSON.stringify(result));
    }
  });
  await test('wallpaper settings reuse thumbnails across no-change and effect updates',async()=>{
    await page.evaluate(async()=>{
      window.thumbnailReads=0;window.wallpaperSaved=undefined;
      let state={revision:1,enabled:true,effectiveEnabled:true,assets:[{id:'one',name:'One',sizeBytes:69}],order:['one'],selectedId:'one',
        currentId:'one',rotation:{mode:'off',intervalMinutes:30},
        effects:{blurPx:0,dimPercent:0,surfaceTransparencyPercent:0,secondaryTransparency:false}};
      await window.testMount('custom-wallpaper',{
        connectionKind:async()=>'remote',readState:async()=>state,
        readAsset:async()=>{window.thumbnailReads++;return window.fixturePng();},subscribe:callback=>{window.publishWallpaperSettings=callback;return()=>{};},
        saveSettings:async patch=>{state={...state,...patch,revision:state.revision+1};window.wallpaperSaved=state;return state;},
      },'settings.panels');
    });
    await page.locator('.wallpaper-settings>summary').click();
    await page.locator('img[src]').waitFor();
    await page.evaluate(()=>{window.thumbnail=document.querySelector('img[src]');});
    await page.evaluate(()=>window.fixture.ports.readState().then(window.publishWallpaperSettings));
    await page.locator('nexus-range[aria-label="模糊（像素）"]').locator('input').press('ArrowRight');
    await page.waitForFunction(()=>window.wallpaperSaved?.effects.blurPx===1);
    if(!await page.evaluate(()=>window.thumbnailReads===1&&window.thumbnail===document.querySelector('img[src]')))
      throw Error('Unchanged thumbnail identity or bytes were replaced');
  });
}
