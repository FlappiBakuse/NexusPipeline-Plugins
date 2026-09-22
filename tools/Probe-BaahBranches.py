"""Run pinned BAAH wrapper/order branches with inert navigation and task dependencies."""
import argparse
import ast
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
from itertools import product

LOCK = {'modules/AllTask/Task.py': '277072efe58bb6b7b831a5808b68e12f86b622f1be3d8ac0a1e197982989c948',
        'modules/AllTask/myAllTask.py': '246376653ebd5f6698ddc14c5d80c90b77d351a850cdfc824833f5c724b6423f',
        'BAAH.py': '5d5f8928892445448a5071f72b9734eea5dcebdb1fc6e006ea9fd60fe37302be'}
for _name, _sha in {
    'InWanted': '26b7b6a61dfe1bec15cff76e1957c73aba5fb56cce59962b1a901e336c9a525d',
    'InSpecial': '02811c77d6a7a66c67332b7f2cb9a6220498f319cd6031fedbe879b50213f275',
    'InExchange': 'abd98a2e943ea5d256b94a3d6b65af24c21aac0d74d57fd023684f9412d7d010',
    'BuyAP': 'e11372a1ba609a4a69a6272b5117c9450e661cac4c30aae16564e75f8b2aca03',
    'InMomotalk': 'daf0498454942a8f227ca44859cd3a6a634ee1dac73a6293ebe9011d57a281b5',
    'InEventRecap': '1ab8d8ff941c579d91a1a8161cef0c8026036d2724e3242e5cfb08c40bb32925',
}.items():
    LOCK[f'modules/AllTask/{_name}/{_name}.py'] = _sha


def load(root, path, name, methods, namespace):
    source = (root / path).read_bytes()
    assert hashlib.sha256(source).hexdigest() == LOCK[path], 'Source identity mismatch: ' + path
    cls = next(n for n in ast.parse(source).body if isinstance(n, ast.ClassDef) and n.name == name)
    cls.bases = []; cls.decorator_list = []
    cls.body = [n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name in methods]
    exec(compile(ast.Module(body=[cls], type_ignores=[]), path, 'exec'), namespace)
    return namespace[name]


def run(root):
    cases = []
    for case in ['none', 'false', 'pre-skip', 'post-home', 'post-fatal', 'exception']:
        events = []
        logger = SimpleNamespace(**{level: (lambda message, level=level: events.append((level, message)))
                                    for level in ['info', 'warn', 'error']})
        namespace = dict(logging=logger, config=SimpleNamespace(userconfigdict={'ACTIVITY_PATH': 'inert'},
            append_noti_sentence=lambda **kw: None), CN='zh_CN', EN='en_US', istr=lambda text: text['zh_CN'],
            Page=SimpleNamespace(is_page=lambda _: case != 'post-fatal'), PageName=SimpleNamespace(PAGE_HOME='home'),
            ButtonName=SimpleNamespace(BUTTON_HOME_ICON='home', BUTTON_STORY_MENU='story'),
            PopupName=SimpleNamespace(POPUP_LOGIN_FORM='login', POPUP_LOGIN_FORM_STEAM='steam'),
            match=lambda *a, **kw: False, button_pic=lambda x: x, popup_pic=lambda x: x,
            check_app_running=lambda _: True, screenshot=lambda: None, sleep=lambda _: None)
        task_type = load(root, 'modules/AllTask/Task.py', 'Task', {'run', 'back_to_home'}, namespace)
        task_type.run_until = staticmethod(lambda action, condition, count: condition())
        task_type.clear_popup = staticmethod(lambda: None)
        task = task_type(); task.name = 'InFreeAward'; task.pre_times = 2; task.post_times = 4
        task.click_magic_sleep = lambda: None
        task.pre_condition = lambda: case != 'pre-skip'
        task.post_condition = lambda: case not in ['post-home', 'post-fatal']
        def on_run():
            if case == 'exception': raise RuntimeError('controlled task error')
            return False if case == 'false' else None
        task.on_run = on_run
        error = None
        try: task.run()
        except Exception as ex: error = str(ex)
        texts = [message.get('zh_CN') if isinstance(message, dict) else message for _, message in events]
        assert ('任务InFreeAward执行结束' in texts) == (case in ['none', 'false'])
        assert ('返回主页成功' in texts) == (case == 'post-home')
        assert (error is not None) == (case in ['post-fatal', 'exception'])
        cases.append(dict(name=case, events=events, error=error))
    for resume in [-1, 1, 2, 3, 4]:
        called = []; events = []
        def item(name, identity):
            return SimpleNamespace(name=name, run=lambda: called.append(identity))
        pipeline = ['first', 'second']
        config = SimpleNamespace(userconfigdict={'OPEN_GAME_APP_TASK': True, 'DO_POST_ALL_TASK': True},
                                 sessiondict={'CURRENT_PERIOD_TASK_INDEX': resume})
        namespace = dict(config=config, CN='zh_CN', EN='en_US', istr=lambda x: x['zh_CN'],
            logging=SimpleNamespace(info=lambda x: events.append(x), warn=lambda x: events.append(x)),
            EnterGame=lambda: item('EnterGame', 'login'), PostAllTask=lambda: item('PostAllTask', 'cleanup'),
            TaskName=SimpleNamespace(TACTICAL_CHALLENGE='unused-contest', EVENT='unused-event'),
            return_now_activate_pipeline=lambda _: (pipeline, [True, True], [], 0),
            task_instances_map=SimpleNamespace(taskmap={key: SimpleNamespace(
                task_module=lambda key=key, **kw: item('InQuest', key), task_params={}) for key in pipeline}))
        task_type = load(root, 'modules/AllTask/myAllTask.py', 'AllTask', {'parse_task', 'run', 'add_task'}, namespace)
        task_type().run()
        expected = ['login'] + [name for i, name in enumerate(['login', 'first', 'second', 'cleanup']) if i and i >= resume]
        assert called == expected, (resume, called, expected)
        cases.append(dict(name='resume-' + str(resume), calls=called, events=events))
    cases.extend(main_branches(root))
    cases.extend(business_branches(root))
    return dict(sourceHashes=LOCK, passed=len(cases), skipped=0, cases=cases,
        basis='Original Task.run/back_to_home, AllTask.parse_task/run, BAAH_main retry and selected business on_run branches; controlled recognizers/actions and task constructors. No game executed.')


