import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

path = Path(__file__).resolve().parents[1]/'march7th-bridge/nxp_bridge.py'
spec = importlib.util.spec_from_file_location('bridge_test_module', path)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class March7thBridgeTests(unittest.TestCase):
    def identity(self):
        return dict(run_id='run',attempt_id='attempt',binding_id='binding',nonce='isolated-test-nonce',upstream_commit=bridge.COMMIT)

    def test_default_off_and_removed_bridge_create_no_file(self):
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'events.jsonl'
            with bridge.session(output): bridge.emit('task.started','巡星之礼','checkin_entered')
            bridge.emit('task.started','巡星之礼','checkin_entered')
            self.assertFalse(output.exists())

    def test_identity_is_frozen_and_file_cannot_be_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'events.jsonl'
            with bridge.session(output,enabled=True,**self.identity()):
                bridge.emit('task.started','巡星之礼','checkin_entered')
            events=[json.loads(line) for line in output.read_text(encoding='utf-8').splitlines()]
            self.assertEqual([1,2,3],[e['sequence'] for e in events])
            self.assertTrue(all(e['bindingId']=='binding' and e['runId']=='run' for e in events))
            original=output.read_bytes()
            with self.assertRaises(FileExistsError):
                with bridge.session(output,enabled=True,**self.identity()): pass
            self.assertEqual(original,output.read_bytes())

    def test_unknown_version_cannot_start(self):
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'events.jsonl'
            identity=self.identity();identity['upstream_commit']='0'*40
            with self.assertRaises(ValueError):
                with bridge.session(output,enabled=True,**identity): pass
            self.assertFalse(output.exists())

    def test_interruption_preserves_exception_and_writes_gap(self):
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'events.jsonl'
            with self.assertRaisesRegex(RuntimeError,'interrupted'):
                with bridge.session(output,enabled=True,**self.identity()): raise RuntimeError('interrupted')
            events=[json.loads(line) for line in output.read_text(encoding='utf-8').splitlines()]
            self.assertEqual(['session.started','session.gap','session.ended'],[e['event'] for e in events])
            self.assertTrue(all('result' not in e for e in events))

    def test_writer_failure_does_not_change_task_control_flow(self):
        with tempfile.TemporaryDirectory() as folder:
            with bridge.session(Path(folder)/'events.jsonl',enabled=True,**self.identity()) as writer:
                writer.file.close()
                bridge.emit('task.started','巡星之礼','checkin_entered')
                self.assertTrue(writer.failed)


if __name__ == '__main__': unittest.main()
