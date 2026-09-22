"""Execute pinned ZZZ operation retries, charge-result consumption and group return boundaries."""
import __future__
import argparse
import ast
import hashlib
import json
import time
from pathlib import Path
from types import SimpleNamespace as NS

LOCK = json.loads((Path(__file__).parent / 'task-protocol/source-lock.json').read_text(encoding='utf-8'))['zzz']
OP = 'src/one_dragon/base/operation/operation.py'
CHARGE = 'src/zzz_od/application/charge_plan/charge_plan_app.py'
GROUP = 'src/one_dragon/base/operation/application/group_application.py'


def load(root, path, name, methods, namespace):
    data = (root / path).read_bytes()
    assert hashlib.sha256(data).hexdigest() == LOCK['files'][path], path
    cls = next(n for n in ast.parse(data).body if isinstance(n, ast.ClassDef) and n.name == name)
    cls.bases = []; cls.decorator_list = []
    cls.body = [n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name in methods]
    for method in cls.body: method.decorator_list = []
    exec(compile(ast.Module(body=[cls], type_ignores=[]), path, 'exec',
                 flags=__future__.annotations.compiler_flag), namespace)
    return namespace[name]


def run(root):
    cases = []
    for scenario in ['success', 'recovered', 'retry-exhausted', 'explicit-failure']:
        events = []; calls = []
        kinds = NS(SUCCESS=1, FAIL=2, RETRY=3, WAIT=4)
        def round_result(kind, status): return NS(result=kind, status=status, status_display=status, data=None)
        def op_result(success, status, data=None): return NS(success=success, status=status, data=data, is_success=success)
        logger = NS(**{level: (lambda fmt, *args, level=level, **kw: events.append(
            dict(level=level, text=fmt % args if args else fmt))) for level in ['info', 'error']})
        namespace = dict(log=logger, time=time, OperationRoundResultEnum=kinds,
                         coalesce_gt=lambda value, fallback, **kw: value if value is not None else fallback,
                         send_node_notify=lambda *args: None)
        typ = load(root, OP, 'Operation', {'execute', 'after_operation_done'}, namespace)
        typ.STATUS_TIMEOUT = '执行超时'
        operation = typ(); operation.display_name = '指令[ 区域巡防 迅雷与裂爪 ]'
        operation.ctx = NS(run_context=NS(is_context_stop=False, is_context_pause=False), unlisten_all_event=lambda _: None)
        operation.timeout_seconds = -1; operation.op_callback = None; operation.node_retry_times = 0
        operation.node_max_retry_times = 1; operation.last_screenshot = None
        operation._current_node = NS(cn='检测游戏窗口', mute=False); operation._previous_node = None
        for method in ['_init_before_execute', '_emit_debug_round_trace', '_emit_debug_timeline',
                       '_emit_debug_round_perf', '_reset_status_for_new_node']:
            setattr(operation, method, lambda *args, **kw: None)
        operation.op_success = lambda status, data=None: op_result(True, status, data)
        operation.op_fail = lambda status, data=None: op_result(False, status, data)
        operation.round_retry = lambda status: round_result(kinds.RETRY, status)
        def execute_round():
            calls.append(operation._current_node.cn)
            if operation._current_node.cn == '检测游戏窗口': return round_result(kinds.SUCCESS, '成功')
            attempts = calls.count('等待战斗画面加载')
            if scenario == 'retry-exhausted' or scenario == 'recovered' and attempts == 1:
                raise RuntimeError('controlled recognition failure')
            return round_result(kinds.FAIL if scenario == 'explicit-failure' else kinds.SUCCESS,
                                '未找到 按键-普通攻击' if scenario == 'explicit-failure' else '完成')
        operation._execute_one_round = execute_round
        operation._get_next_node = lambda _: NS(cn='等待战斗画面加载', mute=False) if operation._current_node.cn == '检测游戏窗口' else None
        child_result = operation.execute()
        success = scenario in ['success', 'recovered']
        assert child_result.success == success
        assert calls.count('等待战斗画面加载') == (2 if scenario in ['recovered', 'retry-exhausted'] else 1)
        assert sum('执行出错' in event['text'] for event in events) == {'success': 0, 'recovered': 1, 'retry-exhausted': 2, 'explicit-failure': 0}[scenario]

        namespace = dict(AreaPatrol=lambda *args: NS(execute=lambda: child_result))
        charge_type = load(root, CHARGE, 'ChargePlanApp', {'area_patrol', 'challenge_complete'}, namespace)
        charge = charge_type(); charge.ctx = None; charge.current_plan = NS(skipped=False)
        charge.temp_plan = None; charge.last_tried_plan = None
        charge.round_by_op_result = lambda result: result
        charge.round_success = lambda: op_result(True, '成功')
        charge.previous_node = charge.area_patrol()
        advanced = charge.challenge_complete()
        assert advanced.success and charge.current_plan.skipped == (not success)
        assert (charge.last_tried_plan is charge.current_plan) == (not success)
        cases.append(dict(name=scenario, events=events, calls=calls, childSuccess=child_result.success,
                          parentNodeSuccess=advanced.success, planSkipped=charge.current_plan.skipped))

    for scenario in ['success', 'failure', 'disabled', 'already-done']:
        calls = []
        application = NS(app_id='email', op_name='邮件', execute=lambda: calls.append('execute') or NS(success=scenario == 'success'))
        context = NS(current_instance_idx=1, run_context=NS(current_group_id='original', current_app_id='original',
            get_application=lambda **kw: application,
            get_run_record=lambda **kw: NS(check_and_update_status=lambda: None, is_done=scenario == 'already-done')))
        typ = load(root, GROUP, 'GroupApplication', {'run_app'}, {})
        typ.STATUS_ALL_DONE = '全部结束'; typ.STATUS_NEXT = '下一个'
        group = typ(); group.ctx = context; group._group_id = 'one_dragon'; group._current_app_idx = 0
        group._fail_app_idx_list = []
        group._group_config = NS(app_list=[NS(app_id='email', enabled=scenario != 'disabled')])
        group.round_success = lambda status: NS(success=True, status=status)
        group.round_fail = lambda status: NS(success=False, status=status)
        returned = group.run_app()
        assert returned.success
        assert group._fail_app_idx_list == ([0] if scenario == 'failure' else [])
        assert calls == (['execute'] if scenario in ['success', 'failure'] else [])
        assert context.run_context.current_group_id == context.run_context.current_app_id == 'original'
        cases.append(dict(name='group-' + scenario, status=returned.status, failedIndices=group._fail_app_idx_list, calls=calls))
    return dict(commit=LOCK['commit'], sourceHashes={p: LOCK['files'][p] for p in [OP, CHARGE, GROUP]},
                basis='Original execute/retry/logging and result-consumption methods; controlled node graph, recognizers and applications. No GUI/game execution.',
                passed=len(cases), skipped=0, cases=cases)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args(); report = run(args.source_root)
    with args.output.open('x', encoding='utf-8') as stream: json.dump(report, stream, ensure_ascii=False, indent=2)
    print('ZZZ original control-flow branches: ' + str(report['passed']) + ' passed, 0 skipped')
