import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseCommand} from '../src/commands.mjs';

test('the packaged voice license is available offline and matches the asset manifest', async () => {
  const file = 'native/voice-model/LICENSE';
  const manifest = JSON.parse(await readFile(new URL('../scripts/asset-checksums.json', import.meta.url)));
  const license = await readFile(new URL('../' + file, import.meta.url));
  assert.equal(createHash('sha256').update(license).digest('hex'), manifest[file]);
});

test('spoken reminders accept a time before the subject', () => {
  const now = new Date(2026, 10, 15, 8);
  const due = new Date(2026, 10, 16, 9).toISOString();
  for (const command of [
    'Set a reminder for tomorrow at 9 am to stretch',
    'Remind me tomorrow at 9 am, to stretch',
    'Remind me to stretch by tomorrow at 9 am',
  ]) {
    assert.deepEqual(parseCommand(command, now), {type: 'reminder', title: 'stretch', due});
  }
  assert.equal(parseCommand('Set a reminder for tomorrow at 9 am.', now).type, 'clarifyReminder');
});
