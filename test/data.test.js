'use strict';
const assert = require('assert');
const { buildBaseData } = require('../data/base-data');

const d = buildBaseData();
const names = new Set([...d.killers, ...d.survivors].map((c) => c.name));
const ids = new Set();
for (const p of d.perks) {
  assert.ok(p.owner === 'General' || names.has(p.owner), `Unknown owner "${p.owner}" on ${p.name}`);
  assert.ok(!ids.has(p.id), `Duplicate perk id ${p.id}`);
  ids.add(p.id);
}
const incomplete = [];
for (const c of [...d.killers, ...d.survivors]) {
  assert.ok(c.perks.length <= 3, `${c.name} has ${c.perks.length} perks`);
  if (c.perks.length < 3) incomplete.push(`${c.name} (${c.perks.length}/3)`);
}
// A few newest perks aren't confirmed yet; the DBD Wiki sync fills them in.
assert.ok(incomplete.length <= 4, `Too many characters missing perks: ${incomplete.join(', ')}`);
if (incomplete.length) console.log('perks still to come from the wiki sync:', incomplete.join(', '));
const allChars = new Set([...d.killers, ...d.survivors].map((c) => c.id));
for (const b of d.presets) {
  assert.strictEqual(b.perks.length, 4, `Preset ${b.name} needs 4 perks`);
  for (const id of b.perks) assert.ok(ids.has(id), `Preset ${b.name}: unknown perk ${id}`);
  for (const id of b.perks) assert.strictEqual(d.perks.find((p) => p.id === id).role, b.role, `Preset ${b.name}: ${id} is not a ${b.role} perk`);
  assert.ok(!b.characterId || allChars.has(b.characterId), `Preset ${b.name}: unknown character ${b.characterId}`);
}
console.log(`ok: ${d.presets.length} presets`);
console.log(`ok: ${d.killers.length} killers, ${d.survivors.length} survivors, ${d.perks.length} perks`);