def business_branches(root):
    class Constants:
        def __getattr__(self, key): return key
    cases = []
    specifications = [
        ('InWanted', 'empty', '今天轮次中无悬赏通缉关卡，跳过'),
        ('InSpecial', 'empty', '今天轮次中无特殊关卡，跳过'),
        ('InExchange', 'empty', '今天轮次中无学院交流会关卡，跳过'),
        ('InWanted', 'entry', '无法打开通缉页面，任务退出'),
        ('InSpecial', 'entry', "Can't open special page, task quit"),
        ('InExchange', 'entry', '无法打开交换页面，任务退出'),
        ('InSpecial', 'event', '设置为没有活动不进行，跳过'),
        ('InExchange', 'event', '设置为没有活动不进行，跳过'),
        ('BuyAP', 'entry', '未找到购买按钮'),
        ('BuyAP', 'price', '识别单价失败'),
        ('BuyAP', 'limit', '价格超过限制，不购买'),
        ('InMomotalk', 'entry', '未检测到momotalk弹窗，跳过此任务'),
        ('InMomotalk', 'empty', '未检测到红点标记，跳过此任务'),
        ('InEventRecap', 'entry', '无法进入剧情一览页面'),
    ]
    for name, branch, expected in specifications:
        events = []
        logger = SimpleNamespace(**{level: (lambda msg, level=level: events.append((level, msg)))
                                    for level in ['info', 'warn', 'warning', 'error']})
        values = {key: [[]] if branch == 'empty' else [[[1, 1, 1, True]]]
                  for key in ['WANTED_HIGHEST_LEVEL', 'SPECIAL_HIGHTEST_LEVEL', 'EXCHANGE_HIGHEST_LEVEL']}
        values.update(SPEICAL_EVENT_STATUS=True, EXCHANGE_EVENT_STATUS=True, BUY_AP_MAX_PRICE=100, BUY_AP_ADD_TIMES=1)
        namespace = dict(logging=logger, config=SimpleNamespace(userconfigdict=values),
            CN='zh_CN', EN='en_US', JP='ja_JP', istr=lambda x: x['zh_CN'],
            time=SimpleNamespace(localtime=lambda: SimpleNamespace(tm_mday=1)),
            Page=SimpleNamespace(is_page=lambda *a, **kw: False, TOPLEFTBACK=(0, 0), MAGICPOINT=(0, 0), COLOR_PINK=None),
            PageName=Constants(), ButtonName=Constants(), PopupName=Constants(), AssetMappingKeys=Constants(),
            get_correct_asset=lambda *a: ((0, 1, 1), (0, 1, 1)),
            click=lambda *a, **kw: None, sleep=lambda *a: None, match_pixel=lambda *a, **kw: False,
            match=lambda *a, **kw: (True, (0, 0), 1) if kw.get('returnpos') else False,
            popup_pic=lambda x: x, button_pic=lambda x: x, screenshot=lambda: None,
            ocr_area=lambda *a: ['unreadable' if branch == 'price' else '999'],
            np=SimpleNamespace(linspace=lambda *a, **kw: [0]), product=product, InEvent=lambda: None)
        task_type = load(root, f'modules/AllTask/{name}/{name}.py', name, {'on_run'}, namespace)
        task = task_type()
        task.run_until = lambda *a, **kw: branch != 'entry'
        for method in ['back_to_home', 'scroll_left_up', 'clear_popup', 'scroll_right_up', 'scroll_right_down']:
            setattr(task, method, lambda *a, **kw: None)
        task.whether_has_red_icon = lambda: False
        task._go_to_event_recap_page = lambda: False
        task.COLOR_HOME_WHITE = None; task.HOME_POINT = None
        task.on_run()
        texts = [msg.get('zh_CN') if isinstance(msg, dict) else msg for _, msg in events]
        assert expected in texts, (name, branch, texts)
        cases.append(dict(name=name + '-' + branch, events=events,
                          basis='Original on_run; navigation/OCR/clock controlled; no game input'))
    return cases


