import type { MaaProfile } from './ports.js';

export function resetPackageRoot(profile: MaaProfile, root: string): void {
  profile.packageRoot = root;
  profile.sourceBinding = profile.sourceSnapshot = null;
  profile.dependencyLock = profile.runtimeInputs = null;
  profile.authorizedFingerprint = '';
  profile.nativeDirectory = '';
  profile.nativeVersion = '';
  profile.windowHandle = profile.windowProcessId = 0;
  profile.windowExecutable = '';
  profile.windowStartedAtUtc = undefined;
}
