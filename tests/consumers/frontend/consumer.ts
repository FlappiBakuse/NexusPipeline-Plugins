import { ExtensionScope, sdkVersion, contractFingerprint, type TaskAdapter, type FrontendHandshake, type ExtensionManifest, type FrontendPreview, type FrontendTransport } from '@nexuspipeline/extension-sdk';
import type { ExecutionProjectRequest, ExecutionProjectResponseSelection, TaskDefinitionsTask, TaskDefinitionsObservation, ScriptSource } from '@nexuspipeline/extension-sdk';
// @ts-expect-error Control-plane DTOs are outside the public plugin SDK.
import type { ControlError } from '@nexuspipeline/extension-sdk';

const scope = new ExtensionScope();
const request: TaskAdapter = {
  format: 'nexus.task.adapter', version: 1, direction: 'request', phase: 'discover',
  extensionId: 'bettergi', operationId: '00000000-0000-4000-8000-000000000001', resources: [],
};
if (request.version !== 1 || request.phase !== 'discover') throw new Error('Unexpected generated protocol shape');
const source: ScriptSource = { format: 'nexus.script.source', version: 1, direction: 'response',
  extensionId: 'bettergi', operationId: request.operationId, diagnostics: [], candidates: [{
    candidateId: 'account', title: 'Explicit account', executable: 'script.exe', arguments: ['account'],
    resources: [{ resourceId: 'main', path: 'config/account.json', syntax: 'json' }], logPaths: ['logs/*.log'] }] };
const reopenedSource = JSON.parse(JSON.stringify(source)) as ScriptSource;
if (reopenedSource.candidates?.[0]?.resources[0]?.path !== 'config/account.json' ||
    reopenedSource.operationId !== request.operationId) throw new Error('Source discovery roundtrip failed');
const task: TaskDefinitionsTask = { taskId: 'leaf', title: 'Leaf', isSelected: true, isEnabled: true,
  executionTaskId: 'native-leaf', repetitionLimit: 3,
  dependencies: ['parent'], retrySafety: 'safe', retryPrerequisites: ['parent'],
  projection: { resourceId: 'main', relativePath: 'config.yaml', selector: ['leaf_enable'] } };
const reopenedTask = JSON.parse(JSON.stringify(task)) as TaskDefinitionsTask;
if (reopenedTask.projection?.selector[0] !== 'leaf_enable' || reopenedTask.retryPrerequisites?.[0] !== 'parent') throw new Error('Task projection roundtrip failed');
const selection: ExecutionProjectResponseSelection = { consumerExtensionId: 'maas', bindingId: request.operationId,
  selectedTaskIds: ['leaf'], executionTaskIds: ['native-leaf'], repetitionOffsets: [{ taskId: 'leaf', completedRepetitions: 1 }] };
const observation: TaskDefinitionsObservation = { taskId: 'leaf', state: 'failed', reasonCode: 'native_failed', completedRepetitions: 1 };
if (reopenedTask.repetitionLimit !== 3 || JSON.parse(JSON.stringify(selection)).repetitionOffsets[0].completedRepetitions !== 1 ||
    JSON.parse(JSON.stringify(observation)).completedRepetitions !== 1) throw new Error('Repetition protocol roundtrip failed');
const project: ExecutionProjectRequest = { fingerprint: 'a'.repeat(64), sequence: 1, kind: 'asset', name: 'root', offset: 0, maximumBytes: 131072 };
if (JSON.parse(JSON.stringify(project)).maximumBytes !== 131072) throw new Error('Project protocol roundtrip failed');
const states: FrontendPreview[] = ['waiting_run', 'waiting_for_game', 'window_not_ready', 'emulator_not_ready', 'unavailable']
  .map(state => ({ state } as Exclude<FrontendPreview, { state: 'ready' }>));
const previews: Pick<FrontendTransport, 'preview'> = { preview: async () => ({ state: 'ready',
  capturedAt: '2026-10-30T00:00:00Z', image: { blob: new Blob(), width: 480, height: 360, release() {} } }) };
const preview = await previews.preview({ instanceId: request.operationId, surfaceId: "execution.running.preview" }, 'current-task', new AbortController().signal);
if (preview.state !== 'ready' || preview.image.height !== 360 || !preview.capturedAt || states.length !== 5)
  throw new Error('Preview contract consumer failed');
preview.image.release();
await scope.dispose();
const handshake: FrontendHandshake = {
  format: 'nexus.extension.frontend', version: 1, extensionId: 'fixture', sdkVersion, contractFingerprint,
};
const manifest: ExtensionManifest = {
  format: 'nexus.extension.manifest', version: 1, extensionId: 'fixture', artifactName: 'Fixture', displayName: 'Fixture',
  packageVersion: '0.5.0', kind: 'managed-code', minHostVersion: '0.18.0', sdkVersion, contractFingerprint,
  capabilities: [], permissions: {}, managed: { entryAssembly: 'Fixture.dll', entryType: 'Fixture.Extension' },
};
console.log(JSON.stringify({ status: 'PASS', scope: 'independent SDK package consumer', handshake, manifest }));
