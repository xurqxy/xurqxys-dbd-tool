// Bundled Dead by Daylight dataset for Xurqxys DBD Tool.
// Perk summaries are short paraphrases, not official text. Perks get reworked often,
// so everything here can be edited or overridden from the app's Data screen.
'use strict';
const { PRESETS } = require('./presets');

const DATA_VERSION = '2026.10';

// [name, power, chapter]
const KILLERS = [
  ['The Trapper', 'Bear Trap', 'Base Game'],
  ['The Wraith', 'Wailing Bell', 'Base Game'],
  ['The Hillbilly', 'Chainsaw', 'Base Game'],
  ['The Nurse', "Spencer's Last Breath", 'Base Game'],
  ['The Shape', 'Evil Within', 'Halloween'],
  ['The Hag', 'Blackened Catalyst', 'Of Flesh and Mud'],
  ['The Doctor', "Carter's Spark", 'Spark of Madness'],
  ['The Huntress', 'Hunting Hatchets', 'A Lullaby for the Dark'],
  ['The Cannibal', "Bubba's Chainsaw", 'Leatherface'],
  ['The Nightmare', 'Dream Demon', 'A Nightmare on Elm Street'],
  ['The Pig', "Jigsaw's Baptism", 'Saw'],
  ['The Clown', 'The Afterpiece Tonic', 'Curtain Call'],
  ['The Spirit', "Yamaoka's Haunting", 'Shattered Bloodline'],
  ['The Legion', 'Feral Frenzy', 'Darkness Among Us'],
  ['The Plague', 'Vile Purge', 'Demise of the Faithful'],
  ['The Ghost Face', 'Night Shroud', 'Ghost Face'],
  ['The Demogorgon', 'Of the Abyss', 'Stranger Things'],
  ['The Oni', 'Blood Fury', 'Cursed Legacy'],
  ['The Deathslinger', 'The Redeemer', 'Chains of Hate'],
  ['The Executioner', 'Rites of Judgement', 'Silent Hill'],
  ['The Blight', 'Blighted Corruption', 'Descend Beyond'],
  ['The Twins', 'Blood Bond', 'A Binding of Kin'],
  ['The Trickster', 'Showstopper', 'All-Kill'],
  ['The Nemesis', 'T-Virus', 'Resident Evil'],
  ['The Cenobite', 'Summons of Pain', 'Hellraiser'],
  ['The Artist', 'Birds of Torment', 'Portrait of a Murder'],
  ['The Onryō', 'Deluge of Fear', 'Sadako Rising'],
  ['The Dredge', 'Reign of Darkness', 'Roots of Dread'],
  ['The Mastermind', 'Virulent Bound', 'Resident Evil: Project W'],
  ['The Knight', 'Guardia Compagnia', 'Forged in Fog'],
  ['The Skull Merchant', 'Eyes in the Sky', 'Tools of Torment'],
  ['The Singularity', 'Quantum Instantiation', 'End Transmission'],
  ['The Xenomorph', 'Hidden Pursuit', 'Alien'],
  ['The Good Guy', "Playtime's Over", "Chucky"],
  ['The Unknown', 'UVX', 'All Things Wicked'],
  ['The Lich', 'Spells of Vecna', 'Dungeons & Dragons'],
  ['The Dark Lord', 'Vampiric Shift', 'Castlevania'],
  ['The Houndmaster', 'Scent of Blood', 'Doomed Course'],
  ['The Ghoul', '', 'Tokyo Ghoul'],
  ['The Animatronic', '', "Five Nights at Freddy's"],
  ['The Krasue', '', 'Sinister Grace'],
  ['The First', '', 'Stranger Things Chapter 2'],
  ['The Slasher', 'Omnipresent Evil', 'Jason'],
  ['The Judgment', 'Divine Light', 'Chorus of Sin'],
];

