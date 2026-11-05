import { choose, confirm } from './controls.mjs';

async function mountMaa(page) {
  await page.evaluate(async () => {
    const profile = { profileId: 'profile', revision: '1', packageRoot: 'D:/fixture', interfacePath: 'interface.json',
      nativeDirectory: '', language: 'zh_cn', controller: 'win', resource: 'main', taskOccurrences: [],
      options: { credentials: { user: 'old-user', server: 'old-server' } }, resourceOptions: {}, controllerOptions: {},
      sourceSnapshot: { compilation: { compilationFingerprint: 'a'.repeat(64) } },
      windowSelection: 'exact_process', windowHandle: 0, windowProcessId: 0, windowExecutable: '',
      windowWaitMilliseconds: 10000, adbPath: '', adbSerial: '' };
    const schema = { projectName: 'Race Maa', projectVersion: '1', controllers: [{name:'win',label:'Win32',type:'Win32'}],
      resources: [{name:'main',label:'Main'}], tasks: [], presets: [], globalOptions: ['credentials'],
      options: { credentials: {label:'Credentials',type:'input',inputs:[
        {name:'user',label:'User'},{name:'server',label:'Server'},{name:'secret',label:'Secret',password:true},
      ]} } };
    window.importRequests = []; window.secretRequests = []; window.publishedProfile = undefined;
    window.maaHashOriginal ??= crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = window.maaHashOriginal;
    window.maaBaseProfile = profile;
    await window.testMount('maa-framework', {
      readEditor: async () => ({providerId:'maa-framework',mode:'binding',profile}),
      discover: async () => ({interfaceCandidates:['interface.json'],candidates:[],schema}),
      inspect: async () => ({ schema }), preview: async () => ({}), applyPreset: async value => value,
      findWindows: async () => [], saveBinding: async () => {},
      previewImport: (kind,path,instance) => new Promise(resolve => window.importRequests.push({kind,path,instance,resolve})),
      publishDraft: (_context,next) => {window.publishedProfile = next;},
    }, 'automation.binding.editor');
  });
  await page.getByText('读取项目',{exact:true}).click();
  await page.getByRole('textbox',{name:'Credentials / user',exact:true}).waitFor();
}

async function mountCheckin(page, delayed = false, withTasks = false) {
  await page.evaluate(async ({delayed,withTasks}) => {
    window.sessionRequests=[]; window.closedSessions=[]; window.canceledLogins=[]; window.loginRequests=[]; window.savedSecrets=undefined;
    const state = {revision:1,timeZoneId:'UTC',notificationTasks:[],tasks:[],
      platforms:[{id:'tajiduo',name:'塔吉多',games:[],browserLogin:{ready:true,status:'ready'}}]};
    if(withTasks)state.tasks=['one','two'].map(id=>({id,name:id,remark:'',enabled:true,games:{},schedules:[],
      notification:{enabled:false,notificationTaskIds:[]},isRunning:false,nextRunAt:null,
      recentRun:{status:'completed',startedAt:'2026-10-24T00:00:00Z',results:[],diagnostics:[{code:'fixture'}]}}));
    window.checkinState=state;
    if(withTasks){
      const original=window.setTimeout;
      window.restoreCheckinTimeout=()=>{window.setTimeout=original;delete window.restoreCheckinTimeout;};
      window.setTimeout=(callback,delay,...args)=>{
        const handle=original(callback,delay,...args);
        if(delay===5000)window.triggerCheckinPoll=()=>{clearTimeout(handle);callback(...args);};
        return handle;
      };
    }
    const ports = {
      readState:async()=>window.checkinState,
      openEditor:()=>delayed?new Promise(resolve=>window.sessionRequests.push(resolve)):Promise.resolve({editorSessionId:'editor-a',fields:{}}),
      closeEditor:async id=>{window.closedSessions.push(id);},leaseEditor:async()=>{},
      readEditor:async()=>({editorSessionId:'editor-a',fields:{}}),
      prepareTajiduo:async()=>({operationId:'login-a'}),sendTajiduoCode:async()=>{},
      loginTajiduo:()=>new Promise(resolve=>window.loginRequests.push(resolve)),
      cancelTajiduo:async id=>{window.canceledLogins.push(id);},cancelBrowserLogin:async()=>{},
      saveTask:async (_operationId,_draft,_session,secrets)=>{window.savedSecrets=structuredClone(secrets);return {...state,revision:2};},
    };
    window.loginPorts=ports;
    await window.testMount('game-checkin',ports,'route');
  },{delayed,withTasks});
  await page.getByText('添加签到任务',{exact:true}).waitFor();
}

