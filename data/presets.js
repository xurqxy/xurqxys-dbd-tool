'use strict';
// Popular builds shown on the Builds page. One line per build:
//   [role, name, character or '' for any, [4 perk names], note, credit]
// Perk and character names must match the names in base-data.js (npm test checks this).
// To feature a streamer's build, put their name in the last field, e.g. 'as played by SomeStreamer'.
const PRESETS = [
  ['killer', 'Gen Regression', '', ['Scourge Hook: Pain Resonance', 'Grim Embrace', "Dead Man's Switch", 'Deadlock'], 'Keep generators stuck all match. Strong on any killer.', ''],
  ['killer', 'Hex Gamble', '', ['Hex: Ruin', 'Hex: Undying', 'Hex: Devour Hope', 'Hex: No One Escapes Death'], 'Huge payoff if the totems survive. Pure fun, pure risk.', ''],
  ['killer', 'Endgame Lockdown', '', ['No Way Out', 'Remember Me', 'Blood Warden', 'Bitter Murmur'], 'Turn the exit gates into a trap.', ''],
  ['killer', 'Tracker', '', ['Lethal Pursuer', 'Barbecue & Chilli', 'Nowhere to Hide', "Friends 'til the End"], 'Always know where survivors are.', ''],
  ['killer', 'Chase Brute', '', ['Bamboozle', 'Brutal Strength', 'Enduring', 'Spirit Fury'], 'Win chases through pallets and windows.', ''],
  ['killer', 'Stealth Stalker', 'The Shape', ['Monitor & Abuse', 'Tinkerer', 'Trail of Torment', 'Lethal Pursuer'], 'Sneak up on survivors before they hear you coming.', ''],
  ['killer', 'Pallet Breaker', 'The Nurse', ['Pop Goes the Weasel', 'Corrupt Intervention', 'Lethal Pursuer', 'Barbecue & Chilli'], 'Classic Nurse setup: early info and steady slowdown.', ''],
  ['survivor', 'Chase Meta', '', ['Windows of Opportunity', 'Sprint Burst', 'Resilience', 'Dead Hard'], 'Loop the killer for as long as possible.', ''],
  ['survivor', 'Gen Rusher', '', ['Prove Thyself', 'Déjà Vu', 'Resilience', 'Hyperfocus'], 'Finish generators before the killer gets going.', ''],
  ['survivor', 'Team Healer', '', ['Botany Knowledge', "We'll Make It", 'Kindred', 'Borrowed Time'], 'Keep the whole team on their feet.', ''],
  ['survivor', 'Anti-Tunnel', '', ['Off the Record', 'Decisive Strike', 'Unbreakable', 'Deliverance'], 'Make tunnelling and slugging you a bad idea.', ''],
  ['survivor', 'Ghost', '', ['Distortion', 'Calm Spirit', 'Lucky Break', 'Iron Will'], "The killer won't find you.", ''],
  ['survivor', 'Solo Queue Info', '', ['Kindred', 'Bond', 'Windows of Opportunity', 'Empathy'], 'See what your random teammates are up to.', ''],
  ['survivor', 'Boon Totem Team', '', ['Boon: Circle of Healing', 'Boon: Shadow Step', 'Boon: Exponential', 'Detective\'s Hunch'], 'Bless totems and turn them into team buffs.', ''],
];

module.exports = { PRESETS };
