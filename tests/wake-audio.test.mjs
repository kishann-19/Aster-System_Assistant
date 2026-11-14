import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('native sound wake handles short snaps, claps, sensitivity and pair timing', { skip: process.platform !== 'darwin' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'aster-wake-'));
  try {
    const executable = join(dir, 'wake-test');
    execFileSync('xcrun', ['swiftc', 'native/VoiceWake.swift', 'tests/WakeAudio.swift', '-o', executable]);
    execFileSync(executable);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