// [name, chapter]
const SURVIVORS = [
  ['Dwight Fairfield', 'Base Game'], ['Meg Thomas', 'Base Game'], ['Claudette Morel', 'Base Game'],
  ['Jake Park', 'Base Game'], ['Nea Karlsson', 'Base Game'], ['Laurie Strode', 'Halloween'],
  ['Ace Visconti', 'Of Flesh and Mud'], ['William "Bill" Overbeck', 'Left 4 Dead'],
  ['Feng Min', 'Spark of Madness'], ['David King', 'A Lullaby for the Dark'],
  ['Quentin Smith', 'A Nightmare on Elm Street'], ['Detective Tapp', 'Saw'],
  ['Kate Denson', 'Curtain Call'], ['Adam Francis', 'Shattered Bloodline'],
  ['Jeff Johansen', 'Darkness Among Us'], ['Jane Romero', 'Demise of the Faithful'],
  ['Ash Williams', 'Ash vs Evil Dead'], ['Nancy Wheeler', 'Stranger Things'],
  ['Steve Harrington', 'Stranger Things'], ['Yui Kimura', 'Cursed Legacy'],
  ['Zarina Kassir', 'Chains of Hate'], ['Cheryl Mason', 'Silent Hill'],
  ['Felix Richter', 'Descend Beyond'], ['Élodie Rakoto', 'A Binding of Kin'],
  ['Yun-Jin Lee', 'All-Kill'], ['Jill Valentine', 'Resident Evil'],
  ['Leon S. Kennedy', 'Resident Evil'], ['Mikaela Reid', 'Hour of the Witch'],
  ['Jonah Vasquez', 'Portrait of a Murder'], ['Yoichi Asakawa', 'Sadako Rising'],
  ['Haddie Kaur', 'Roots of Dread'], ['Ada Wong', 'Resident Evil: Project W'],
  ['Rebecca Chambers', 'Resident Evil: Project W'], ['Vittorio Toscano', 'Forged in Fog'],
  ['Thalita Lyra', 'Tools of Torment'], ['Renato Lyra', 'Tools of Torment'],
  ['Gabriel Soma', 'End Transmission'], ['Nicolas Cage', 'Nicolas Cage'],
  ['Ellen Ripley', 'Alien'], ['Alan Wake', 'Alan Wake'], ['Sable Ward', 'All Things Wicked'],
  ['Aestri Yazar', 'Dungeons & Dragons'], ['Lara Croft', 'Tomb Raider'],
  ['Trevor Belmont', 'Castlevania'], ['Taurie Cain', 'Doomed Course'], ['Orela Rose', 'Steady Pulse'],
  ['Rick Grimes', 'The Walking Dead'], ['Michonne Grimes', 'The Walking Dead'], ['Vee Boonyasak', 'Sinister Grace'],
  ['Eleven', 'Stranger Things Chapter 2'], ['Dustin Henderson', 'Stranger Things Chapter 2'],
  ['Kwon Tae-young', 'All-Kill: Comeback'], ['Shane Wiigwaas', 'The Life Road'], ['Aurora Stardotter', 'Chorus of Sin'],
];

