"""Execute locked upstream configuration migration with an in-memory YAML store; no game/import side effects."""
import __future__
import argparse
import ast
import copy
import hashlib
import json
import os
from pathlib import Path
from types import SimpleNamespace
from generate_task_protocol import load_adapters

ROOT=Path(__file__).resolve().parent/'task-protocol'
LOCK=json.loads((ROOT/'source-lock.json').read_text(encoding='utf-8'))['zzz']
ADAPTER=load_adapters()['ZenlessZoneZeroOneDragon']
PATHS=['src/one_dragon/base/config/one_dragon_app_config.py',
       'src/one_dragon/base/operation/application/application_group_config.py',
       'src/one_dragon/base/operation/application/application_group_manager.py']


def run(root):
    cases=[]
    for name,old,new in [('legacy',dict(app_order=['email'],app_run_list=['email']),None),
                         ('missing-order',dict(app_order=['email'],app_run_list=['email','coffee']),None),
                         ('empty-order',dict(app_run_list=['email']),None),
                         ('new-precedence',dict(app_order=['coffee'],app_run_list=['coffee']),
                          dict(app_list=[dict(app_id='email',enabled=False)]))]:
        store={'config/01/one_dragon_app.yml':copy.deepcopy(old)}
        if new is not None: store['config/01/one_dragon/_group.yml']=copy.deepcopy(new)
        class YamlOperator:
            def __init__(self,file_path):
                self.path=file_path.replace('\\','/')
                self.is_file_exists=self.path in store
                self.data=copy.deepcopy(store.get(self.path,{}))
            def get(self,key,default=None): return self.data.get(key,default)
            def update(self,key,value):
                self.data[key]=copy.deepcopy(value)
                store[self.path]=copy.deepcopy(self.data)
        class YamlConfig(YamlOperator):
            def __init__(self,module_name,instance_idx=None,sample=False):
                super().__init__(f'config/{instance_idx:02d}/{module_name}.yml')
        namespace=dict(YamlConfig=YamlConfig,YamlOperator=YamlOperator,os=os,
            os_utils=SimpleNamespace(get_path_under_work_dir=lambda *parts:os.path.join(*parts)),DEFAULT_GROUP_ID='one_dragon')
        for path in PATHS:
            data=(root/path).read_bytes()
            assert hashlib.sha256(data).hexdigest()==LOCK['files'][path],path
            classes=[node for node in ast.parse(data.decode('utf-8')).body if isinstance(node,ast.ClassDef)]
            exec(compile(ast.Module(body=classes,type_ignores=[]),path,'exec',flags=__future__.annotations.compiler_flag),namespace)
        ctx=SimpleNamespace(run_context=SimpleNamespace(is_app_registered=lambda key:key in ADAPTER['apps']))
        manager=namespace['ApplicationGroupManager'](ctx)
        manager.set_default_apps(ADAPTER['defaultAppIds'])
        result=manager._init_one_dragon_group_config(1)
        selected=[item.app_id for item in result.app_list if item.enabled]
        expected=[] if new is not None else old['app_run_list']
        assert selected==expected,(name,selected,expected)
        if old.get('app_order') and new is None: assert result.app_list[0].app_id=='email'
        assert store['config/01/one_dragon_app.yml']==old,'Old user configuration changed'
        cases.append(dict(name=name,selected=selected,apps=[dict(id=item.app_id,enabled=item.enabled) for item in result.app_list],
            originalConfigUnchanged=True,newGroupCreated=new is None and 'config/01/one_dragon/_group.yml' in store))
    return dict(upstreamCommit=LOCK['commit'],sourceHashes={p:LOCK['files'][p] for p in PATHS},
        basis='Executed original class AST with in-memory YAML and reviewed registration order',passed=len(cases),skipped=0,cases=cases)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args()
    report=run(args.source_root)
    with args.output.open('x',encoding='utf-8') as stream: json.dump(report,stream,ensure_ascii=False,indent=2)
    print('ZZZ source migration: 4 passed, 0 skipped')
