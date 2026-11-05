'use strict';

globalThis.nexusDiscoverScript = input => sourceResult(input, sourceExists('March7th Assistant.exe') ? [
  sourceCandidate('daily', '日常 · config.yaml', 'March7th Launcher.exe', ['main', '--exit'],
    [sourceResource('main', 'config.yaml', 'yaml')], ['logs/*.log'])] : []);