// Perk lines: Name | owner ("General" = available to everyone) | tags | summary
const KILLER_PERKS = `
Bitter Murmur|General|aura,gen|See Survivors near a completed generator; all Survivors when the last one is done.
Deerstalker|General|aura|See the auras of Survivors in the dying state within range.
Distressing|General|chase|Larger Terror Radius and bonus Deviousness Bloodpoints.
Hex: No One Escapes Death|General|hex,endgame,exposed|Once all generators are done, Survivors are Exposed until the totem is cleansed.
Hex: Thrill of the Hunt|General|hex,totem,info|Slows totem cleansing and warns you when a Hex totem is being worked on.
Insidious|General|stealth|Become Undetectable while standing still.
Iron Grasp|General|hook|Survivors take longer to wiggle free and their struggling pushes you around less.
Scourge Hook: Monstrous Shrine|General|scourge,hook|Turns some hooks into Scourge Hooks that speed up Entity progress on hooked Survivors.
Sloppy Butcher|General|heal|Basic attacks apply Mangled and Haemorrhage, slowing healing.
Spies from the Shadows|General|info|Crows startled by Survivors alert you to their location.
Unrelenting|General|chase|Shorter cooldown after a missed basic attack.
Whispers|General|info|Tells you when Survivors are within range of you.
Unnerving Presence|The Trapper|skill-check|Survivors in your Terror Radius get more frequent, harder skill checks.
Brutal Strength|The Trapper|chase,gen|Break pallets and breakable walls and kick generators faster.
Agitation|The Trapper|hook|Move faster and have a larger Terror Radius while carrying a Survivor.
Predator|The Wraith|info,chase|Helps you track Survivors who break chase.
Bloodhound|The Wraith|info|Pools of blood are brighter and stay visible longer.
Shadowborn|The Wraith|chase|Wider field of view.
Enduring|The Hillbilly|chase|Recover faster from pallet stuns.
Lightborn|The Hillbilly|blind|Immune to blinding; reveals Survivors who try to blind you.
Tinkerer|The Hillbilly|gen,stealth|Alerts you when a generator is nearly repaired and makes you Undetectable.
Stridor|The Nurse|info|Survivors' grunts of pain and breathing are louder.
Thanatophobia|The Nurse|slowdown|Survivors are slower at actions for each injured Survivor.
A Nurse's Calling|The Nurse|aura,heal|See the auras of Survivors who are healing within range.
Save the Best for Last|The Shape|obsession,chase|Hitting non-Obsessions earns tokens that shorten your attack cooldown.
Play with Your Food|The Shape|obsession,haste|Earn Haste tokens by chasing the Obsession and letting them go.
Dying Light|The Shape|obsession,slowdown|Survivors other than the Obsession get slower at actions as you hook.
Hex: The Third Seal|The Hag|hex,blind|Survivors you hit become Blinded.
Hex: Ruin|The Hag|hex,gen,slowdown|Generators not being repaired regress automatically.
Hex: Devour Hope|The Hag|hex,exposed,haste|Hook tokens grant Haste, then Exposed, then the ability to kill.
Overwhelming Presence|The Doctor|item|Survivors in your Terror Radius burn item charges faster.
Monitor & Abuse|The Doctor|stealth,chase|Smaller Terror Radius outside chase, larger during chase.
Overcharge|The Doctor|gen,slowdown,skill-check|Kicked generators give a hard skill check and regress faster.
Beast of Prey|The Huntress|chase,stealth|Gain Bloodlust faster and lose your Red Stain.
Hex: Huntress Lullaby|The Huntress|hex,skill-check|Skill checks get less warning and harsher penalties as you hook.
Territorial Imperative|The Huntress|aura|See Survivors who enter the basement.
Knock Out|The Cannibal|aura|Survivors you down are hidden from their teammates.
Barbecue & Chilli|The Cannibal|aura,hook|After hooking, see Survivors far away from the hook.
Franklin's Demise|The Cannibal|item|Basic attacks make Survivors drop their item, which slowly loses charges.
Fire Up|The Nightmare|haste,endgame|Faster at breaking, vaulting and picking up for each completed generator.
Remember Me|The Nightmare|obsession,endgame|Exit gates open slower each time you hit the Obsession.
Blood Warden|The Nightmare|endgame,hook|Hooking during the endgame blocks the exit gates.
Surveillance|The Pig|gen,info|Regressing generators are highlighted and louder.
Make Your Choice|The Pig|exposed,altruism|Survivors who unhook far from you become Exposed.
Hangman's Trick|The Pig|hook,aura|See Survivors near hooks and get alerted to sabotage.
Coulrophobia|The Clown|heal|Healing is slower inside your Terror Radius.
Pop Goes the Weasel|The Clown|gen,slowdown|After hooking, the next generator you kick loses a large chunk of progress.
Bamboozle|The Clown|chase|Vault faster and block windows you vault.
Spirit Fury|The Spirit|chase|After breaking pallets, the next pallet stun breaks it instantly.
Hex: Haunted Ground|The Spirit|hex,exposed|Cleansing a trapped totem makes every Survivor Exposed.
Rancor|The Spirit|obsession,endgame,aura|Reveals Survivors on gen completion; the Obsession can be killed late.
Discordance|The Legion|gen,info|Highlights generators repaired by two or more Survivors.
Iron Maiden|The Legion|locker,exposed|Open lockers faster; Survivors leaving lockers become Exposed.
Mad Grit|The Legion|chase,hook|No cooldown on missed attacks while carrying a Survivor.
Corrupt Intervention|The Plague|gen,slowdown|Blocks the generators farthest from you at the start of the match.
Infectious Fright|The Plague|info|Downing a Survivor makes nearby Survivors scream and reveals them.
Dark Devotion|The Plague|obsession,stealth|Hitting the Obsession moves your Terror Radius onto them.
I'm All Ears|The Ghost Face|info|Reveals Survivors who rush-vault near you.
Thrilling Tremors|The Ghost Face|gen,slowdown|After picking up a Survivor, blocks generators nobody is repairing.
Furtive Chase|The Ghost Face|obsession,stealth|Hooking the Obsession shrinks your Terror Radius.
Cruel Limits|The Demogorgon|chase|Completing a generator blocks nearby vaults.
Mindbreaker|The Demogorgon|exhaustion,blind|Survivors repairing generators become Blinded and Exhausted.
Surge|The Demogorgon|gen,slowdown|Downing a Survivor with a basic attack damages nearby generators.
Zanshin Tactics|The Oni|aura,chase|See the auras of pallets, breakable walls and windows.
Blood Echo|The Oni|exhaustion,hook|Hooking makes injured Survivors Haemorrhage and Exhausted.
Nemesis|The Oni|obsession,aura,oblivious|Survivors who stun you become the Obsession, Oblivious and revealed.
Dead Man's Switch|The Deathslinger|obsession,gen,slowdown|After a hook, Survivors who stop repairing block that generator.
Hex: Retribution|The Deathslinger|hex,aura,oblivious|Cleansing totems makes Survivors Oblivious; breaking it reveals everyone.
Gearhead|The Deathslinger|gen,info|After hits, great skill checks reveal the generator being repaired.
Forced Penance|The Executioner|chase,anti-bodyblock|Survivors who take protection hits become Broken.
Trail of Torment|The Executioner|stealth,gen|Kicking a generator makes you Undetectable until it is repaired.
Deathbound|The Executioner|info,heal|Survivors who heal far from you are revealed and Oblivious.
Dragon's Grip|The Blight|gen,exposed|A kicked generator explodes on the next Survivor who touches it, making them Exposed.
Hex: Blood Favour|The Blight|hex,chase|Hitting a Survivor holds nearby pallets in place.
Hex: Undying|The Blight|hex,totem,aura|Moves your Hexes to another totem and reveals Survivors near totems.
Hoarder|The Twins|chest,info|Alerts you when Survivors pick up items or open chests.
Oppression|The Twins|gen,slowdown|Kicking a generator also regresses several others.
Coup de Grâce|The Twins|chase|Generator completions give tokens that extend your lunge.
Starstruck|The Trickster|exposed,hook|Survivors in your Terror Radius while you carry someone become Exposed.
Hex: Crowd Control|The Trickster|hex,chase|Windows that Survivors rush-vault get blocked.
No Way Out|The Trickster|endgame,hook|Hook tokens block exit gate switches when first touched.
Lethal Pursuer|The Nemesis|aura|Reveals every Survivor at the start and lengthens your aura reading.
Hysteria|The Nemesis|oblivious|Injuring a healthy Survivor makes all injured Survivors Oblivious.
Eruption|The Nemesis|gen,slowdown|Kicked generators explode and incapacitate Survivors when someone is downed.
Deadlock|The Cenobite|gen,slowdown|When a generator completes, the most progressed one is blocked.
Hex: Plaything|The Cenobite|hex,obsession,oblivious|Hooked Survivors are cursed and Oblivious until they cleanse the totem.
Scourge Hook: Gift of Pain|The Cenobite|scourge,heal|Survivors unhooked from Scourge Hooks suffer penalties until healed.
Grim Embrace|The Artist|gen,slowdown,aura|First hooks on each Survivor block generators; the last reveals the Obsession.
Hex: Pentimento|The Artist|hex,totem,slowdown|Rekindle cleansed totems for stacking penalties.
Scourge Hook: Pain Resonance|The Artist|scourge,gen,slowdown|Hooking on a Scourge Hook damages the most progressed generator.
Call of Brine|The Onryō|gen,slowdown,info|Kicked generators regress faster and reveal bad skill checks.
Merciless Storm|The Onryō|gen,skill-check|Nearly finished generators trigger continuous skill checks.
Scourge Hook: Floods of Rage|The Onryō|scourge,aura|Hooking on a Scourge Hook reveals the other Survivors.
Darkness Revealed|The Dredge|locker,aura|Opening a locker reveals Survivors near lockers.
Dissolution|The Dredge|chase|Fast vaults near you make the next pallet break.
Septic Touch|The Dredge|heal,blind,exhaustion|Survivors who heal in your Terror Radius become Blinded and Exhausted.
Awakened Awareness|The Mastermind|aura,hook|While carrying, see Survivors near you.
Superior Anatomy|The Mastermind|chase|Vault faster after a Survivor fast-vaults near you.
Terminus|The Mastermind|endgame|Injured Survivors become Broken and Hindered near the exit gates.
Nowhere to Hide|The Knight|aura,gen|Kicking a generator reveals nearby Survivors.
Hex: Face the Darkness|The Knight|hex,info|Survivors outside your Terror Radius scream periodically.
Hubris|The Knight|chase,exposed|Survivors who stun you become Exposed.
Game Afoot|The Skull Merchant|obsession,haste|Breaking things while chasing the Obsession grants Haste.
Leverage|The Skull Merchant|heal,hook|Hooking slows healing for all Survivors.
THWACK!|The Skull Merchant|totem,info|Breaking pallets and walls can break a totem and makes Survivors scream.
Genetic Limits|The Singularity|exhaustion,heal|Survivors who finish healing become Exhausted.
Forced Hesitation|The Singularity|chase|Downing a Survivor Hinders nearby Survivors.
Machine Learning|The Singularity|gen,stealth,haste|Compromise a generator; when it completes, gain Haste and Undetectable.
Ultimate Weapon|The Xenomorph|locker,blind,info|Opening a locker makes nearby Survivors scream and become Blinded.
Rapid Brutality|The Xenomorph|chase,haste|Basic attacks grant Haste but you gain no Bloodlust.
Alien Instinct|The Xenomorph|aura,oblivious|Hooking reveals the farthest injured Survivor and makes them Oblivious.
Hex: Two Can Play|The Good Guy|hex,blind|Survivors who blind or stun you get blinded back.
Friends 'til the End|The Good Guy|obsession,exposed|Hooking others makes the Obsession scream and become Exposed.
Batteries Included|The Good Guy|haste,endgame|Gain Haste near completed generators.
Unbound|The Unknown|chase,haste|Vaulting while a Survivor is injured grants Haste.
Undone|The Unknown|gen,slowdown|Missed skill checks give tokens to block and regress generators.
Unforeseen|The Unknown|gen,stealth|Generator regression moves your Terror Radius to it.
Languid Touch|The Lich|exhaustion|Survivors who scream become Exhausted.
Dark Arrogance|The Lich|chase|Faster vaults at the cost of longer stuns.
Weave Attunement|The Lich|item,aura|Dropped items glow and reveal Survivors near them.
Hex: Wretched Fate|The Dark Lord|hex,obsession,slowdown|The Obsession repairs slower until the totem is cleansed.
Human Greed|The Dark Lord|chest,aura|See chests and Survivors near them.
Dominance|The Dark Lord|chest,totem|The first chest a Survivor opens becomes blocked.
All-Shaking Thunder|The Houndmaster|chase|Boosts your lunge for a short time after you drop from a height.
No Quarter|The Houndmaster||
Scourge Hook: Jagged Compass|The Houndmaster|scourge,hook|Turns some hooks into Scourge Hooks at the start of the trial.
Hex: Nothing But Misery|The Ghoul|hex|
Forever Entwined|The Ghoul||
None Are Free|The Ghoul||
Help Wanted|The Animatronic|gen|
Phantom Fear|The Animatronic||
Haywire|The Animatronic||
Ravenous|The Krasue||
Wandering Eye|The Krasue|aura,chase|Reveals nearby Survivors' auras during chases.
Hex: Overture of Doom|The Krasue|hex,gen,aura|Curses the generator farthest from you and reveals its aura.
Turn Back the Clock|The First||
Secret Project|The First||
Hex: Hive Mind|The First|hex|
Hex: Scared to Death|The Slasher|hex|
Silent Shadow|The Slasher|stealth|
Rampage|The Slasher||
Celestial Witness|The Judgment||
Lay Waste|The Judgment|gen,slowdown|Damaging a generator adds extra regression based on its charges.
`;

