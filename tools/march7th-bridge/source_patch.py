"""Minimal branch hooks; verify original bytes before producing an isolated patch."""
import hashlib
import json
from pathlib import Path

LOCK = json.loads((Path(__file__).resolve().parents[1]/'task-protocol/source-lock.json').read_text(encoding='utf-8'))['march7th']
PATHS = ('tasks/activity/activitytemplate.py', 'tasks/activity/checkInactivity.py')


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError('Patch anchor is not unique')
    return text.replace(old, new, 1)


def sources(root):
    originals = {}
    for path in PATHS:
        data = (root/path).read_bytes()
        if hashlib.sha256(data).hexdigest() != LOCK['files'][path]:
            raise ValueError('Unreviewed source: '+path)
        originals[path] = data.decode('utf-8').replace('\r\n', '\n')
    patched = dict(originals)
    path = PATHS[0]
    patched[path] = replace_once(patched[path], '    def prepare(self):\n',
        '    def prepare(self):\n        self._nxp_entry_ready = False\n')
    patched[path] = replace_once(patched[path], '        time.sleep(1)\n',
        '        time.sleep(1)\n        self._nxp_entry_ready = True\n')
    path = PATHS[1]
    patched[path] = 'from nxp_bridge import emit as _nxp_emit\n'+patched[path]
    patched[path] = replace_once(patched[path], '    def _collect_rewards(self):\n',
        '    def _collect_rewards(self):\n        self._nxp_collected = 0\n')
    patched[path] = replace_once(patched[path], '            time.sleep(1)\n',
        '            time.sleep(1)\n            self._nxp_collected += 1\n')
    patched[path] = replace_once(patched[path], '    def run(self):\n',
        '    def run(self):\n        _nxp_emit("task.started", self.name, "checkin_entered")\n')
    patched[path] = replace_once(patched[path], '            log.info(f"领取{self.name}奖励完成")\n',
        '            log.info(f"领取{self.name}奖励完成")\n'
        '            if getattr(self, "_nxp_entry_ready", False) and self._nxp_collected > 0:\n'
        '                _nxp_emit("task.result", self.name, "reward_collected", "succeeded")\n'
        '            else:\n'
        '                _nxp_emit("task.result", self.name, "collection_not_confirmed", "unknown")\n'
        '        elif getattr(self, "_nxp_entry_ready", False):\n'
        '            _nxp_emit("task.result", self.name, "entry_ready_no_reward", "succeeded")\n'
        '        else:\n'
        '            _nxp_emit("task.result", self.name, "entry_not_confirmed", "unknown")\n')
    return originals, patched
