import { ExtensionScope, sdkVersion, contractFingerprint, type TaskAdapter, type FrontendHandshake, type ExtensionManifest, type FrontendPreview, type FrontendTransport } from '@nexuspipeline/extension-sdk';
import type { ExecutionProjectRequest, ExecutionProjectResponseSelection, TaskDefinitionsTask, TaskDefinitionsObservation, ScriptSource } from '@nexuspipeline/extension-sdk';
// @ts-expect-error Control-plane DTOs are outside the public plugin SDK.
import type { ControlError } from '@nexuspipeline/extension-sdk';

const scope = new ExtensionScope();
const request: TaskAdapter = {
  format: 'nexus.task.adapter', version: 1, direction: 'request', phase: 'discover',
  extensionId: 'bettergi', operationId: '00000000-0000-4000-8000-000000000001', resources: [],
};
const source: ScriptSource = { format: 'nexus.script.source', version: 1, direction: 'response',
  extensionId: 'bettergi', operationId: request.operationId, diagnostics: [], candidates: [{
    candidateId: 'account', title: 'Explicit account', executable: 'script.exe', arguments: ['account'],
    resources: [{ resourceId: 'main', path: 'config/account.json', syntax: 'json' }], logPaths: ['logs/*.log'] }] };
const task: TaskDefinitionsTask = { taskId: 'leaf', title: 'Leaf', isSelected: true, isEnabled: true,
  executionTaskId: 'native-leaf', repetitionLimit: 3,
  dependencies: ['parent'], retrySafety: 'safe', retryPrerequisites: ['parent'],
  projection: { resourceId: 'main', relativePath: 'config.yaml', selector: ['leaf_enable'] } };
const selection: ExecutionProjectResponseSelection = { consumerExtensionId: 'maas', bindingId: request.operationId,
  selectedTaskIds: ['leaf'], executionTaskIds: ['native-leaf'], repetitionOffsets: [{ taskId: 'leaf', completedRepetitions: 1 }] };
const observation: TaskDefinitionsObservation = { taskId: 'leaf', state: 'failed', reasonCode: 'native_failed', completedRepetitions: 1 };
const project: ExecutionProjectRequest = { fingerprint: 'a'.repeat(64), sequence: 1, kind: 'asset', name: 'root', offset: 0, maximumBytes: 131072 };
const states: FrontendPreview[] = ['waiting_run', 'waiting_for_game', 'window_not_ready', 'emulator_not_ready', 'unavailable']
  .map(state => ({ state } as Exclude<FrontendPreview, { state: 'ready' }>));
await scope.dispose();
const handshake: FrontendHandshake = {
  format: 'nexus.extension.frontend', version: 1, extensionId: 'fixture', sdkVersion, contractFingerprint,
};
const manifest: ExtensionManifest = {
  format: 'nexus.extension.manifest', version: 1, extensionId: 'fixture', artifactName: 'Fixture', displayName: 'Fixture',
  packageVersion: '0.5.0', kind: 'managed-code', minHostVersion: '0.18.0', sdkVersion, contractFingerprint,
  capabilities: [], permissions: {}, managed: { entryAssembly: 'Fixture.dll', entryType: 'Fixture.Extension' },
};
void [request, source, task, selection, observation, project, states, handshake, manifest];