const SURVIVOR_PERKS = `
Dark Sense|General|aura,gen|See the Killer's aura when a generator is completed.
Déjà Vu|General|aura,gen|See the generators that are closest together.
Hope|General|endgame,haste|Gain Haste once the exit gates are powered.
Kindred|General|aura,hook|While someone is hooked, Survivors see each other and the nearby Killer.
Lightweight|General|stealth|Your scratch marks fade faster.
No One Left Behind|General|endgame,altruism|Faster altruistic actions once the gates are powered.
Plunderer's Instinct|General|chest,aura|See chests and find better items in them.
Premonition|General|info|Warns you when you look toward the Killer.
Resilience|General|chase|Faster actions while injured.
Slippery Meat|General|hook|More and better self-unhook attempts.
Small Game|General|totem,info|Warns you when you look toward a totem.
Spine Chill|General|info|Warns you when the Killer is looking your way.
This Is Not Happening|General|skill-check,heal|Bigger great skill check bonus while injured.
We'll Make It|General|heal,altruism|Heal others faster after an unhook.
Bond|Dwight Fairfield|aura,altruism|See the auras of nearby allies.
Prove Thyself|Dwight Fairfield|gen|Faster repairs when others are working nearby.
Leader|Dwight Fairfield|altruism|Speeds up the actions of nearby Survivors.
Quick & Quiet|Meg Thomas|stealth|Fast vaults and locker entries make no noise.
Sprint Burst|Meg Thomas|exhaustion,chase|Sprint when you start running.
Adrenaline|Meg Thomas|exhaustion,endgame,heal|Heal one state and sprint when the exit gates are powered.
Empathy|Claudette Morel|aura,heal|See the auras of injured and dying Survivors.
Botany Knowledge|Claudette Morel|heal|Heal faster.
Self-Care|Claudette Morel|heal|Heal yourself without a Med-Kit.
Calm Spirit|Jake Park|stealth|Crows stay calmer and you can suppress screams.
Iron Will|Jake Park|stealth|Your grunts of pain are silenced.
Saboteur|Jake Park|hook|See hooks near a carried Survivor and sabotage without a toolbox.
Balanced Landing|Nea Karlsson|exhaustion,chase|Sprint after falling with no stagger.
Urban Evasion|Nea Karlsson|stealth|Crouch-walk faster.
Streetwise|Nea Karlsson|item|Your items and nearby allies' items last longer.
Decisive Strike|Laurie Strode|anti-tunnel,second-chance|Stun the Killer if picked up soon after being unhooked.
Object of Obsession|Laurie Strode|aura,obsession|Share auras with the Killer when they look at you.
Sole Survivor|Laurie Strode|stealth,aura|Your aura is hidden as allies die.
Open-Handed|Ace Visconti|aura|Increases aura-reading ranges for the team.
Up the Ante|Ace Visconti|endgame|Luck bonus for others based on Survivors still alive.
Ace in the Hole|Ace Visconti|chest,item|Items from chests come with add-ons.
Left Behind|William "Bill" Overbeck|endgame,aura|See the hatch when you're the last Survivor.
Borrowed Time|William "Bill" Overbeck|anti-tunnel,protection|Survivors you unhook gain Endurance.
Unbreakable|William "Bill" Overbeck|second-chance|Recover from the dying state once.
Alert|Feng Min|aura|See the Killer's aura when they break things.
Lithe|Feng Min|exhaustion,chase|Sprint after a fast vault.
Technician|Feng Min|gen|Failed skill checks are quieter and less punishing.
We're Gonna Live Forever|David King|altruism,heal|Rewards protecting allies; heal dying Survivors faster.
Dead Hard|David King|exhaustion,second-chance|Gain Endurance on demand while injured.
No Mither|David King|chase|Always injured but leave no blood and can recover yourself.
Wake Up!|Quentin Smith|endgame,aura|See exit gates and open them faster.
Pharmacy|Quentin Smith|chest,heal|Open chests faster and get a Med-Kit.
Vigil|Quentin Smith|exhaustion|Recover from status effects faster.
Tenacity|Detective Tapp|stealth|Crawl faster and quietly while dying.
Detective's Hunch|Detective Tapp|aura|See generators, chests and totems after a generator completes.
Stake Out|Detective Tapp|skill-check|Tokens turn good skill checks into great ones.
Dance With Me|Kate Denson|stealth|Leave no scratch marks after fast actions.
Windows of Opportunity|Kate Denson|aura,chase|See pallets, windows and breakable walls.
Boil Over|Kate Denson|hook,aura|Harder to carry and hides hook auras from the Killer.
Diversion|Adam Francis|stealth|Throw a pebble to create a noise distraction.
Deliverance|Adam Francis|hook,second-chance|Unhook yourself after a safe unhook.
Autodidact|Adam Francis|heal,skill-check|Healing skill checks get more rewarding.
Breakdown|Jeff Johansen|hook,aura|Your hook breaks when you're unhooked and reveals the Killer.
Aftercare|Jeff Johansen|aura|Share auras with Survivors you've helped.
Distortion|Jeff Johansen|stealth,aura|Tokens block the Killer's aura reading on you.
Solidarity|Jane Romero|heal|Heal yourself while healing others.
Poised|Jane Romero|stealth|No scratch marks after a generator is completed.
Head On|Jane Romero|locker,chase|Stun the Killer when jumping out of a locker.
Flip-Flop|Ash Williams|second-chance|Converts recovery progress into wiggle progress.
Buckle Up|Ash Williams|aura,heal|See auras after healing a dying ally.
Mettle of Man|Ash Williams|protection,obsession|Absorb a hit after taking protection hits.
Better Together|Nancy Wheeler|aura,gen|Share your generator's aura; see allies when someone goes down.
Fixated|Nancy Wheeler|stealth|Walk faster and see your own scratch marks.
Inner Strength|Nancy Wheeler|totem,heal,locker|Cleanse a totem, then heal yourself in a locker.
Babysitter|Steve Harrington|altruism,anti-tunnel|Survivors you unhook leave no marks or blood.
Camaraderie|Steve Harrington|hook|Pauses hook progress when another Survivor is nearby.
Second Wind|Steve Harrington|heal|Get healed automatically after unhooking someone.
Lucky Break|Yui Kimura|stealth,heal|Leave no blood while injured for a while.
Any Means Necessary|Yui Kimura|chase|Reset dropped pallets.
Breakout|Yui Kimura|altruism,haste|Allies near a carried Survivor gain Haste.
For the People|Zarina Kassir|altruism,heal|Instantly heal an ally by becoming Broken.
Off the Record|Zarina Kassir|anti-tunnel,stealth|Hides your aura and grunts after an unhook.
Red Herring|Zarina Kassir|stealth,info|A generator alerts the Killer when you enter a locker.
Soul Guard|Cheryl Mason|second-chance,heal|Endurance after being healed or recovering.
Blood Pact|Cheryl Mason|aura,haste|Share auras with the Obsession and gain Haste.
Repressed Alliance|Cheryl Mason|gen|Block a generator for a short time.
Visionary|Felix Richter|aura,gen|See the auras of generators.
Desperate Measures|Felix Richter|heal,altruism|Faster healing and unhooking for each injured ally.
Built to Last|Felix Richter|item|Refill your item while hiding in a locker.
Appraisal|Élodie Rakoto|chest|Search chests faster and more times.
Deception|Élodie Rakoto|stealth,locker|Fake a locker entry to throw off the Killer.
Power Struggle|Élodie Rakoto|second-chance|Stun the Killer with a pallet while being carried.
Fast Track|Yun-Jin Lee|gen,skill-check|Great skill checks gain bonus progress after allies are hooked.
Smash Hit|Yun-Jin Lee|exhaustion,chase|Sprint after stunning the Killer with a pallet.
Self-Preservation|Yun-Jin Lee|stealth|Hide your scratch marks when an ally is hit nearby.
Counterforce|Jill Valentine|totem,aura|Cleanse totems faster and see the farthest totem.
Resurgence|Jill Valentine|heal|Gain healing progress after being unhooked.
Blast Mine|Jill Valentine|gen,blind|Trap a repaired generator to blind the Killer.
Flashbang|Leon S. Kennedy|blind,locker|Craft a flashbang in a locker after repairing.
Rookie Spirit|Leon S. Kennedy|gen,aura|See regressing generators.
Bite the Bullet|Leon S. Kennedy|heal,stealth|Heal silently without failing.
Clairvoyance|Mikaela Reid|totem,aura|Cleanse a totem to see gates, hatch, generators and chests.
Boon: Circle of Healing|Mikaela Reid|boon,heal|Survivors in range heal faster.
Boon: Shadow Step|Mikaela Reid|boon,stealth|Hides scratch marks and auras in range.
Overcome|Jonah Vasquez|exhaustion,chase|Longer speed burst after getting hit.
Corrective Action|Jonah Vasquez|skill-check|Turn allies' good skill checks into great ones.
Boon: Exponential|Jonah Vasquez|boon,second-chance|Recover fully and faster in range.
Parental Guidance|Yoichi Asakawa|stealth|Hide scratch marks after stunning the Killer.
Empathic Connection|Yoichi Asakawa|aura,heal|Injured allies see your aura and you heal faster.
Boon: Dark Theory|Yoichi Asakawa|boon,haste|Survivors in range gain Haste.
Inner Focus|Haddie Kaur|aura,info|See other Survivors' scratch marks; reveals the Killer when allies are hit.
Residual Manifest|Haddie Kaur|blind|Blinding the Killer applies Blindness to them.
Overzealous|Haddie Kaur|totem,gen|Faster repairs after cleansing a totem.
Wiretap|Ada Wong|gen,aura|Trap a generator to reveal the Killer near it.
Reactive Healing|Ada Wong|heal|Gain healing progress when allies are hit nearby.
Low Profile|Ada Wong|stealth,endgame|Hide scratch marks and blood when you're last alive.
Better Than New|Rebecca Chambers|heal|Survivors you heal get faster actions.
Reassurance|Rebecca Chambers|hook,altruism|Pause an ally's hook timer from a distance.
Hyperfocus|Rebecca Chambers|skill-check|Consecutive great skill checks grow in value.
Quick Gambit|Vittorio Toscano|gen,chase|Repair bonus for allies while you're chased nearby.
Fogwise|Vittorio Toscano|aura,skill-check|Great skill checks reveal the Killer's aura.
Potential Energy|Vittorio Toscano|gen|Store repair progress as tokens and spend them later.
Cut Loose|Thalita Lyra|chase|Consecutive fast vaults are silent.
Friendly Competition|Thalita Lyra|gen,haste|Gain Haste after finishing a generator with an ally.
Teamwork: Power of Two|Thalita Lyra|altruism,haste|You and an ally gain Haste after a heal.
Background Player|Renato Lyra|chase,haste|Sprint after an ally is picked up.
Blood Rush|Renato Lyra|hook,second-chance|Get a burst of help when you're one hook from death.
Teamwork: Collective Stealth|Renato Lyra|stealth|You and an ally leave no scratch marks after a heal.
Made for This|Gabriel Soma|heal,haste|Gain Haste while injured after healing someone.
Scavenger|Gabriel Soma|item,gen|Great skill checks can earn you a toolbox.
Troubleshooter|Gabriel Soma|aura,chase|See the Killer and nearby breakables when chased off a generator.
Dramaturgy|Nicolas Cage|exhaustion|Sprint and get a random effect.
Scene Partner|Nicolas Cage|aura|Screaming when you see the Killer reveals their aura.
Plot Twist|Nicolas Cage|second-chance,stealth|Down yourself silently, then recover and heal.
Lucky Star|Ellen Ripley|locker,aura|Hide in a locker without leaving marks and see a generator and allies.
Chemical Trap|Ellen Ripley|chase|Trap a pallet to Hinder the Killer.
Light-Footed|Ellen Ripley|stealth|Silent running footsteps while healthy.
Champion of Light|Alan Wake|blind|Using a flashlight slows you less and blinds better.
Boon: Illumination|Alan Wake|boon,aura|See chests in range, lit by blue light.
Deadline|Alan Wake|skill-check|Skill checks move around while injured but speed you up.
Invocation: Weaving Spiders|Sable Ward|gen|Perform an invocation in the basement to speed up repairs at a cost.
Strength in Shadows|Sable Ward|heal|Heal yourself in the basement.
Wicked|Sable Ward|hook|Bonuses tied to basement hooks.
Bardic Inspiration|Aestri Yazar|altruism,skill-check|Perform to give allies skill check bonuses.
Mirrored Illusion|Aestri Yazar|stealth|Create an illusion of yourself.
Still Sight|Aestri Yazar|aura|Stand still to see the Killer and generators.
Finesse|Lara Croft|chase|Fast-vault faster while healthy.
Hardened|Lara Croft|aura|Screaming reveals the Killer's aura.
Specialist|Lara Croft|gen,chest|Earn tokens from chests and skill checks to speed up a generator.
Exultation|Trevor Belmont|chase|Bonuses for stunning the Killer.
Moment of Glory|Trevor Belmont|chase|A moment of power after being hit.
Eyes of Belmont|Trevor Belmont|aura|Extends aura reading for the team.
Clean Break|Taurie Cain|heal|
Invocation: Treacherous Crows|Taurie Cain||
Shoulder the Burden|Taurie Cain|hook,altruism|Take on another Survivor's hook state when you unhook them.
Do No Harm|Orela Rose|heal|Heal others faster for each hook state they have.
Duty of Care|Orela Rose|haste,protection|
Rapid Response|Orela Rose||
Apocalyptic Ingenuity|Rick Grimes|chest,chase|After searching chests, turn a broken pallet into a fragile one.
Come and Get Me!|Rick Grimes||
Teamwork: Toughen Up|Rick Grimes|altruism|
Conviction|Michonne Grimes||
Last Stand|Michonne Grimes||
Teamwork: Throw Down|Michonne Grimes|altruism|
Road Life|Vee Boonyasak||
One-Two-Three-Four!|Vee Boonyasak||
Extrasensory Perception|Eleven|aura|See the auras of things around you.
We See You|Eleven|aura|Show the Killer's aura to your teammates.
Teamwork: Soft-Spoken|Eleven|gen,stealth|Helps the team repair generators quickly and quietly.
Bada Bada Boom|Dustin Henderson||
Change of Plan|Dustin Henderson|item|Change a toolbox into a Med-Kit.
Teamwork: Full Circuit|Dustin Henderson|altruism|
A Place For Us|Kwon Tae-young|heal|You and the Survivor you heal both gain Elusive.
Flow State|Kwon Tae-young|totem|Completed generators give tokens that speed up totem actions.
Five Moves Ahead|Kwon Tae-young||
Wide Open Throttle|Shane Wiigwaas|haste,chase|Gain Haste after fast-vaulting a pallet.
Lend a Hand|Shane Wiigwaas|heal|Give a Survivor you heal extra healing charges.
Boon: Steadfast|Aurora Stardotter|boon,gen|Slows generator regression in range.
Fruits of Your Labor|Aurora Stardotter|gen|Gain tokens as you complete generators.
`;

