import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {neisDate} from '../src/school-sheet-ui.ts';

test('NEIS dates read as month, day and weekday regardless of time zone', () => {
  assert.equal(neisDate('2026-11-05'), '11월 5일(목)');
  assert.equal(neisDate('2026-12-25'), '12월 25일(금)');
  assert.equal(neisDate('2027-01-01'), '1월 1일(금)');
});

test('the NEIS key lives only in script properties, never in the repository', () => {
  const script = readFileSync(new URL('../assets/school-guestbook.gs', import.meta.url), 'utf8');
  assert.match(script, /getProperty\('NEIS_KEY'\)/);
  assert.doesNotMatch(script, /KEY=[0-9a-f]{32}/i);
  assert.doesNotMatch(script, /['"][0-9a-f]{32}['"]/i);
});
