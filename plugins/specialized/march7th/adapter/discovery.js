'use strict';

globalThis.nexusDiscoverScript = discoverFromSource(input => sourceResult(input,
  sourceExists('March7th Assistant.exe') && sourceExists('March7th Launcher.exe') ? [
  sourceCandidate('daily', '日常 · config.yaml', 'March7th Assistant.exe',
    ['main', '--non-interactive', '--after-finish', 'Exit'], [sourceResource('main', 'config.yaml', 'yaml')], ['logs/????-??-??.log'])] : [], sourceExists('config/workflows', 'directory') &&
    sourceEntries('config/workflows').some(entry => entry.kind === 'file' ? /\.ya?ml$/i.test(entry.name) :
      sourceExists('config/workflows/' + entry.name + '/workflow.yaml')) ? ['march7th_custom_workflow_requires_native_editor'] : [],
    sourceExists('March7th Assistant.exe') ? sourceEditor(input, 'March7th Launcher.exe', ['config.yaml'], true) : undefined));
