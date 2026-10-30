import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeHiddenTaskColumns, taskColumnStorageKey } from '../src/lib/taskColumnVisibility.ts';

test('task columns default visible and reject malformed or essential column keys', () => {
  assert.deepEqual(normalizeHiddenTaskColumns(null), []);
  assert.deepEqual(normalizeHiddenTaskColumns({statusNotes:true}), []);
  assert.deepEqual(normalizeHiddenTaskColumns(['statusNotes','progress','statusNotes','description','details','unknown',false]), ['statusNotes','progress']);
});
test('column visibility is isolated by viewer, owner, board and sheet, including all-sheets', () => {
  const keys = [taskColumnStorageKey('a','a','work',null), taskColumnStorageKey('b','a','work',null), taskColumnStorageKey('a','b','work',null), taskColumnStorageKey('a','a','personal',null), taskColumnStorageKey('a','a','work','null'), taskColumnStorageKey('a','a','work','ראשי')];
  assert.equal(new Set(keys).size, keys.length);
  assert.notEqual(taskColumnStorageKey('a:b','c','work',null), taskColumnStorageKey('a','b:c','work',null));
});
