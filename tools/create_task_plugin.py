"""Create a backend task plugin scaffold, or a complete synthetic protocol example."""
import argparse
import json
import re
from pathlib import Path
from generate_task_protocol import bundle, PHASE_FILES

ROOT=Path(__file__).resolve().parents[1]
MARKER='__NXP_ADAPTATION_REQUIRED__'
PRESETS=('json-id-array','json-map','json-parallel-array','yaml','mxu','ok-script-daily')
def generate(artifact, name, example=False, preset="json-id-array", protocol_version="0.1.0"):
    if preset not in PRESETS: raise ValueError("Unknown structure preset")
    if protocol_version not in ('0.1.0', '0.1.1'): raise ValueError('Unsupported protocol version')
    if preset == 'ok-script-daily' and example:
        raise ValueError('ok-script-daily is a blocked scaffold; qualify the upstream daily entry before creating a runnable adapter')
    if not re.fullmatch(r'[A-Z][A-Za-z0-9]{1,63}',artifact) or not re.fullmatch(r'[a-z][a-z0-9-]{1,63}',name):
        raise ValueError('Expected PascalCase artifact and lowercase machine name')
    # 0.1.1 changes only the signed package declaration; phase messages retain wire 0.1.0.
    metadata={'id':name,'preset':preset,'protocolVersion':'0.1.0'}
    metadata.update(taskTextKeys={'daily-reward':'task.daily_reward'}, reasonTexts={
        'example.task.start':'示例任务已开始','example.task.ok':'示例任务已完成','example.task.fail':'示例任务报告失败'})
    metadata['configRules'] = [{'id':'example.configuration','required':True,'criticality':'advisory_or_contextual'}]
    scripts={'data/'+filename:bundle(metadata,phase,scaffold=not example)
             for phase,filename in PHASE_FILES.items()}
    files={
      'plugin.json':{'schemaVersion':2,'name':name,'artifactName':artifact,'displayName':artifact,'gameName':'Synthetic fixture',
        'description':'Synthetic task protocol example' if example else 'Task adapter scaffold; source review required',
        'version':'0.1.0','kind':'data-specialized','minHostVersion':'0.16.9' if protocol_version == '0.1.1' else '0.16.8','resolve':'data/resolve.json','judgeScript':'data/judge.js',
        'taskProtocol':{'version':protocol_version,'discoverScript':'data/discover.js','retryScript':'data/retry.js','readResources':[]}},
      'data/resolve.json':{'inputs':[],'require':[{'var':'main','file':'TaskFixture.exe'}],
        'paths':{'mainExe':'{main}','args':'','configPath':'config.yaml' if preset=='yaml' else 'config.json','logPath':''}},
      **scripts,
      'README.md':'# '+artifact+'\n\nStructure preset: '+preset+'\n\n'+('Synthetic protocol fixture; config.tasks entries are {id,name,enabled}. Logs use TASK <id> START|OK|FAIL. Run via the Host task protocol integration tool.\n' if example else
        'Replace the adaptation marker after reviewing upstream task selection, current-log evidence, risk and retry units. Add positive and negative fixtures before packaging.\n')}
    text_root = 'data/i18n/'
    files['plugin.json']['taskProtocol']['localization']={'defaultLocale':'zh-CN','messages':{
        'zh-CN':text_root+'zh-CN.json','en-US':text_root+'en-US.json'}}
    files[text_root+'zh-CN.json']={'task.daily_reward':'每日奖励',
        **{'reason.'+key:value for key,value in metadata['reasonTexts'].items()}}
    files[text_root+'en-US.json']={'task.daily_reward':'Daily rewards','reason.example.task.start':'Example task started',
        'reason.example.task.ok':'Example task completed','reason.example.task.fail':'Example task reported failure'}
    files['README.md'] += f'\nProtocol {protocol_version} freezes plugin-owned task/reason dictionaries. User names remain literal. The synthetic daily-reward entry uses its plugin key only with builtin=true; customName always overrides it.\n'
    files['plugin.json']['taskProtocol']['configRules'] = metadata['configRules']
    files['plugin.json']['taskProtocol']['environmentChecks'] = []
    if protocol_version == '0.1.1': files['plugin.json']['taskProtocol']['repairRules'] = []
    if preset == 'ok-script-daily':
        files['README.md'] += '\nReview the installed distribution, pinned framework, registered daily class/index, enable_after_start queue, file-log channel and per-user config stores. Keep standalone and multi-account tasks outside this adapter. Shared log parsing does not supply game-specific success rules. The adaptation marker must remain until these rules and positive/negative Host fixtures are implemented.\n'
    return {path:json.dumps(value,ensure_ascii=False,indent=2)+'\n' if isinstance(value,dict) else value for path,value in files.items()}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--artifact',required=True);p.add_argument('--name',required=True)
    p.add_argument('--preset',choices=PRESETS,default='json-id-array');p.add_argument('--protocol-version',choices=('0.1.0','0.1.1'),default='0.1.0');p.add_argument('--output',type=Path,required=True);p.add_argument('--example',action='store_true');p.add_argument('--check',action='store_true');a=p.parse_args()
    files=generate(a.artifact,a.name,a.example,a.preset,a.protocol_version)
    if a.check:
        failures=[path for path,text in files.items() if not (a.output/path).is_file() or (a.output/path).read_text(encoding='utf-8')!=text]
        if failures:raise SystemExit('Generated example differs: '+', '.join(failures))
    else:
        if a.output.exists():raise SystemExit('Output already exists; refusing to overwrite author changes')
        a.output.mkdir(parents=True)
        for path,text in files.items():
            target=a.output/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text,encoding='utf-8',newline='\n')
    print('Checked task plugin' if a.check else 'Created task plugin')
if __name__=='__main__':main()
