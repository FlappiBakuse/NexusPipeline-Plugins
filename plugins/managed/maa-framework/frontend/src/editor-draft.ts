import type { EditorDraftScope } from '@nexuspipeline/extension-sdk';
import type { MaaEditorState, MaaProfile, MaaSchema } from './ports.js';
import { MaaSources } from './maa-sources.js';
import { MaaSecretDrafts } from './secret-drafts.js';

interface EditorDraft {
  editor?: MaaEditorState;
  profile?: MaaProfile;
  schema?: MaaSchema;
  sources: MaaSources;
  preset: string;
  preview?: unknown;
  previewProfile: string;
  version: number;
  advanced: boolean;
}

export function editorDraft(scope: EditorDraftScope) {
  const state = scope.retain<EditorDraft>('editor', () => ({
    sources: new MaaSources(), preset: '', previewProfile: '', version: 0, advanced: false
  }));
  const secrets = scope.protect('secrets', () => new MaaSecretDrafts(), value => value.clear());
  return { state, secrets };
}