def main_branches(root):
    source = (root / 'BAAH.py').read_bytes()
    assert hashlib.sha256(source).hexdigest() == LOCK['BAAH.py']
    nodes = [n for n in ast.walk(ast.parse(source)) if isinstance(n, ast.FunctionDef)
             and n.name in {'BAAH_main', 'BAAH_auto_quit'}]
    cases = []
    for scenario in ['recovered', 'exhausted', 'retry-disabled']:
        events = []; calls = []
        config = SimpleNamespace(userconfigdict={'RETRY_WHEN_ERROR': 0 if scenario == 'retry-disabled' else 2,
            'RETRY_WHEN_ERROR_FROM_LAST_TASK': True}, softwareconfigdict={'ENABLE_CRASH_REPORT': False},
            sessiondict={'CURRENT_RETRY_TIMES': 0, 'CURRENT_PERIOD_TASK_INDEX': 1}, nowuserconfigname='fixture')
        def parse_config(_): config.sessiondict.update(CURRENT_RETRY_TIMES=0, CURRENT_PERIOD_TASK_INDEX=-1)
        config.parse_user_config = parse_config
        def task_run():
            calls.append(config.sessiondict['CURRENT_PERIOD_TASK_INDEX'])
            if scenario != 'recovered' or len(calls) == 1:
                raise RuntimeError('任务InFreeAward执行后条件不成立或超时，且无法正确返回主页，程序退出')
        logger = SimpleNamespace(**{level: (lambda msg, level=level: events.append((level, msg)))
                                    for level in ['info', 'warn', 'error']}, save_custom_log_file=lambda: None)
        namespace = dict(config=config, logging=logger, CN='zh_CN', EN='en_US', istr=lambda x: x['zh_CN'],
            time=SimpleNamespace(strftime=lambda _: 'fixture-time'), must_auto_quit=True,
            my_AllTask=SimpleNamespace(run=task_run), EmulatorBlockError=type('EmulatorBlockError', (Exception,), {}),
            handle_error_mention=lambda *args: None)
        for name in ['print_BAAH_info', 'print_BAAH_config_info', 'print_BAAH_finish', 'BAAH_run_pre_command',
                     'BAAH_release_adb_port', 'BAAH_start_emulator', 'BAAH_check_adb_connect', 'BAAH_start_VPN',
                     'BAAH_open_target_app', 'BAAH_close_target_app', 'BAAH_close_VPN', 'BAAH_kill_emulator',
                     'BAAH_send_email', 'BAAH_rm_pic', 'BAAH_run_post_command', 'BAAH_send_err_mail']:
            namespace[name] = lambda *args, **kwargs: None
        exec(compile(ast.Module(body=nodes, type_ignores=[]), 'BAAH.py', 'exec'), namespace)
        namespace['BAAH_main']()
        assert calls == [1] * {'recovered': 2, 'exhausted': 3, 'retry-disabled': 1}[scenario]
        texts = [msg.get('zh_CN') if isinstance(msg, dict) else msg for _, msg in events]
        assert texts.count('所有任务结束') == (1 if scenario == 'recovered' else 0)
        cases.append(dict(name='main-' + scenario, taskResumeIndices=calls, events=events,
                          autoQuitMode='original must_auto_quit branch; no process launched'))
    return cases


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args(); report = run(args.source_root)
    with args.output.open('x', encoding='utf-8') as stream: json.dump(report, stream, ensure_ascii=False, indent=2)
    print('BAAH original wrapper/order branches: ' + str(report['passed']) + ' passed, 0 skipped')