const ITEMS = [
  { type: 'Flashlight', variants: ['Flashlight', 'Sport Flashlight', 'Utility Flashlight'],
    addons: ['Battery', 'Leather Grip', 'Wide Lens', 'Power Bulb', 'Focus Lens', 'Heavy Duty Battery', 'Low Amp Filament', 'Rubber Grip', 'TIR Optic', 'Long Life Battery', 'High-End Sapphire Lens', 'Odd Bulb', 'Intense Halogen'] },
  { type: 'Toolbox', variants: ['Worn-Out Tools', 'Toolbox', "Mechanic's Toolbox", 'Commodious Toolbox', "Alex's Toolbox", "Engineer's Toolbox"],
    addons: ['Clean Rag', 'Instructions', 'Scraps', 'Spool of Wire', 'Cutting Wire', 'Socket Swivels', 'Protective Gloves', 'Hacksaw', 'Grip Wrench', 'Wire Spool', 'Brand New Part'] },
  { type: 'Med-Kit', variants: ['Camping Aid Kit', 'First Aid Kit', 'Emergency Med-Kit', 'Ranger Med-Kit'],
    addons: ['Bandages', 'Butterfly Tape', 'Rubber Gloves', 'Needle & Thread', 'Self Adherent Wrap', 'Sponge', 'Surgical Suture', 'Gauze Roll', 'Gel Dressings', 'Medical Scissors', 'Abdominal Dressing', 'Refined Serum', 'Anti-Haemorrhagic Syringe', 'Styptic Agent'] },
  { type: 'Map', variants: ['Map', 'Rainbow Map'],
    addons: ['Map Addendum', 'Yellow Wire', 'Unusual Stamp', 'Red Twine', 'Black Silk Cord', 'Retardant Jelly', 'Glass Bead', 'Odd Stamp', 'Crystal Bead'] },
  { type: 'Key', variants: ['Broken Key', 'Dull Key', 'Skeleton Key'],
    addons: ['Prayer Rope', 'Eroded Token', 'Gold Token', 'Weaved Ring', 'Blood Amber', 'Unique Wedding Ring'] },
];

