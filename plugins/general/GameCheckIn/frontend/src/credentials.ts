import {ref} from 'vue';
import type {CredentialEditor, CredentialFieldState, CredentialRead, PluginHost, SecretAction} from './types';

type Field = CredentialFieldState & {inputValue:string;visible:boolean;loading:boolean;localError:string;localRevision:number};
const code = (error:unknown) => {
  const response=error as {code?:unknown;data?:{code?:unknown;error?:unknown};message?:unknown}|null;
  for(const value of [response?.code,response?.data?.code,response?.data?.error,response?.message])
    if(typeof value==='string'&&/^[a-z][a-z0-9_]{0,63}$/.test(value))return value;
  return 'credential_request_failed';
};

export function createCredentialEditor(host:PluginHost) {
  const fields=ref<Record<string,Field>>({}),native=ref(false),ready=ref(false),busy=ref(0),error=ref(''),confirmation=ref<string|null>(null);
  const queues=new Map<string,Promise<void>>();
  let id='',generation=0,controller=new AbortController(),lease:ReturnType<typeof setInterval>|undefined;
  let revealExpiry:ReturnType<typeof setTimeout>|undefined;
  const project=(state:CredentialFieldState,old?:Field):Field=>({...state,inputValue:old?.inputValue||'',visible:old?.visible||false,loading:false,localError:old?.localError||'',localRevision:old?.localRevision||0});
  const current=(session:number)=>generation===session&&!controller.signal.aborted;
  async function refresh(session=generation) {
    const state=await host.api.post('credentials/editors/state',{editorSessionId:id},controller.signal) as CredentialEditor;
    if(current(session)) fields.value=Object.fromEntries(Object.entries(state.fields).map(([key,value])=>[key,project(value,fields.value[key])]));
  }
  function close() {
    generation++;controller.abort();controller=new AbortController();
    if(lease)clearInterval(lease);if(revealExpiry)clearTimeout(revealExpiry);
    const old=id;id='';ready.value=false;busy.value=0;fields.value={};confirmation.value=null;queues.clear();
    if(old)void host.api.delete('credentials/editors',{editorSessionId:old}).catch(()=>{});
  }
  async function open(taskId?:string) {
    close();const session=generation;error.value='';
    try {
      const client=await host.clientSessions.get();if(!current(session))return;
      native.value=client.nativeBrowserAvailable;
      const state=await host.api.post('credentials/editors',{taskId},controller.signal) as CredentialEditor;
      if(!current(session)){void host.api.delete('credentials/editors',{editorSessionId:state.editorSessionId}).catch(()=>{});return;}
      id=state.editorSessionId;fields.value=Object.fromEntries(Object.entries(state.fields).map(([key,value])=>[key,project(value)]));ready.value=true;
      // Manual fields retain their established editing behavior; browser fields are never prefetched.
      for(const [platform,field] of Object.entries(fields.value))if(field.configured&&field.source==='manual'&&!field.error)void read(platform,false);
      lease=setInterval(()=>{void host.api.post('credentials/lease',{editorSessionId:id},controller.signal).catch(e=>{if(current(session))error.value=code(e);});},60000);
    } catch(e) {if(current(session))error.value=code(e);}
  }
  async function read(platform:string,visible:boolean) {
    const session=generation,field=fields.value[platform];if(!field||!ready.value)return;
    await flush();if(!current(session)||fields.value[platform]!==field||field.localError)return;
    const fieldGeneration=field.fieldGeneration;field.loading=true;field.localError='';
    try {
      const value=await host.api.post('tasks/credential/read',{editorSessionId:id,platform,fieldGeneration},controller.signal) as CredentialRead;
      if(!current(session)||fields.value[platform]!==field||field.fieldGeneration!==fieldGeneration)return;
      if(value.platform!==platform||value.fieldGeneration!==fieldGeneration||typeof value.configured!=='boolean'
        ||(value.configured?typeof value.value!=='string':value.value!==null))throw new Error('credential_read_failed');
      field.inputValue=value.value||'';field.visible=visible;
      if(field.source==='browser'&&typeof value.revealRemainingSeconds==='number') {
        if(revealExpiry)clearTimeout(revealExpiry);
        revealExpiry=setTimeout(()=>{for(const field of Object.values(fields.value))if(field.source==='browser'){field.visible=false;field.inputValue='';}},Math.max(0,value.revealRemainingSeconds*1000));
      }
    }catch(e){if(current(session)&&fields.value[platform]===field){field.visible=false;if(code(e)==='reveal_confirmation_required')confirmation.value=platform;else field.localError=code(e);}}
    finally {if(current(session)&&fields.value[platform]===field)field.loading=false;}
  }
  function mutate(platform:string,value:string,clear=false) {
    const field=fields.value[platform];if(!field||!ready.value)return;
    if(!value)clear=true;
    if(!clear)field.inputValue=value;
    const revision=++field.localRevision;
    const session=generation,editor=id;busy.value++;
    const work=(queues.get(platform)||Promise.resolve()).then(async()=>{
      if(!current(session))return;
      if(field.localError)throw new Error('credential_draft_unconfirmed');
      const state=await host.api.put('credentials/draft',{editorSessionId:editor,platform,expectedFieldGeneration:field.fieldGeneration,
        mutation:clear?'clear':field.source==='browser'?'edit-current':'set-manual',...(clear?{}:{value})},controller.signal) as CredentialFieldState;
      if(!current(session)||fields.value[platform]!==field)return;
      Object.assign(field,state);
      if(clear&&field.localRevision===revision){field.inputValue='';field.visible=false;}
    }).catch(async e=>{
      if(current(session)){field.localError=code(e);error.value=code(e);}
    }).finally(()=>{if(current(session))busy.value--;});
    queues.set(platform,work);
  }
  async function clear(platform:string) {
    const field=fields.value[platform];if(!field)return;
    // A failed mutation keeps its local value until an explicit clear reconciles with the server.
    if(field.localError){await flush();await refresh();const latest=fields.value[platform];if(latest)latest.localError='';}
    mutate(platform,'',true);
  }
  async function retry(platform:string){const field=fields.value[platform];if(field){field.localError='';await read(platform,field.visible);}}
  async function flush(){await Promise.all([...queues.values()]);}
  async function visibility(platform:string) {
    const field=fields.value[platform];if(!field||!ready.value)return;
    if(field.visible){
      await flush();if(field.localError)return;
      field.visible=false;if(field.source==='browser')field.inputValue='';
    } else if(field.source==='browser')await read(platform,true);
    else field.visible=true;
  }
  async function confirm() {
    const platform=confirmation.value,session=generation;if(!platform)return;
    confirmation.value=null;
    try {
      const grant=await host.api.post('tasks/credential/reveal/confirm',{confirm:true},controller.signal) as {expiresAt:string};
      if(!current(session))return;
      if(revealExpiry)clearTimeout(revealExpiry);
      revealExpiry=setTimeout(()=>{for(const field of Object.values(fields.value))if(field.source==='browser'){field.visible=false;field.inputValue='';}},Math.max(0,Date.parse(grant.expiresAt)-Date.now()));
      await read(platform,true);
    }catch(e){if(current(session))error.value=code(e);}
  }
  async function login(platform:string) {
    const session=generation,field=fields.value[platform];if(!field||!native.value)return;
    await flush();if(field.localError||!current(session))return;
    field.loading=true;
    try {
      const preparation=await host.api.post('credentials/login/prepare',{editorSessionId:id,platform,expectedFieldGeneration:field.fieldGeneration},controller.signal) as {flowId:string;editorSessionId:string;fieldGeneration:number;context:Record<string,unknown>};
      if(!current(session))return;
      field.fieldGeneration=preparation.fieldGeneration;
      const operation=await host.browserLogin.open(preparation,controller.signal);
      const result=await operation.completed;if(!current(session))return;
      if(!result.success)error.value=result.error||'browser_validation_failed';
      await refresh(session);
      if(result.success){const latest=fields.value[platform];latest.visible=false;latest.inputValue='';}
    }catch(e){if(current(session))error.value=code(e);}
    finally {if(current(session)){field.loading=false;const latest=fields.value[platform];if(latest)latest.loading=false;}}
  }
  async function payload():Promise<{editorSessionId:string;secrets:Record<string,SecretAction>}|null> {
    await flush();if(!ready.value||Object.values(fields.value).some(f=>f.localError||f.error||f.loading))return null;
    return {editorSessionId:id,secrets:Object.fromEntries(Object.entries(fields.value).map(([platform,field])=>[platform,{
      action:field.intent,fieldGeneration:field.fieldGeneration,
      ...(field.intent==='set'?(field.candidateId?{candidateId:field.candidateId}:{value:field.inputValue}):{}),
    }]))};
  }
  return {fields,native,ready,busy,error,confirmation,open,close,read,retry,mutate,clear,visibility,confirm,login,payload};
}
