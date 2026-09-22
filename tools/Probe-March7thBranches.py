"""Execute hash-pinned upstream branches with in-memory automation dependencies, never a game.

No upstream imports or module initializers are executed. The original class/method AST is
compiled without rewriting its bodies. Run with an explicit read-only upstream source root.
"""
import argparse
import ast
import hashlib
import json
import re
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent
LOCK = json.loads((ROOT/'task-protocol/source-lock.json').read_text(encoding='utf-8'))['march7th']


def load_class(source_root, path, name, namespace):
    data = (source_root/path).read_bytes()
    if hashlib.sha256(data).hexdigest() != LOCK['files'][path]:
        raise ValueError('Unreviewed upstream source: '+path)
    tree = ast.parse(data.decode('utf-8'), filename=path)
    selected = [node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == name]
    if len(selected) != 1:
        raise ValueError('Missing unique upstream class: '+name)
    exec(compile(ast.Module(body=selected, type_ignores=[]), path, 'exec'), namespace)
    return namespace[name]


class Log:
    def __init__(self, actions): self.actions = actions
    def info(self, message): self.actions.append({'kind':'log','level':'INFO','message':message})
    def warning(self, message): self.actions.append({'kind':'log','level':'WARNING','message':message})
    def error(self, message): self.actions.append({'kind':'log','level':'ERROR','message':message})
    def hr(self, message, level=0): self.actions.append({'kind':'header','level':level,'message':message})


class Clock:
    def __init__(self): self.now = 0
    def sleep(self, seconds): self.now += seconds
    def monotonic(self): return self.now


class Automation:
    def __init__(self, branch, actions, screenshot_fails=False):
        self.branch, self.actions = branch, actions
        self.screenshot_fails = screenshot_fails
        self.lookups = 0
        self.matched_text = '追踪' if branch == 'locked' else '传送'
    def click_element(self, target, *args, **kwargs):
        if isinstance(target, tuple):
            self.lookups += 1
            return self.branch != 'not_found' and (self.branch != 'retry_recovered' or self.lookups > 10)
        return True
    def find_element(self, target, *args, **kwargs):
        if self.branch == 'start_failed': return target == '开始挑战'
        if self.branch == 'retry_recovered' and self.lookups > 10:
            return target in ('目标甲','./assets/images/zh_CN/fight/fight_again.png')
        return False
    def mouse_scroll(self, *args): pass
    def press_key(self, *args): pass
    def take_screenshot(self):
        self.actions.append({'kind':'screenshot'})
        if self.screenshot_fails: raise RuntimeError('controlled screenshot failure')
        return 'controlled-image', None, None


def environment(source_root, branch, template, screenshot_fails=False):
    actions = []
    def notify(**kwargs):
        actions.append({'kind':'notification','level':kwargs['level'],'message':kwargs['content']})
    cfg = SimpleNamespace(notify_template={'InstanceNotCompleted':template}, instance_team_enable=False,
        tp_before_instance=False, break_down_level_four_relicset=False, auto_battle_detect_enable=False,
        instance_names_challenge_count={'凝滞虚影':1}, merge_immersifier=False, build_target_enable=False,
        instance_type='凝滞虚影',instance_names={'凝滞虚影':'目标甲'},get_value=lambda key,default:default)
    namespace = {'log':Log(actions), 'auto':Automation(branch,actions,screenshot_fails), 'cfg':cfg,
        'screen':SimpleNamespace(change_to=lambda *args:None,wait_for_screen_change=lambda *args:None),
        'time':Clock(), 'NotificationLevel':SimpleNamespace(ERROR='ERROR'), 'notif':SimpleNamespace(notify=notify),
        'Character':SimpleNamespace(borrow=lambda *args:None), 're':re}
    namespace['Base'] = load_class(source_root,'tasks/base/base.py','Base',namespace)
    namespace['Instance'] = load_class(source_root,'tasks/power/instance.py','Instance',namespace)
    return namespace, actions


def run(source_root):
    config_path = 'assets/config/config.example.yaml'
    config = (source_root/config_path).read_bytes()
    if hashlib.sha256(config).hexdigest() != LOCK['files'][config_path]: raise ValueError('Config hash mismatch')
    match = re.search(r'^  InstanceNotCompleted: (".*")$',config.decode('utf-8'),re.M)
    if not match: raise ValueError('Default template not found')
    template = json.loads(match[1])
    cases = []
    for branch, reason in [('locked','指定副本未解锁'),('not_found','未找到指定副本'),('teleport_failed','传送可能失败'),('start_failed','无法开始挑战')]:
        namespace, actions = environment(source_root,branch,template)
        instance = namespace['Instance']
        result = instance.start_instance('饰品提取',1) if branch == 'start_failed' else instance.prepare_instance('凝滞虚影','目标甲')
        assert result is False, (branch,result)
        assert actions == [{'kind':'log','level':'INFO','message':template.format(error=reason)},
                           {'kind':'screenshot'}, {'kind':'notification','level':'ERROR','message':template.format(error=reason)}], (branch,actions)
        cases.append({'case':branch,'result':False,'actions':actions})
    namespace, actions = environment(source_root,'not_found',template,screenshot_fails=True)
    try:
        namespace['Instance'].prepare_instance('凝滞虚影','目标甲')
        raise AssertionError('Expected controlled screenshot failure')
    except RuntimeError:
        assert actions[0] == {'kind':'log','level':'INFO','message':template.format(error='未找到指定副本')}
        assert not any(action['kind']=='notification' for action in actions)
    cases.append({'case':'screenshot_failure_keeps_info','actions':actions})
    for branch, expected in [('not_found',3),('retry_recovered',1)]:
        namespace, actions = environment(source_root,branch,template)
        power = load_class(source_root,'tasks/power/power.py','Power',namespace)
        power.get = staticmethod(lambda:30)  # Controlled OCR/power-reading dependency only.
        power.run()  # Real run -> execute_power_plan -> process -> Instance.run -> Base branches.
        retries = [a for a in actions if a['kind']=='log' and a['message'].startswith('检测到该次副本未正常运行')]
        assert len(retries) == expected, actions
        assert [a['message'] for a in retries] == [f'检测到该次副本未正常运行，重试：{n}/3' for n in range(1,expected+1)]
        assert any(a.get('message')=='副本任务完成' for a in actions) == (branch=='retry_recovered')
        assert actions[-1] == {'kind':'header','level':2,'message':'完成'}
        cases.append({'case':'power_'+branch,'actions':actions})
    return {'sourceType':'executed_pinned_upstream_with_controlled_automation','upstreamCommit':LOCK['commit'],
        'realGameRun':False,'sourceHashes':{p:LOCK['files'][p] for p in (config_path,'tasks/base/base.py','tasks/power/instance.py','tasks/power/power.py')},
        'passed':len(cases),'cases':cases}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args = parser.parse_args()
    report = run(args.source_root.resolve())
    with args.output.open('x',encoding='utf-8') as stream: json.dump(report,stream,ensure_ascii=False,indent=2); stream.write('\n')
    print(f"March7th upstream branches: {report['passed']} passed, 0 skipped; no game or network actions")
