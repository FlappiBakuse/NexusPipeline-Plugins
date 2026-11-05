import { choice, paragraph, type Panel } from '../../../frontend-ui/src/elements.js';
import type { MaaDiscovery, MaaProfile } from './ports.js';
import { bindLocale } from '../../../frontend-ui/src/localize.js';

export class MaaSources {
  discovery: MaaDiscovery | undefined;
  id = '';
  confirmed = false;

  accept(profile: MaaProfile, discovery: MaaDiscovery): void {
    this.discovery = discovery;
    if (discovery.interfacePath) profile.interfacePath = discovery.interfacePath;
    const binding = profile.sourceBinding;
    const candidate = binding && discovery.candidates.find(item => item.kind === binding.sourceKind &&
      item.instanceId === binding.sourceInstanceId && (!binding.sourcePath || item.path === binding.sourcePath));
    this.id = candidate ? candidate.id : discovery.candidates.length === 1 ? discovery.candidates[0]!.id : '';
  }

  draw(panel: Panel, parent: HTMLElement, profile: MaaProfile, changed: () => void, discover: () => Promise<void>): boolean {
    const discovery = this.discovery;
    if (discovery && discovery.interfaceCandidates.length > 1) {
      choice(panel, parent, '项目接口', profile.interfacePath,
        discovery.interfaceCandidates.map(value => ({ value, label: value })), value => {
          profile.interfacePath = value;
          this.confirmed = true;
          changed();
          void panel.run(discover);
        });
      if (!this.confirmed || !discovery.interfaceCandidates.includes(profile.interfacePath)) {
        paragraph(parent, panel.t('请先选择项目接口，再继续编辑配置。'));
        return false;
      }
    }
    if (discovery && discovery.candidates.length > 1)
      choice(panel, parent, '来源配置', this.id, [{ value: '', label: '不选用来源' },
        ...discovery.candidates.map(item => ({ value: item.id, label: item.name + ' · ' + item.kind }))], value => {
          this.id = value;
          profile.sourceBinding = profile.sourceSnapshot = null;
          changed();
        });
    const message = paragraph(parent, '');
    bindLocale(panel.t, panel.signal, message, 'text', () => {
      message.textContent = discovery?.candidates.length === 1
        ? panel.t('已发现来源配置：') + discovery.candidates[0]!.name
        : panel.t(discovery?.candidates.length ? '请选择要同步的来源配置。' : '正在查找项目及来源配置。');
    });
    message.className = 'maa-source-summary';
    return true;
  }
}
