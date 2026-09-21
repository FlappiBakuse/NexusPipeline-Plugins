"""Create a backend task plugin scaffold, or a complete synthetic protocol example."""
import argparse
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MARKER='__NXP_ADAPTATION_REQUIRED__'
PRESETS=('json-id-array','json-map','json-parallel-array','yaml','mxu')
def generate(artifact, name, example=False, preset="json-id-array"):
    if preset not in PRESETS: raise ValueError("Unknown structure preset")
    if not re.fullmatch(r'[A-Z][A-Za-z0-9]{1,63}',artifact) or not re.fullmatch(r'[a-z][a-z0-9-]{1,63}',name):
        raise ValueError('Expected PascalCase artifact and lowercase machine name')
    common=(ROOT/'tools/task-protocol/common.js').read_text(encoding='utf-8')
    adapter=(ROOT/'tools/task-protocol/example.js').read_text(encoding='utf-8') if example else (
        '// '+MARKER+'\nfunction discover(){throw new Error("unsupported_schema")}\nfunction observe(){}\n')
    script='const ADAPTER = '+json.dumps({'id':name,'preset':preset})+';\n'+common+'\n'+adapter+'\nconsole.log(dispatch());\n'
    files={
      'plugin.json':{'schemaVersion':2,'name':name,'artifactName':artifact,'displayName':artifact,'gameName':'Synthetic fixture',
        'description':'Synthetic task protocol example' if example else 'Task adapter scaffold; source review required',
        'version':'0.1.0','kind':'data-specialized','minHostVersion':'0.16.8','resolve':'data/resolve.json','judgeScript':'data/judge.js',
        'taskProtocol':{'version':'1.0','discoverScript':'data/discover.js','retryScript':'data/retry.js','readResources':[]}},
      'data/resolve.json':{'inputs':[],'require':[{'var':'main','file':'TaskFixture.exe'}],
        'paths':{'mainExe':'{main}','args':'','configPath':'config.yaml' if preset=='yaml' else 'config.json','logPath':''}},
      'data/discover.js':script,'data/judge.js':script,'data/retry.js':script,
      'README.md':'# '+artifact+'\n\nStructure preset: '+preset+'\n\n'+('Synthetic protocol fixture; config.tasks entries are {id,name,enabled}. Logs use TASK <id> START|OK|FAIL. Run via the Host task protocol integration tool.\n' if example else
        'Replace the adaptation marker after reviewing upstream task selection, current-log evidence, risk and retry units. Add positive and negative fixtures before packaging.\n')}
    return {path:json.dumps(value,ensure_ascii=False,indent=2)+'\n' if isinstance(value,dict) else value for path,value in files.items()}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--artifact',required=True);p.add_argument('--name',required=True)
    p.add_argument('--preset',choices=PRESETS,default='json-id-array');p.add_argument('--output',type=Path,required=True);p.add_argument('--example',action='store_true');p.add_argument('--check',action='store_true');a=p.parse_args()
    files=generate(a.artifact,a.name,a.example,a.preset)
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
