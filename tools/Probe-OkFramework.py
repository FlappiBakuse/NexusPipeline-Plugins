"""Execute pinned wheel control-flow methods with inert devices/tasks; no GUI, game or installed packages."""
import __future__
import argparse
import ast
import builtins
import hashlib
import json
from pathlib import Path
import threading
import sys
from types import SimpleNamespace
import zipfile

WHEELS = {'2.0.4': '425dcc023f8000a610bbf8de38c454e0f940e2cf3f92e67ea1d6eae2078016da',
          '2.0.7b1': '7d9b9570d22390f9edcd612ea2a700e9365b8706318caeb6e520f7228de1fe75'}


def run(root, version):
    wheel = root / f'ok_script-{version}-py3-none-any.whl'
    assert hashlib.sha256(wheel.read_bytes()).hexdigest() == WHEELS[version], 'Wheel identity mismatch'
    archive = zipfile.ZipFile(wheel)
    sources = {}
    def method(path, cls, name, namespace):
        data = archive.read(path)
        sources[path] = hashlib.sha256(data).hexdigest()
        parent = next(n for n in ast.parse(data).body if isinstance(n, ast.ClassDef) and n.name == cls)
        node = next(n for n in parent.body if isinstance(n, ast.FunctionDef) and n.name == name)
        exec(compile(ast.Module(body=[node], type_ignores=[]), path, 'exec',
                     flags=__future__.annotations.compiler_flag), namespace)
        value = namespace[name]
        return value.__func__ if isinstance(value, staticmethod) else value
    class TaskDisabledException(Exception): pass
    class FinishedException(Exception): pass
    class Signal:
        def __init__(self, name, events): self.name, self.events = name, events
        def emit(self, *args): self.events.append((self.name, [getattr(a, 'name', a) for a in args]))
    class Task:
        def __init__(self, name, executor, result):
            self.name, self.executor, self.result = name, executor, result
            self._enabled = False
            self.running = self.paused = self.exit_after_task = self.enable_after_start = False
            self.config = {}
        @property
        def enabled(self): return self._enabled
        def info_clear(self): pass
        def disable(self): self._enabled = False
        def run(self):
            if isinstance(self.result, Exception): raise self.result
            return self.result
    cases = []
    for result_name, result_value in [('false', False), ('none', None), ('disabled', TaskDisabledException())]:
        events = []
        signals = SimpleNamespace(**{name: Signal(name, events) for name in
                                  ['task', 'task_done', 'notification', 'starting_emulator', 'quit']})
        logger = SimpleNamespace(**{level: lambda text, *args: events.append(('log', [text]))
                                   for level in ['info', 'debug', 'error']})
        executor = SimpleNamespace(onetime_tasks=[], onetime_task_queue=[], trigger_tasks=[], current_task=None,
                                   paused=False, lock=threading.Lock(), _frame=object(), _last_frame_time=0)
        launcher = Task('LauncherTask', executor, None)
        daily = Task('DailyRoutineTask' if version == '2.0.4' else 'DailyTask', executor, result_value)
        launcher.enable_after_start = version == '2.0.4'
        executor.onetime_tasks = [launcher, daily] if version == '2.0.4' else [daily]
        # Parse the actual candidate command line and resolve its 1-based task index.
        process_source = archive.read('ok/util/process.py')
        sources['ok/util/process.py'] = hashlib.sha256(process_source).hexdigest()
        parse_node = next(n for n in ast.parse(process_source).body if isinstance(n, ast.FunctionDef)
                          and n.name == 'parse_arguments_to_map')
        parser_namespace = dict(argparse=argparse)
        exec(compile(ast.Module(body=[parse_node], type_ignores=[]), 'ok/util/process.py', 'exec'), parser_namespace)
        saved_argv = sys.argv
        try:
            sys.argv = ['main.py', '-a', 'true', '-u', 'manual', '-t', '2' if version == '2.0.4' else '1', '-e']
            parsed = parser_namespace['parse_arguments_to_map']()
        finally:
            sys.argv = saved_argv
        assert parsed['exit'] is True
        dependency_types = SimpleNamespace(BaseTask=type('BaseTask', (), {}), TriggerTask=type('TriggerTask', (), {}))
        def controlled_import(name, *args, **kwargs):
            if name == 'ok.task.task': return dependency_types
            raise AssertionError('Unexpected upstream import: ' + name)
        selector_namespace = {'__builtins__': dict(vars(builtins), __import__=controlled_import)}
        select = method('ok/__init__.py', 'OK', 'get_onetime_task', selector_namespace)
        assert select(SimpleNamespace(task_executor=executor), parsed['task']) is daily
        exit_event = SimpleNamespace(is_set=lambda: not executor.onetime_task_queue and executor.current_task is None)
        namespace = dict(logger=logger, communicate=signals, time=SimpleNamespace(time=lambda: 0, sleep=lambda _: None),
                         prevent_sleeping=lambda _: None, alert_info=lambda _: None,
                         TaskDisabledException=TaskDisabledException, FinishedException=FinishedException)
        for name in ['enqueue_onetime_task', 'next_task', 'execute']:
            func = method('ok/task/TaskExecutor.py', 'TaskExecutor', name, namespace)
            setattr(executor, name, lambda *args, f=func: f(executor, *args))
        executor.exit_event = exit_event
        executor._wake_executor = lambda: None
        executor._get_wake_version = lambda: None
        executor.reset_scene = lambda: None
        executor.next_frame = lambda **kwargs: object()
        executor.destroy = lambda: None
        executor.get_all_tasks = lambda: executor.onetime_tasks
        executor.start = lambda: None
        device = SimpleNamespace(do_refresh=lambda _: None, stop_hwnd=lambda: events.append(('stop_device', [])))
        executor.device_manager = device
        namespace['og'] = SimpleNamespace(executor=executor, device_manager=device)
        controller = SimpleNamespace(start_timeout=1, start_exe=False, check_gpu_driver_post_processing=lambda: None,
                                     tr=lambda text: text)
        mark = method('ok/core/start_controller.py', 'StartController', '_mark_task_enabled', namespace)
        controller._mark_task_enabled = mark
        start = method('ok/core/start_controller.py', 'StartController', '_do_start', namespace)
        assert start(controller, daily, True)
        queued = [t.name for t in executor.onetime_task_queue]
        assert queued == (['LauncherTask', daily.name] if version == '2.0.4' else [daily.name])
        assert daily.exit_after_task and not launcher.exit_after_task
        executor.execute()
        completed = [args[0] for name, args in events if name == 'task_done']
        quit_count = sum(name == 'quit' for name, _ in events)
        if result_name == 'disabled':
            assert daily.name not in completed and quit_count == 0
        else:
            assert daily.name in completed and quit_count == 1
        cases.append(dict(result=result_name, queued=queued, completedSignals=completed, quitSignals=quit_count,
                          events=events))
    return dict(version=version, wheelSha256=WHEELS[version], sourceHashes=sources, passed=len(cases), skipped=0,
                basis='Original wheel methods with inert task results and device ports; not installed distribution qualification',
                cases=cases)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--wheel-root', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    reports = [run(args.wheel_root, version) for version in WHEELS]
    with args.output.open('x', encoding='utf-8') as stream: json.dump(reports, stream, ensure_ascii=False, indent=2)
    print('ok-script original control flow: 6 passed, 0 skipped')