const OFFERINGS = {
  shared: ['Bloody Party Streamers', 'Escape! Cake', 'Clear Reagent', 'Faint Reagent', 'Hazy Reagent', 'Murky Reagent',
    'Bound Envelope', 'Annotated Blueprint', 'Black Ward', 'Sacrificial Cake'],
  survivor: ['Bog Laurel Sachet', 'Fresh Bog Laurel', 'Fragrant Bog Laurel', 'Primrose Blossom Sachet', 'Sweet William Sachet',
    'Chalk Pouch', 'Cream Chalk Pouch', 'Ivory Chalk Pouch', 'Salt Pouch', 'Black Salt Statuette', "Vigo's Jar of Salty Lips",
    'Petrified Oak', 'Shroud of Union', 'Shroud of Separation', 'Shroud of Binding', "Vigo's Shroud", 'White Ward'],
  killer: ['Tanager Wreath', 'Shrike Wreath', 'Raven Wreath', 'Crow Wreath', 'Survivor Pudding', 'Cut Coin', 'Hollow Shell',
    'Rotten Oak', 'Putrid Oak', 'Ivory Memento Mori', 'Cypress Memento Mori', 'Ebony Memento Mori', 'Moldy Oak'],
};

const REALMS = ['The MacMillan Estate', 'Autohaven Wreckers', 'Coldwind Farm', 'Crotus Prenn Asylum', 'Haddonfield',
  'Backwater Swamp', "Léry's Memorial Institute", 'Red Forest', 'Springwood', 'Gideon Meat Plant', 'Yamaoka Estate',
  'Ormond', 'Hawkins National Laboratory', 'Grave of Glenvale', 'Silent Hill', 'Raccoon City', 'Forsaken Boneyard',
  'Withered Isle', 'The Decimated Borgo', 'Dvarka Deepwood'];

