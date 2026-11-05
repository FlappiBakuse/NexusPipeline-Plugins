import { contractFingerprint, sdkVersion, type FrontendExtension, type FrontendTransport } from '@nexuspipeline/extension-sdk';
import { createPanel, paragraph } from '../../../frontend-ui/src/elements.js';
import { localize } from '../../../frontend-ui/src/localize.js';
import { MaaEditor } from './editor.js';
import type { MaaPorts } from './ports.js';
import { english } from './messages.js';
import { MaaHostPorts } from './host-ports.js';
import '../../../frontend-ui/src/style.css';
import './style.css';

function extension(ports?: MaaPorts, transport?: FrontendTransport): FrontendExtension {
  return {
    extensionId: 'maa-framework',
    sdkVersion,
    contractFingerprint,
    activate(context) {
      for (const [id, target] of [
        ['script', 'automation.script.editor'],
        ['binding', 'automation.binding.editor']
      ] as const)
        context.registerSurface({
          id: 'maa-framework.' + id,
          target,
          mount(surface) {
            const t = localize(context, english);
            const current = transport ? new MaaHostPorts(transport, surface.context) : ports;
            if (!current) {
              const panel = createPanel(surface, 'MaaFramework', t);
              paragraph(panel.body, t('MaaFramework 编辑服务尚未接入'));
              return panel.cleanup;
            }
            const editor = new MaaEditor(surface, current, t);
            return () => editor.dispose();
          }
        });
    }
  };
}

export function createExtension(ports?: MaaPorts): FrontendExtension { return extension(ports); }

export default createExtension();

export function createFrontend(transport: FrontendTransport): FrontendExtension {
  return extension(undefined, transport);
}