export async function runRaceCases({page,test}) {
  await test('checkin login mode clears secrets and preserves legacy field and footer order',async()=>{
    await mountCheckin(page);await page.getByText('添加签到任务',{exact:true}).click();
    await page.getByText('塔吉多登录',{exact:true}).click();
    const login=page.locator('nexus-modal.checkin-login-modal');
    await login.getByRole('textbox',{name:'手机号',exact:true}).fill('12345678901');
    await login.getByRole('textbox',{name:'短信验证码',exact:true}).fill('fixture-private-code');
    await choose(login.locator('nexus-select'),'password');
    if(await login.getByRole('textbox',{name:'密码',exact:true}).inputValue()!=='')throw Error('Mode change kept a secret');
    if(await login.getByText('发送验证码',{exact:true}).isVisible())throw Error('Password mode kept the SMS action');
    await login.getByRole('textbox',{name:'密码',exact:true}).fill('fixture-private-password');
    await choose(login.locator('nexus-select'),'sms');
    if(await login.getByRole('textbox',{name:'短信验证码',exact:true}).inputValue()!=='')throw Error('SMS mode kept the password');
    const footer=await login.locator('[slot=footer] nexus-button').allTextContents();
    if(JSON.stringify(footer)!==JSON.stringify(['取消','登录']))throw Error('Login footer order changed');
    await login.getByText('取消',{exact:true}).click();
  });
  await test('checkin SMS pending locks fields, refuses duplicate sends and retains retryable errors',async()=>{
    await mountCheckin(page);await page.getByText('添加签到任务',{exact:true}).click();
    await page.evaluate(()=>{
      window.smsCalls=0;window.loginPorts.sendTajiduoCode=()=>{window.smsCalls++;return new Promise((resolve,reject)=>{window.smsResolve=resolve;window.smsReject=reject;});};
    });
    await page.getByText('塔吉多登录',{exact:true}).click();
    const login=page.locator('nexus-modal.checkin-login-modal');
    await login.getByRole('textbox',{name:'手机号',exact:true}).fill('12345678901');
    await login.getByText('发送验证码',{exact:true}).click();
    await page.waitForFunction(()=>window.smsCalls===1);
    if(!await login.getByRole('textbox',{name:'手机号',exact:true}).isDisabled()
      ||!await login.locator('nexus-select').evaluate(element=>element.inert))throw Error('Pending SMS kept editable fields');
    await login.locator('nexus-button').filter({hasText:'发送验证码'}).evaluate(element=>element.click());
    if(await page.evaluate(()=>window.smsCalls)!==1)throw Error('SMS send repeated during a pending request');
    await page.evaluate(()=>window.smsReject(new Error('fixture_network_error')));
    await login.getByRole('alert').filter({hasText:'登录未完成'}).waitFor();
    if(await login.getByRole('textbox',{name:'手机号',exact:true}).inputValue()!=='12345678901')throw Error('Retry lost the phone draft');
    await login.getByText('发送验证码',{exact:true}).click();await page.waitForFunction(()=>window.smsCalls===2);
    await page.evaluate(()=>window.smsResolve());
    await login.getByRole('status').filter({hasText:'验证码已发送'}).waitFor();
    await login.getByText('发送验证码',{exact:true}).click();
    await login.getByRole('alert').filter({hasText:'60 秒内'}).waitFor();
    if(await page.evaluate(()=>window.smsCalls)!==2)throw Error('SMS throttle sent an extra request');
    await login.getByText('取消',{exact:true}).click();
  });
  await test('maa import preview freezes selection and rejects stale confirmation',async()=>{
    await mountMaa(page);
    const source=page.getByRole('textbox',{name:'导入源相对路径（只读）',exact:true});
    await source.fill('a.json');await page.getByText('预览显式导入',{exact:true}).click();
    await page.waitForFunction(()=>window.importRequests.length===1);
    await source.fill('b.json');await page.getByText('预览显式导入',{exact:true}).click();
    await page.waitForFunction(()=>window.importRequests.length===2);
    await page.evaluate(()=>{
      const profile={...window.maaBaseProfile,profileId:'mapped-a'};
      window.importRequests[0].resolve({profile,details:{source:'a'}});
    });
    await page.getByText('使用已预览映射',{exact:true}).click();
    await page.locator('.plugin-status').filter({hasText:'请先预览当前导入选择'}).waitFor();
    if(await page.locator('nexus-confirm-dialog').count())throw Error('Old A mapping was offered for B');
    await page.evaluate(()=>window.importRequests[1].resolve({profile:{...window.maaBaseProfile,profileId:'mapped-b'},details:{source:'b'}}));
    await page.waitForFunction(()=>document.querySelector('.maa-output')?.textContent.includes('"b"'));
    await source.fill('c.json');await page.getByText('预览显式导入',{exact:true}).click();
    await source.fill('d.json');await page.getByText('预览显式导入',{exact:true}).click();
    await page.waitForFunction(()=>window.importRequests.length===4);
    await page.evaluate(()=>window.importRequests[3].resolve({profile:{...window.maaBaseProfile,profileId:'mapped-d'},details:{source:'d'}}));
    await page.waitForFunction(()=>document.querySelector('.maa-output')?.textContent.includes('"d"'));
    await page.evaluate(async()=>{window.importRequests[2].resolve({profile:{...window.maaBaseProfile,profileId:'mapped-c'},details:{source:'c'}});await new Promise(resolve=>setTimeout(resolve,0));});
    if(!await page.evaluate(()=>document.querySelector('.maa-output').textContent.includes('"d"')))throw Error('Older response replaced the latest mapping');
    await page.getByText('使用已预览映射',{exact:true}).click();
    await page.evaluate(()=>{
      const source=document.querySelector('nexus-text-input[aria-label="导入源相对路径（只读）"]');
      source.value='e.json';
      source.dispatchEvent(new CustomEvent('nexus-change',{bubbles:true,composed:true,detail:{value:'e.json',source:'input'}}));
    });
    await confirm(page);
    await page.locator('.plugin-status').filter({hasText:'请先预览当前导入选择'}).waitFor();
    if(await page.evaluate(()=>window.publishedProfile!==undefined))throw Error('Changed selection accepted during confirmation');
  });
  await test('maa grouped fields merge current values and reject late secrets',async()=>{
    await mountMaa(page);
    await page.getByRole('textbox',{name:'Credentials / user',exact:true}).fill('new-user');
    await page.getByRole('textbox',{name:'Credentials / server',exact:true}).fill('new-server');
    const values=await page.evaluate(()=>window.publishedProfile.options.credentials);
    if(values.user!=='new-user'||values.server!=='new-server')throw Error('Sibling field reverted');
    await page.locator('nexus-text-input[aria-label="Credentials / secret"]').locator('input').fill('fixture-secret');
    await page.evaluate(() => {
      crypto.subtle.digest = (...args) => new Promise(resolve => window.secretRequests.push(() => window.maaHashOriginal(...args).then(resolve)));
    });
    await page.getByText('使用新密钥草稿',{exact:true}).click();
    await page.waitForFunction(()=>window.secretRequests.length===1);
    await page.locator('nexus-text-input[aria-label="Credentials / secret"]').locator('input').fill('changed-secret');
    await page.locator('nexus-text-input[aria-label="Credentials / secret"]').locator('input').fill('fixture-secret');
    await page.evaluate(async()=>{await window.secretRequests[0]();await new Promise(resolve=>setTimeout(resolve,0));});
    if(await page.evaluate(()=>window.publishedProfile.options.credentials.secret))throw Error('An earlier secret generation was published');
    await page.getByText('使用新密钥草稿',{exact:true}).click();
    await page.waitForFunction(()=>window.secretRequests.length===2);
    await page.evaluate(()=>window.fixture.dispose());
    await page.evaluate(async()=>{await window.secretRequests[1]();crypto.subtle.digest=window.maaHashOriginal;await new Promise(resolve=>setTimeout(resolve,0));});
    if(await page.evaluate(()=>window.publishedProfile.options.credentials.secret))throw Error('Disposed Maa owner published late secret');
  });
  await test('checkin canceled login discards delayed candidate',async()=>{
    await mountCheckin(page);await page.getByText('添加签到任务',{exact:true}).click();
    await page.getByRole('textbox',{name:'任务名称',exact:true}).fill('Fixture task');
    await page.getByRole('switch',{name:'启用此任务',exact:true}).click();
    await page.getByText('塔吉多登录',{exact:true}).click();
    const login=page.locator('nexus-modal.checkin-login-modal');
    await login.getByRole('textbox',{name:'手机号',exact:true}).fill('12345678901');
    await login.getByRole('textbox',{name:'短信验证码',exact:true}).fill('123456');
    await login.getByText('登录',{exact:true}).click();
    await page.waitForFunction(()=>window.loginRequests.length===1);
    await login.getByText('取消',{exact:true}).click();
    await page.evaluate(async()=>{
      window.loginRequests[0]({candidateId:'late-candidate',platformId:'tajiduo'});
      await new Promise(resolve=>setTimeout(resolve,0));
    });
    await page.locator('.checkin-editor').getByText('保存',{exact:true}).click();
    await page.waitForFunction(()=>window.savedSecrets!==undefined);
    if(await page.evaluate(()=>Object.values(window.savedSecrets).some(value=>value.candidateId==='late-candidate')))
      throw Error('Canceled login candidate reached save');
    if(!await page.evaluate(()=>window.canceledLogins.includes('login-a')))throw Error('Canceled login was not released');
  });
  await test('checkin replaces pending editor and closes late sessions',async()=>{
    await mountCheckin(page,true);
    await page.getByText('添加签到任务',{exact:true}).click();await page.getByText('添加签到任务',{exact:true}).click();
    await page.waitForFunction(()=>window.sessionRequests.length===2);
    await page.evaluate(()=>window.sessionRequests[1]({editorSessionId:'editor-b',fields:{}}));
    await page.locator('.checkin-editor').waitFor();
    await page.evaluate(()=>window.sessionRequests[0]({editorSessionId:'editor-a',fields:{}}));
    await page.waitForFunction(()=>window.closedSessions.includes('editor-a'));
    if(await page.locator('.checkin-editor').count()!==1)throw Error('Multiple editors survived replacement');
    await page.evaluate(()=>window.fixture.dispose());
    if(!await page.evaluate(()=>window.closedSessions.includes('editor-b')))throw Error('Current editor session was not closed');
  });
  await test('checkin parent close cancels login and clears its secret inputs',async()=>{
    await mountCheckin(page);await page.getByText('添加签到任务',{exact:true}).click();
    await page.getByText('塔吉多登录',{exact:true}).click();
    const login=page.locator('nexus-modal.checkin-login-modal');
    await login.getByRole('textbox',{name:'短信验证码',exact:true}).fill('fixture-login-secret');
    await page.evaluate(()=>{window.loginInput=document.querySelector('nexus-text-input[aria-label="短信验证码"]');});
    await login.getByText('登录',{exact:true}).click();await page.waitForFunction(()=>window.loginRequests.length===1);
    await page.evaluate(()=>window.fixture.cleanup());
    await page.evaluate(async()=>{window.loginRequests[0]({candidateId:'parent-late',platformId:'tajiduo'});await new Promise(resolve=>setTimeout(resolve,0));});
    if(await page.locator('.checkin-editor').count()||!await page.evaluate(()=>window.closedSessions.includes('editor-a')
      &&window.canceledLogins.includes('login-a')&&window.loginInput.value===''))throw Error('Parent close kept its login owner or secret');
  });
  await test('checkin polling and changed rows preserve identity focus and expansion',async()=>{
    await mountCheckin(page,false,true);
    await page.locator('li[data-item-id="one"]').waitFor();
    await page.evaluate(()=>{
      const row=document.querySelector('li[data-item-id="one"]');window.stableRow=row;
      row.querySelector('details').open=true;
      [...row.querySelectorAll('nexus-button')].find(button=>button.textContent==='编辑签到').focus();
      window.rowFocus=document.activeElement;
    });
    await page.waitForTimeout(5200);
    if(!await page.evaluate(()=>window.stableRow===document.querySelector('li[data-item-id="one"]')
      &&window.stableRow.querySelector('details').open&&document.activeElement===window.rowFocus))throw Error('Unchanged poll reset the row');
    await page.evaluate(()=>{
      window.checkinState={...window.checkinState,revision:2,tasks:window.checkinState.tasks.map(task=>task.id==='two'?{...task,name:'changed-two'}:task)};
      window.triggerCheckinPoll();
    });
    await page.getByText(/changed-two/).waitFor();
    if(!await page.evaluate(()=>window.stableRow.querySelector('details').open&&document.activeElement===window.rowFocus))throw Error('Another row update reset selection');
    await page.evaluate(()=>{
      window.stableRow.dispatchEvent(new Event('dragstart',{bubbles:true}));
      window.checkinState={...window.checkinState,revision:3,tasks:window.checkinState.tasks.map(task=>task.id==='one'?{...task,name:'changed-one'}:task)};
      window.triggerCheckinPoll();
    });
    await page.waitForTimeout(100);
    if(await page.getByText(/changed-one/).count())throw Error('Polling replaced an active drag row');
    await page.evaluate(()=>window.stableRow.dispatchEvent(new Event('dragend',{bubbles:true})));
    await page.getByText(/changed-one/).waitFor();
    if(!await page.evaluate(()=>window.stableRow===document.querySelector('li[data-item-id="one"]')&&window.stableRow.querySelector('details').open))throw Error('Changed row lost identity or expansion');
  });
}
