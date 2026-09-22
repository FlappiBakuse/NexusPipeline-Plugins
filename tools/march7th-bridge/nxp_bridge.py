"""Opt-in, local-only branch event writer for the isolated source prototype."""
from contextlib import contextmanager
from datetime import datetime, timezone
import json
from pathlib import Path

COMMIT = '7423dea64552f71332cc71f3c02481695aaec151'
PRODUCER = 'nxp.march7th.checkin.prototype'
TASKS = {'巡星之礼': 'checkin.stellar', '巡光之礼': 'checkin.light', '庆典祝礼': 'checkin.celebration'}
_active = None


class Session:
    def __init__(self, path, *, run_id, attempt_id, binding_id, nonce, upstream_commit):
        if upstream_commit != COMMIT:
            raise ValueError('Unsupported upstream commit')
        values = (run_id, attempt_id, binding_id, nonce)
        if any(not isinstance(v, str) or not 1 <= len(v) <= 128 for v in values) or len(nonce) < 16:
            raise ValueError('Invalid frozen bridge identity')
        self.identity = dict(runId=run_id, attemptId=attempt_id, bindingId=binding_id, sessionNonce=nonce)
        self.sequence = 0
        self.failed = False
        self.file = Path(path).open('x', encoding='utf-8', newline='\n')

    def write(self, event, key, branch, result=None):
        if self.failed:
            return
        self.sequence += 1
        payload = dict(schemaVersion='1.0-prototype', producer=PRODUCER, upstreamCommit=COMMIT,
            **self.identity, sequence=self.sequence, taskKey=key, event=event, branchCode=branch,
            evidenceBasis='gap' if event == 'session.gap' else 'upstream_branch' if key else 'bridge_lifecycle',
            occurredAt=datetime.now(timezone.utc).isoformat())
        if result is not None:
            payload['result'] = result
        try:
            self.file.write(json.dumps(payload, ensure_ascii=False, separators=(',', ':'))+'\n')
            self.file.flush()
        except (OSError, ValueError):
            # Missing/partial events and an absent session end remain observable.
            self.failed = True


@contextmanager
def session(path, *, enabled=False, **identity):
    global _active
    if not enabled:
        yield None
        return
    if _active is not None:
        raise RuntimeError('Bridge sessions cannot overlap')
    writer = Session(path, **identity)
    _active = writer
    try:
        writer.write('session.started', None, 'explicit_session')
        yield writer
    except BaseException:
        writer.write('session.gap', None, 'upstream_interrupted')
        raise
    finally:
        writer.write('session.ended', None, 'session_closed')
        _active = None
        try:
            writer.file.close()
        except OSError:
            writer.failed = True


def emit(event, name, branch, result=None):
    if _active is not None and name in TASKS:
        _active.write(event, TASKS[name], branch, result)
