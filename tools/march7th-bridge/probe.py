"""Run pinned upstream check-in branches with controlled dependencies, then export real event streams."""
import argparse
import ast
import difflib
import hashlib
import json
from abc import ABC, abstractmethod
from pathlib import Path
from types import SimpleNamespace
import nxp_bridge
from source_patch import sources, PATHS, LOCK


class Automation:
    def __init__(self, mode, actions):
        self.mode, self.actions, self.clicked = mode, actions, False
    def click_element(self, target, kind, *args, **kwargs):
        self.actions.append(['click', target])
        if kind == 'text': return self.mode != 'entry_missing'
        if 'click_close' in target:
            if self.mode == 'interrupted': raise RuntimeError('controlled interruption')
            return True
        if self.mode in ('claimed', 'interrupted') and not self.clicked:
            self.clicked = True
            return True
        return False
    def find_element(self, target, *args, **kwargs):
        self.actions.append(['find', target])
        return self.mode in ('claimed', 'interrupted', 'no_collection')


def execute(code, mode, name):
    actions = []
    namespace = dict(ABC=ABC, abstractmethod=abstractmethod, _nxp_emit=nxp_bridge.emit,
        auto=Automation(mode, actions), cfg=SimpleNamespace(),
        screen=SimpleNamespace(change_to=lambda value: actions.append(['screen', value])),
        time=SimpleNamespace(sleep=lambda value: actions.append(['sleep', value])),
        log=SimpleNamespace(info=lambda value: actions.append(['log', value]), hr=lambda value, level: actions.append(['header', value])))
    for path, name_ in zip(PATHS, ('ActivityTemplate', 'CheckInActivity')):
        tree = ast.parse(code[path], filename=path)
        selected = [node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == name_]
        assert len(selected) == 1
        exec(compile(ast.Module(body=selected, type_ignores=[]), path, 'exec'), namespace)
    try:
        result = namespace['CheckInActivity'](name, True).start()
        return actions, result
    except RuntimeError:
        # Preserve the original exception for the writer's lifecycle hook.
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    original, patched = sources(args.source_root)
    args.output.mkdir(parents=True, exist_ok=False)
    patch = ''.join(''.join(difflib.unified_diff(original[p].splitlines(True), patched[p].splitlines(True),
        fromfile='a/'+p, tofile='b/'+p)) for p in PATHS)
    (args.output/'upstream.patch').write_text(patch, encoding='utf-8', newline='\n')
    identity = dict(run_id='prototype-run', attempt_id='prototype-attempt', binding_id='isolated-binding',
        nonce='isolated-session-nonce-20260921', upstream_commit=nxp_bridge.COMMIT)
    session = dict(enabled=True, sourceId='bridge', nativeSourceId='native', bindingId=identity['binding_id'], sessionNonce=identity['nonce'])
    cases, producer_cases = [], []
    for name, key in nxp_bridge.TASKS.items():
        for mode in ('claimed', 'no_reward', 'entry_missing', 'no_collection'):
            label = key+'-'+mode
            baseline = execute(original, mode, name)
            # Disabled means no output directory/file creation and unchanged upstream actions.
            with nxp_bridge.session(args.output/(label+'-disabled.jsonl')):
                assert execute(patched, mode, name) == baseline
            assert not (args.output/(label+'-disabled.jsonl')).exists()
            path = args.output/(label+'.jsonl')
            with nxp_bridge.session(path, enabled=True, **identity):
                assert execute(patched, mode, name) == baseline
            lines = path.read_text(encoding='utf-8').splitlines(True)
            events = [json.loads(line) for line in lines]
            branch = {'claimed':'reward_collected','no_reward':'entry_ready_no_reward',
                'entry_missing':'entry_not_confirmed','no_collection':'collection_not_confirmed'}[mode]
            result = 'succeeded' if mode in ('claimed','no_reward') else 'unknown'
            assert events[2]['branchCode'] == branch and events[2]['result'] == result
            assert [e['event'] for e in events] == ['session.started','task.started','task.result','session.ended']
            producer_cases.append(dict(name=label, branch=branch, result=result, actions=baseline[0],
                sha256=hashlib.sha256(path.read_bytes()).hexdigest(), noExtraActions=True, defaultOff=True))
            for chunk in (1, 97, len(''.join(lines))):
                text = ''.join(lines)
                cases.append(dict(name=label+'-chunk'+str(chunk), basis='executed_upstream_branch', key=key, taskName=name,
                    chunks=[dict(text=text[i:i+chunk]) for i in range(0,len(text),chunk)], expected=result, session=session))
    # Fault tests mutate recorded producer output; none are presented as production evidence.
    name, key = next(iter(nxp_bridge.TASKS.items()))
    raw = (args.output/(key+'-claimed.jsonl')).read_text(encoding='utf-8').splitlines(True)
    def fault(label, lines, expected='unknown', **extra):
        cases.append(dict(name=label,basis='consumer_fault_mutation',key=key,taskName=name,
            chunks=[dict(text=line) for line in lines],expected=expected,session=session,**extra))
    fault('duplicate-result', raw[:3]+[raw[2]]+raw[3:], 'succeeded')
    fault('missing-task-result', raw[:2]+raw[3:])
    fault('missing-task-start', raw[:1]+raw[2:])
    fault('missing-session-end', raw[:3])
    fault('half-line-eof', raw[:2]+[raw[2][:40]])
    fault('duplicate-member', raw[:2]+[raw[2].replace('{','{"result":"succeeded",',1)]+raw[3:])
    altered=json.loads(raw[2]);altered['unexpected']='value'
    fault('unknown-member',raw[:2]+[json.dumps(altered)+'\n']+raw[3:])
    altered=json.loads(raw[2]);altered['branchCode']='x'*9000
    fault('oversize-event',raw[:2]+[json.dumps(altered)+'\n']+raw[3:])
    fault('native-duplicate', raw, 'succeeded', native='2026-09-21 00:00:00,000 | INFO | 领取'+name+'奖励完成\n')
    empty = (args.output/(key+'-no_reward.jsonl')).read_text(encoding='utf-8').splitlines(True)
    fault('native-conflict', empty, native='2026-09-21 00:00:00,000 | INFO | 领取'+name+'奖励完成\n')
    for field, value in [('sessionNonce','wrong-session-nonce'),('bindingId','other-binding'),('runId','other-run'),
                         ('attemptId','other-attempt'),('upstreamCommit','0'*40),('taskKey','other-task'),('result','failed')]:
        altered = json.loads(raw[2]); altered[field] = value
        fault('wrong-'+field, raw[:2]+[json.dumps(altered)+'\n']+raw[3:])
    altered = json.loads(raw[2]); altered['result'] = 'unknown'
    fault('conflicting-replay', raw[:3]+[json.dumps(altered)+'\n']+raw[3:])
    fault('default-off', raw, bridgeDisabled=True)
    fault('removed-bridge', [], bridgeDisabled=True)
    fault('source-mismatch', raw, wrongSource=True)
    fault('reconnect', raw, newEpochAt=2)
    fault('cancelled', raw, lifecycle='cancelled', expected='cancelled')
    # Actual upstream exception: the context records a gap and preserves the exception.
    path=args.output/'interrupted.jsonl'
    try:
        with nxp_bridge.session(path, enabled=True, **identity): execute(patched, 'interrupted', name)
    except RuntimeError: pass
    else: raise AssertionError('Upstream exception swallowed')
    interrupted=path.read_text(encoding='utf-8').splitlines(True)
    assert any(json.loads(line)['event']=='session.gap' for line in interrupted)
    cases.append(dict(name='upstream-interrupted',basis='executed_upstream_branch',key=key,taskName=name,
        chunks=[dict(text=line) for line in interrupted],expected='unknown',session=session))
    # Writer failure cannot manufacture success or alter upstream return/control flow.
    path=args.output/'writer-failure.jsonl'
    with nxp_bridge.session(path, enabled=True, **identity) as writer:
        writer.file.close()
        assert execute(patched,'claimed',name) == execute(original,'claimed',name)
        assert writer.failed
    fault('writer-failure',path.read_text(encoding='utf-8').splitlines(True))
    report=dict(upstreamCommit=nxp_bridge.COMMIT,sourceHashes={p:LOCK['files'][p] for p in PATHS},
        officialReleaseSupport='not_verified',producerCases=producer_cases,producerPassed=len(producer_cases)+2,
        runId=identity['run_id'],attemptId=identity['attempt_id'],cases=cases)
    (args.output/'replay.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Producer: {len(producer_cases)+2} passed, 0 skipped; {len(cases)} consumer scenarios exported')


if __name__ == '__main__': main()