const ADDON_RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Ultra Rare'];

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parsePerks(text, role) {
  return text.trim().split('\n').map((line) => {
    const [name, owner, tags, desc] = line.split('|');
    return { id: slug(name), name, role, owner, tags: (tags || '').split(',').filter(Boolean), desc: desc || '' };
  });
}

function buildBaseData() {
  const perks = [...parsePerks(KILLER_PERKS, 'killer'), ...parsePerks(SURVIVOR_PERKS, 'survivor')];
  const perksOf = (owner) => perks.filter((p) => p.owner === owner).map((p) => p.id);
  return {
    version: DATA_VERSION,
    killers: KILLERS.map(([name, power, chapter]) => ({ id: slug(name), name, power, chapter, perks: perksOf(name), addons: [] })),
    survivors: SURVIVORS.map(([name, chapter]) => ({ id: slug(name), name, chapter, perks: perksOf(name) })),
    perks,
    items: ITEMS,
    offerings: OFFERINGS,
    realms: REALMS,
    addonRarities: ADDON_RARITIES,
    presets: PRESETS.map(([role, name, character, perks, note, credit]) => ({
      id: `preset-${slug(name)}`, role, name, characterId: character ? slug(character) : null, perks: perks.map(slug), notes: note, credit,
    })),
  };
}

module.exports = { buildBaseData, slug };
