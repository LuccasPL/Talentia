import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aiUserAllowed} from '../lib/ai-access.ts';

const pilot = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
test('paid AI denies users when pilot configuration is absent or malformed', () => {
  for (const config of ['', '*', 'all', 'not-a-user', `prefix-${pilot}`]) {
    assert.equal(aiUserAllowed(pilot, config), false);
  }
  assert.equal(aiUserAllowed('', pilot), false);
});
test('only explicitly listed user IDs receive paid AI access', () => {
  assert.equal(aiUserAllowed(pilot, ` ${pilot}, invalid `), true);
  assert.equal(aiUserAllowed(other, pilot), false);
  assert.equal(aiUserAllowed(pilot.slice(0, 20), pilot), false);
  assert.equal(aiUserAllowed(other, `${pilot}, ${other}`), true);
});
