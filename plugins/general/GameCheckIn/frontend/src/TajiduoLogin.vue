<script setup lang="ts">
import type {Directive} from 'vue';
import type {Translate} from './types';
const props=defineProps<{form:{phone:string;value:string;mode:string;busy:boolean;sent:boolean;error:string};translate:Translate}>();
const emit=defineEmits<{close:[];submit:[send:boolean]}>();
const t=(key:string,fallback:string)=>props.translate(key,{},fallback);
const listeners=new WeakMap<HTMLElement,EventListener>();
const vInput:Directive<HTMLElement,'phone'|'value'>={
  mounted(element,binding){
    const listener:EventListener=event=>{const detail=(event as CustomEvent).detail;props.form[binding.value]=String(Array.isArray(detail)?detail[0]:detail??'');};
    listeners.set(element,listener);element.addEventListener('update:modelValue',listener);
  },
  unmounted(element){const listener=listeners.get(element);if(listener)element.removeEventListener('update:modelValue',listener);listeners.delete(element);},
};
function mode(event:Event){const detail=(event as CustomEvent).detail;props.form.mode=String(Array.isArray(detail)?detail[0]:detail);props.form.value='';}
</script>

<template>
  <nxp-modal open locked footer :title="t('tajiduo.login_title','塔吉多登录')" :aria-label="t('tajiduo.login_title','塔吉多登录')" @close="emit('close')">
    <div class="gci-checkin-fields">
      <p>{{t('tajiduo.login_help','通过官方账号接口登录。密码和验证码仅用于本次认证，不会保存；登录后请保存签到任务使凭据生效。')}}</p>
      <nxp-field :label="t('tajiduo.login_method','登录方式')">
        <nxp-select id="gci-tajiduo-mode" :model-value="form.mode" :disabled="form.busy" :options="[{value:'sms',label:t('tajiduo.sms','短信验证码')},{value:'password',label:t('tajiduo.password','密码')}]" :aria-label="t('tajiduo.login_method','登录方式')" @change="mode" />
      </nxp-field>
      <nxp-field :label="t('tajiduo.phone','手机号')">
        <nxp-text-input id="gci-tajiduo-phone" v-input="'phone'" :model-value="form.phone" :disabled="form.busy" autocomplete="off" :aria-label="t('tajiduo.phone','手机号')" />
      </nxp-field>
      <nxp-field :label="form.mode==='sms'?t('tajiduo.sms','短信验证码'):t('tajiduo.password','密码')">
        <nxp-text-input id="gci-tajiduo-value" v-input="'value'" :model-value="form.value" type="password" :disabled="form.busy" autocomplete="new-password" :aria-label="form.mode==='sms'?t('tajiduo.sms','短信验证码'):t('tajiduo.password','密码')" />
      </nxp-field>
      <nxp-button v-if="form.mode==='sms'" :label="t('tajiduo.send_sms','发送验证码')" :disabled="form.busy" @click="emit('submit',true)" />
      <p v-if="form.sent" role="status">{{t('tajiduo.sms_sent','验证码已发送，请输入收到的验证码。60 秒内请勿重复发送。')}}</p>
      <p v-if="form.error" role="alert">{{translate(`error.${form.error}`,{},t('tajiduo.login_failed','登录未完成，请检查信息、网络或官方账号状态后重试。'))}}</p>
    </div>
    <div slot="footer" class="gci-modal-footer-actions">
      <nxp-button :label="t('action.cancel','取消')" @click="emit('close')" />
      <nxp-button tone="primary" :label="form.busy?t('tajiduo.signing_in','正在登录…'):t('tajiduo.sign_in','登录')" :disabled="form.busy" @click="emit('submit',false)" />
    </div>
  </nxp-modal>
</template>
