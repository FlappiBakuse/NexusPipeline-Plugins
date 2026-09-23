"""Execute pinned DailyRoutineTask branches with inert children and an in-memory daily store."""
import __future__
import argparse
import ast
from contextlib import contextmanager
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

SHA = '555f8e49c91bd9739a177eb84807e044274f076d24782a005a534a4c5a4ed6b8'
ANOMALY_SHA = 'bba33d7475cad3faaf97c2d17a257e2b3fc6d8ee96ba48f57921648c9ac6f7d9'


def load_anomaly(source):
    data = source.read_bytes()
    assert hashlib.sha256(data).hexdigest() == ANOMALY_SHA, 'Anomaly source identity mismatch'
    tree = ast.parse(data)
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'AnomalyTask')
    methods = {'get_sub_idx', 'resolve_sub_id', 'set_task_type_and_id', 'get_next_sub_id',
               'shift_id', 'shift_sub_task_id', 'shift_custom_cycle', 'get_cycle_option'}
    # Keep the original bounded constant initialization and pure progress methods; no game imports or actions.
    cls.bases = []; cls.decorator_list = []
    cls.body = [n for n in cls.body if not isinstance(n, ast.FunctionDef) or n.name in methods]
    namespace = {}
    exec(compile(ast.Module(body=[cls], type_ignores=[]), str(source), 'exec',
                 flags=__future__.annotations.compiler_flag), namespace)
    return namespace['AnomalyTask']


def run(source, anomaly_source=None):
    data=source.read_bytes()
    assert hashlib.sha256(data).hexdigest()==SHA, 'Source identity mismatch'
    tree=ast.parse(data)
    cls=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='DailyRoutineTask')
    wanted=['do_run','_execute_routine_item','_reset_task_status','_print_result','_task_display_name','_active_task_context']
    nodes=[n for n in cls.body if isinstance(n,ast.FunctionDef) and n.name in wanted]
    nodes += [n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='_DailyTaskConfig']
    nodes += [n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='routine_has_active_tasks']
    class TaskDisabledException(Exception): pass
    namespace=dict(deepcopy=deepcopy,contextmanager=contextmanager,TaskDisabledException=TaskDisabledException)
    exec(compile(ast.Module(body=nodes,type_ignores=[]),str(source),'exec',flags=__future__.annotations.compiler_flag),namespace)
    cases=[]
    anomaly = load_anomaly(anomaly_source) if anomaly_source else None
    for case in ['success','false','none','child-exception','disabled','entry-exception','language-skip','already-queued']:
        events=[]
        selected=[dict(id='daily_anomaly',enabled=True),dict(id='daily_claim',enabled=True)]
        daily_store={'daily_anomaly':{'progress':2},'daily_claim':{'progress':4}}
        if anomaly:
            daily_store['daily_anomaly'].update({anomaly.CONF_TASK_TYPE: anomaly.TASK_ABILITY,
                anomaly.CONF_ABILITY_ID: 5, anomaly.CONF_CYCLEB_TASK_MODE: anomaly.CYCLE_SUB_TASK})
        instance=SimpleNamespace(scene=SimpleNamespace(set_logged_in=lambda value:None),current_task_key=None,
            _active_routine_task=None,sleep_check_interval=0.5,routine_task_configs=daily_store,
            normalize_items=lambda:deepcopy(selected),info_set=lambda *args:None,
            screenshot=lambda value:events.append(('screenshot',value)),
            log_info=lambda text,**kw:events.append(('INFO',text)),
            log_warning=lambda text,**kw:events.append(('WARNING',text)),
            log_error=lambda text,*args:events.append(('ERROR',text)))
        child=SimpleNamespace(name='异象界域',config={'progress':99},sleep_check_interval=0.2,
            enabled=case=='already-queued',running=False)
        other=SimpleNamespace(name='日常领取',config={'progress':77},sleep_check_interval=0.3,
            enabled=False,running=False,do_run=lambda:True)
        child_config=child.config
        def child_run():
            assert child.config['progress']==2, 'Standalone settings leaked into daily context'
            if case=='child-exception':raise RuntimeError('controlled child error')
            if case=='disabled':raise TaskDisabledException()
            return False if case=='false' else None if case=='none' else True
        child.do_run=child_run
        def shift(task): task.config['progress']+=1
        child.shift_id=shift
        if anomaly:
            original = child
            child = anomaly()
            child.__dict__.update(original.__dict__)
            del child.shift_id
            child.sync_config = lambda *args: None  # Persistence is exercised by the original _DailyTaskConfig below.
            child.log_warning = lambda text: events.append(('WARNING', text))
            child.log_info = lambda text: events.append(('INFO', text))
        instance.task_for_id=lambda key: (None if case=='language-skip' else child) if key=='daily_anomaly' else other
        instance.entries_by_id=lambda:dict(daily_anomaly=SimpleNamespace(daily_config=True),daily_claim=SimpleNamespace(daily_config=False))
        def ensure():
            if case=='entry-exception':raise RuntimeError('controlled ensure_main error')
        instance.ensure_main=ensure
        instance.daily_task_config=lambda key,task:namespace['_DailyTaskConfig'](instance,key,task,
            deepcopy(daily_store[key]) if anomaly else {'progress':0})
        for name in wanted:
            func=namespace[name]
            setattr(instance,name,lambda *args,f=func,**kwargs:f(instance,*args,**kwargs))
        raised=None
        try:result=instance.do_run()
        except Exception as ex:result=None;raised=type(ex).__name__
        assert child.config is child_config and child.config['progress']==99
        assert other.config=={'progress':77} and instance._active_routine_task is None and instance.sleep_check_interval==0.5
        assert daily_store['daily_anomaly']['progress']==(3 if case=='success' and not anomaly else 2)
        if anomaly:
            assert daily_store['daily_anomaly'][anomaly.CONF_ABILITY_ID] == (1 if case == 'success' else 5)
        if case in ['false','none','child-exception']:
            assert result is False and instance.task_status['failed']==['daily_anomaly']
            assert ('INFO','结束执行日常任务') in events and ('INFO','任务完成: 日常领取') in events
        if case=='disabled':assert raised=='TaskDisabledException' and not any('任务失败:' in text for _,text in events)
        if case=='entry-exception':assert raised=='RuntimeError' and ('INFO','开始任务: 异象界域') in events
        if case=='language-skip':assert result is True and instance.task_status['skipped']==['daily_anomaly']
        if case=='success':assert result is True and instance.task_status['success']==['daily_anomaly','daily_claim']
        if case=='already-queued':assert result is False
        cases.append(dict(name=case,result=result,exception=raised,dailyStore=daily_store,events=events,
                          standaloneSettingsPreserved=True))
    return dict(sourceSha256=SHA, anomalySha256=ANOMALY_SHA if anomaly else None, passed=len(cases),skipped=0,cases=cases,
        basis=('Original routine, _DailyTaskConfig and AnomalyTask shift methods with wraparound; inert game outcome and sync notification'
               if anomaly else 'Original routine methods and _DailyTaskConfig; inert child outcomes and synthetic progress callback, no game or real shift algorithm'))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    parser.add_argument('--anomaly-source',type=Path)
    args=parser.parse_args()
    report=run(args.source,args.anomaly_source)
    with args.output.open('x',encoding='utf-8') as stream:json.dump(report,stream,ensure_ascii=False,indent=2)
    print('oknte original routine branches: 8 passed, 0 skipped')
