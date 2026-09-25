// Upgrade trees: every turret has 3 themed branches × 5 tiers.
// A turret can buy MAX_UPGRADES (10) nodes in total, tiers in order, and only ONE branch may go past tier 3
// (tier 5 is the branch's signature ability). Effects (fx) are additive modifiers, see statsFor() in main.js:
//   dmg rate range splash chain slow stun burn pierce crit shots heat weakMul manualDmg detect shred
//   bounty homing execute bossDmg cluster napalm freeze shatter ramp beams steady

const B = (name, color, nodes) => ({ name, color, nodes: nodes.map(([n, d, fx]) => ({ name: n, desc: d, fx })) });

export const TREES = {
  cannon: [
    B('Heavy Shells', '#ff9a3a', [
      ['Dense Core', '+25% damage', { dmg: 0.25 }],
      ['Tungsten Tips', '+30% damage', { dmg: 0.3 }],
      ['HE Rounds', 'Shells explode (1.2 m splash)', { splash: 1.2 }],
      ['Armor Breaker', 'Hits shred armor (+25% damage taken)', { shred: 1 }],
      ['Doomsday Shells', '+80% damage, bigger blast, 25% stun', { dmg: 0.8, splash: 0.8, stun: 0.25 }],
    ]),
    B('Autoloader', '#ffd24a', [
      ['Quick Breech', '+15% fire rate', { rate: 0.15 }],
      ['Belt Feed', '+20% fire rate', { rate: 0.2 }],
      ['Coolant Jacket', '−20% barrel heat', { heat: 0.2 }],
      ['Third Barrel', '+1 shell per volley', { shots: 1 }],
      ['Quad Battery', '+2 shells, +25% fire rate', { shots: 2, rate: 0.25 }],
    ]),
    B('Fire Control', '#5fd8ff', [
      ['Rangefinder', '+12% range', { range: 0.12 }],
      ['Ballistic Computer', '+10% crit chance (×2)', { crit: 0.1 }],
      ['Thermal Optics', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Weak-Spot Tracker', 'Weak points +0.5×', { weakMul: 0.5 }],
      ['Ace Gunner', 'Manual damage +60%, +20% crit', { manualDmg: 0.6, crit: 0.2 }],
    ]),
  ],
  gatling: [
    B('Barrel Spin', '#46d46a', [
      ['Greased Bearings', '+15% fire rate', { rate: 0.15 }],
      ['Twin Motors', '+20% fire rate', { rate: 0.2 }],
      ['Air Cooling', '−25% barrel heat', { heat: 0.25 }],
      ['Double Feed', '+1 bullet per shot', { shots: 1 }],
      ['Overdrive', '+50% fire rate, +1 bullet', { rate: 0.5, shots: 1 }],
    ]),
    B('AP Rounds', '#ff9a3a', [
      ['Steel Core', '+25% damage', { dmg: 0.25 }],
      ['Penetrator', 'Bullets pierce 1 enemy', { pierce: 1 }],
      ['Shredder', 'Hits shred armor', { shred: 1 }],
      ['Hardened Tips', '+40% damage', { dmg: 0.4 }],
      ['Depleted Uranium', '+80% damage, pierce 2 more', { dmg: 0.8, pierce: 2 }],
    ]),
    B('Targeting', '#5fd8ff', [
      ['Long Barrels', '+15% range', { range: 0.15 }],
      ['Motion Tracker', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Lucky Rounds', '+10% crit chance', { crit: 0.1 }],
      ['Scavenger', '+2 gold per kill', { bounty: 2 }],
      ['Gold Rush', '+5 more gold per kill, +15% crit', { bounty: 5, crit: 0.15 }],
    ]),
  ],
  sniper: [
    B('Caliber', '#ff9a3a', [
      ['Magnum Load', '+30% damage', { dmg: 0.3 }],
      ['.50 Cal', '+40% damage', { dmg: 0.4 }],
      ['Overpenetration', 'Pierces 1 enemy', { pierce: 1 }],
      ['AP Tungsten', 'Hits shred armor', { shred: 1 }],
      ['Anti-Materiel', '+100% damage, pierce 2 more', { dmg: 1.0, pierce: 2 }],
    ]),
    B('Marksman', '#ffd24a', [
      ['Match Grade', 'Weak points +0.5×', { weakMul: 0.5 }],
      ['Trigger Discipline', '+15% crit chance', { crit: 0.15 }],
      ['Steady Hands', '−40% scope sway', { steady: 0.4 }],
      ['Hollow Point', 'Weak points +0.75×', { weakMul: 0.75 }],
      ['Deadeye', 'Executes non-boss enemies below 25% HP', { execute: 0.25 }],
    ]),
    B('Bolt Action', '#5fd8ff', [
      ['Smooth Bolt', '+20% fire rate', { rate: 0.2 }],
      ['Stripper Clips', '+25% fire rate', { rate: 0.25 }],
      ['Suppressor', '−25% barrel heat, detects Phantoms', { heat: 0.25, detect: 1 }],
      ['Contract Pay', '+3 gold per kill', { bounty: 3 }],
      ['Mercenary', '+8 gold per kill, +30% fire rate', { bounty: 8, rate: 0.3 }],
    ]),
  ],
  cryo: [
    B('Deep Chill', '#8fe3ff', [
      ['Frost Coating', '+15% slow', { slow: 0.15 }],
      ['Cold Snap', '+15% slow', { slow: 0.15 }],
      ['Flash Freeze', '10% chance to freeze solid', { freeze: 0.1 }],
      ['Permafrost', '+15% freeze chance', { freeze: 0.15 }],
      ['Absolute Zero', '+35% freeze chance, frozen take ×1.5', { freeze: 0.35, shatter: 1 }],
    ]),
    B('Ice Shards', '#5fd8ff', [
      ['Sharpened Ice', '+30% damage', { dmg: 0.3 }],
      ['Spearhead', 'Shards pierce 1 enemy', { pierce: 1 }],
      ['Crystal Lattice', '+40% damage', { dmg: 0.4 }],
      ['Shatter', 'Frozen/stunned take ×1.5', { shatter: 1 }],
      ['Glacier Spike', '+100% damage, pierce 2 more', { dmg: 1.0, pierce: 2 }],
    ]),
    B('Blizzard', '#ffffff', [
      ['Frost Burst', 'Shards burst (1.5 m slow splash)', { splash: 1.5 }],
      ['Long Lance', '+15% range', { range: 0.15 }],
      ['Frost Sight', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Hailstorm', '+1 m splash, +20% fire rate', { splash: 1, rate: 0.2 }],
      ['Whiteout', '+50% fire rate, +1 m splash', { rate: 0.5, splash: 1 }],
    ]),
  ],
  flame: [
    B('Fuel Mix', '#ff7a1a', [
      ['Sticky Fuel', '+6 burn/s', { burn: 6 }],
      ['Accelerant', '+8 burn/s', { burn: 8 }],
      ['Extended Nozzle', '+15% range', { range: 0.15 }],
      ['White Phosphorus', '+12 burn/s', { burn: 12 }],
      ['Napalm', 'Leaves burning ground behind', { napalm: 1, burn: 6 }],
    ]),
    B('Pressure', '#ffd24a', [
      ['High Pressure', '+25% damage', { dmg: 0.25 }],
      ['Wide Nozzle', '+30% damage', { dmg: 0.3 }],
      ['Turbo Pump', '+10% range', { range: 0.1 }],
      ['Plasma Mix', '+40% damage', { dmg: 0.4 }],
      ["Dragon's Breath", '+80% damage, +20% range', { dmg: 0.8, range: 0.2 }],
    ]),
    B('Chemical', '#8fe04a', [
      ['Corrosive Gel', 'Hits shred armor', { shred: 1 }],
      ['Choking Smoke', '+20% slow', { slow: 0.2 }],
      ['Heat Sensor', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Salvage', '+2 gold per kill', { bounty: 2 }],
      ['Acid Cloud', '+30% slow, stronger shred', { slow: 0.3, shred: 1 }],
    ]),
  ],
  rocket: [
    B('Warheads', '#ff4a3a', [
      ['Bigger Charge', '+25% damage', { dmg: 0.25 }],
      ['Wide Blast', '+0.8 m splash', { splash: 0.8 }],
      ['Shaped Charge', '+30% damage', { dmg: 0.3 }],
      ['Incendiary', 'Blasts burn (+8/s)', { burn: 8 }],
      ['Cluster Payload', 'Each blast scatters 4 bomblets', { cluster: 4 }],
    ]),
    B('Launch Rack', '#ffd24a', [
      ['Fast Reload', '+15% fire rate', { rate: 0.15 }],
      ['Extra Tube', '+1 rocket per salvo', { shots: 1 }],
      ['Auto Loader', '+20% fire rate', { rate: 0.2 }],
      ['Smart Fins', 'Much better homing', { homing: 2 }],
      ['Swarm', '+3 rockets per salvo', { shots: 3 }],
    ]),
    B('Seeker', '#5fd8ff', [
      ['Long Burn Motor', '+15% range', { range: 0.15 }],
      ['IR Seeker', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Concussion', '10% stun chance', { stun: 0.1 }],
      ['Tandem Charge', 'Hits shred armor', { shred: 1 }],
      ['Bunker Buster', '+100% damage vs bosses', { bossDmg: 1.0 }],
    ]),
  ],
  mortar: [
    B('Shells', '#b0a070', [
      ['Heavy Shell', '+25% damage', { dmg: 0.25 }],
      ['Big Blast', '+0.8 m splash', { splash: 0.8 }],
      ['HE Filler', '+35% damage', { dmg: 0.35 }],
      ['Thermite', 'Blasts burn (+8/s)', { burn: 8 }],
      ['Big Bertha', '+100% damage, +1.5 m splash', { dmg: 1.0, splash: 1.5 }],
    ]),
    B('Crew Drill', '#ffd24a', [
      ['Drilled Crew', '+20% fire rate', { rate: 0.2 }],
      ['Ready Rack', '+25% fire rate', { rate: 0.25 }],
      ['Second Tube', '+1 shell per volley', { shots: 1 }],
      ['Veteran Crew', '+25% fire rate', { rate: 0.25 }],
      ['Carpet Bomb', '+2 shells per volley', { shots: 2 }],
    ]),
    B('Spotter', '#5fd8ff', [
      ['Forward Observer', '+15% range', { range: 0.15 }],
      ['Concussive', '15% stun chance', { stun: 0.15 }],
      ['Fragmentation', 'Hits shred armor', { shred: 1 }],
      ['Drone Spotter', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Shockwave', '40% stun chance', { stun: 0.4 }],
    ]),
  ],
  tesla: [
    B('Arc', '#b46bff', [
      ['Conductor', '+1 chain', { chain: 1 }],
      ['Forked Bolt', '+1 chain', { chain: 1 }],
      ['High Voltage', '+30% damage', { dmg: 0.3 }],
      ['Chain Reaction', '+2 chains', { chain: 2 }],
      ['Storm', '+3 chains, 30% stun', { chain: 3, stun: 0.3 }],
    ]),
    B('Capacitor', '#ffd24a', [
      ['Bigger Bank', '+25% damage', { dmg: 0.25 }],
      ['Fast Discharge', '+20% fire rate', { rate: 0.2 }],
      ['Supercap', '+35% damage', { dmg: 0.35 }],
      ['Overclock', '+25% fire rate', { rate: 0.25 }],
      ['Overload', '+100% damage', { dmg: 1.0 }],
    ]),
    B('Field', '#5fd8ff', [
      ['Wide Coil', '+15% range', { range: 0.15 }],
      ['Static Field', '+20% slow', { slow: 0.2 }],
      ['Radar Coil', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Paralysis', '+25% slow', { slow: 0.25 }],
      ['Stasis', '35% stun chance, +30% slow', { stun: 0.35, slow: 0.3 }],
    ]),
  ],
  laser: [
    B('Focus', '#ff3d7f', [
      ['Focusing Lens', '+50% max ramp', { ramp: 0.5 }],
      ['Hot Beam', '+30% damage', { dmg: 0.3 }],
      ['Resonator', '+50% max ramp', { ramp: 0.5 }],
      ['Ruby Core', '+40% damage', { dmg: 0.4 }],
      ['Solar Lance', '+100% damage, +100% max ramp', { dmg: 1.0, ramp: 1.0 }],
    ]),
    B('Prism', '#ffd24a', [
      ['Beam Splitter', '+1 extra target', { beams: 1 }],
      ['Long Focus', '+15% range', { range: 0.15 }],
      ['Second Prism', '+1 extra target', { beams: 1 }],
      ['Burn Through', 'Hits shred armor', { shred: 1 }],
      ['Refractor', '+2 extra targets', { beams: 2 }],
    ]),
    B('Thermal', '#ff9a3a', [
      ['Scorch', '+5 burn/s', { burn: 5 }],
      ['Heat Exchanger', '−30% barrel heat', { heat: 0.3 }],
      ['Thermal Scope', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Incinerate', '+10 burn/s', { burn: 10 }],
      ['Melt', 'Executes non-boss enemies below 12% HP', { execute: 0.12, burn: 5 }],
    ]),
  ],
  rail: [
    B('Coil Power', '#4fc3ff', [
      ['Stronger Coils', '+30% damage', { dmg: 0.3 }],
      ['Superconductors', '+35% damage', { dmg: 0.35 }],
      ['Shred Field', 'Hits shred armor', { shred: 1 }],
      ['Mag Boost', '+50% damage', { dmg: 0.5 }],
      ['Overcharge', '+120% damage', { dmg: 1.2 }],
    ]),
    B('Cycling', '#ffd24a', [
      ['Fast Capacitors', '+20% fire rate', { rate: 0.2 }],
      ['Dual Bank', '+25% fire rate', { rate: 0.25 }],
      ['Cryo Rails', '−25% barrel heat', { heat: 0.25 }],
      ['Rapid Cycle', '+30% fire rate', { rate: 0.3 }],
      ['Hypercycle', '+60% fire rate', { rate: 0.6 }],
    ]),
    B('Optics', '#ff9a3a', [
      ['Long Rails', '+15% range', { range: 0.15 }],
      ['Quantum Sight', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Target Lock', '+15% crit chance', { crit: 0.15 }],
      ['Weak-Spot Solver', 'Weak points +0.75×', { weakMul: 0.75 }],
      ['Singularity', 'Executes below 15% HP, +50% vs bosses', { execute: 0.15, bossDmg: 0.5 }],
    ]),
  ],
  scatter: [
    B('Buckshot', '#ffa05a', [
      ['Heavy Pellets', '+25% damage', { dmg: 0.25 }],
      ['Extra Pellets', '+2 pellets', { shots: 2 }],
      ['Magnum Shells', '+30% damage', { dmg: 0.3 }],
      ['Flechettes', 'Pellets pierce 1 enemy', { pierce: 1 }],
      ['Dragon Breath', '+3 pellets, burning shot', { shots: 3, burn: 10 }],
    ]),
    B('Pump Action', '#ffd24a', [
      ['Slick Pump', '+15% fire rate', { rate: 0.15 }],
      ['Tube Mag', '+20% fire rate', { rate: 0.2 }],
      ['Cooled Barrel', '−25% barrel heat', { heat: 0.25 }],
      ['Tight Choke', '+15% range', { range: 0.15 }],
      ['Auto Shotgun', '+50% fire rate', { rate: 0.5 }],
    ]),
    B('Street Sweeper', '#5fd8ff', [
      ['Slug Round', '+10% crit chance', { crit: 0.1 }],
      ['Thermal Sight', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Knockdown', '12% stun chance', { stun: 0.12 }],
      ['Scrap Collector', '+2 gold per kill', { bounty: 2 }],
      ['Executioner', 'Executes non-boss enemies below 20% HP', { execute: 0.2 }],
    ]),
  ],
  venom: [
    B('Toxin', '#7fe04a', [
      ['Potent Mix', '+6 poison/s', { burn: 6 }],
      ['Neurotoxin', '+15% slow', { slow: 0.15 }],
      ['Concentrate', '+8 poison/s', { burn: 8 }],
      ['Corrosion', 'Hits shred armor', { shred: 1 }],
      ['Plague Bearer', '+14 poison/s, globs splash 1.5 m', { burn: 14, splash: 1.5 }],
    ]),
    B('Pressure', '#ffd24a', [
      ['Bigger Globs', '+30% damage', { dmg: 0.3 }],
      ['Fast Pump', '+20% fire rate', { rate: 0.2 }],
      ['Long Hose', '+15% range', { range: 0.15 }],
      ['Twin Nozzle', '+1 glob per shot', { shots: 1 }],
      ['Geyser', '+50% fire rate, +1 glob', { rate: 0.5, shots: 1 }],
    ]),
    B('Swamp Lore', '#b46bff', [
      ['Scent Tracker', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Bog Tar', '+15% slow', { slow: 0.15 }],
      ['Spore Burst', 'Globs splash 1 m', { splash: 1 }],
      ['Harvest', '+2 gold per kill', { bounty: 2 }],
      ['Death Bloom', 'Executes below 15% HP', { execute: 0.15 }],
    ]),
  ],
  minelayer: [
    B('Charge', '#7affd8', [
      ['Hot Coils', '+25% damage', { dmg: 0.25 }],
      ['Arc Jumper', 'Lightning jumps to +1 enemy', { chain: 1 }],
      ['Capacitor Bank', '+35% damage', { dmg: 0.35 }],
      ['Overload Stun', '+0.4 s stun', { stun: 0.4 }],
      ['Thunderhead', '+60% damage, jumps to +2 enemies', { dmg: 0.6, chain: 2 }],
    ]),
    B('Minefield', '#ffd24a', [
      ['Quick Arm', '+20% laying speed', { rate: 0.2 }],
      ['Bigger Rack', '+1 mine at once', { shots: 1 }],
      ['Long Throw', '+15% range', { range: 0.15 }],
      ['Double Drop', 'Lays 2 mines per throw', { shots: 1, rate: 0.15 }],
      ['Carpet of Mines', '+2 mines at once, +25% laying speed', { shots: 2, rate: 0.25 }],
    ]),
    B('Sensors', '#5fd8ff', [
      ['Proximity Fuse', 'Weak points +0.3×', { weakMul: 0.3 }],
      ['Ground Radar', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Shrapnel Casing', 'Blasts shred armor (+25% damage taken)', { shred: 1 }],
      ['Salvage', '+2 gold per kill', { bounty: 2 }],
      ['Chain Reaction', 'Executes enemies below 15% HP', { execute: 0.15 }],
    ]),
  ],
  bouncer: [
    B('Explosives', '#c8a040', [
      ['Bigger Charge', '+25% damage', { dmg: 0.25 }],
      ['Wide Blast', '+0.6 m splash', { splash: 0.6 }],
      ['Frag Casing', 'Hits shred armor', { shred: 1 }],
      ['HE Grenades', '+40% damage', { dmg: 0.4 }],
      ['Cluster Grenades', 'Each blast scatters 3 bomblets', { cluster: 3 }],
    ]),
    B('Launcher', '#ffd24a', [
      ['Quick Reload', '+20% fire rate', { rate: 0.2 }],
      ['Drum Magazine', '+25% fire rate', { rate: 0.25 }],
      ['Double Launch', '+1 grenade', { shots: 1 }],
      ['Long Tube', '+15% range', { range: 0.15 }],
      ['Grenade Storm', '+2 grenades', { shots: 2 }],
    ]),
    B('Specials', '#5fd8ff', [
      ['Concussion', '12% stun chance', { stun: 0.12 }],
      ['Incendiary', 'Blasts burn (+8/s)', { burn: 8 }],
      ['Sticky Bomb', '+15% slow', { slow: 0.15 }],
      ['Drone Spotter', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Napalm Shells', 'Blasts leave burning ground', { napalm: 1 }],
    ]),
  ],
  harpoon: [
    B('Spearhead', '#5aa0c8', [
      ['Barbed Tip', '+30% damage', { dmg: 0.3 }],
      ['Tungsten Spear', '+40% damage', { dmg: 0.4 }],
      ['Long Shaft', 'Pierce +1', { pierce: 1 }],
      ['Armor Piercer', 'Hits shred armor', { shred: 1 }],
      ['Leviathan Spear', '+100% damage, pierce +2', { dmg: 1.0, pierce: 2 }],
    ]),
    B('Winch', '#ffd24a', [
      ['Fast Reel', '+20% fire rate', { rate: 0.2 }],
      ['Heavy Chain', '+15% slow', { slow: 0.15 }],
      ['Power Reel', '+25% fire rate', { rate: 0.25 }],
      ['Anchor', '20% stun chance', { stun: 0.2 }],
      ['Twin Harpoon', '+1 harpoon per shot', { shots: 1 }],
    ]),
    B('Hunter', '#ff9a3a', [
      ['Spyglass', '+15% range', { range: 0.15 }],
      ['Sonar', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Weak-Spot Harpoon', 'Weak points +0.75×', { weakMul: 0.75 }],
      ['Trophy Hunter', '+4 gold per kill', { bounty: 4 }],
      ['Moby Slayer', '+100% damage vs bosses', { bossDmg: 1.0 }],
    ]),
  ],
  sonic: [
    B('Amplifier', '#ff66cc', [
      ['Bass Boost', '+25% damage', { dmg: 0.25 }],
      ['Subwoofer', '+30% damage', { dmg: 0.3 }],
      ['Shatter Freq', 'Hits shred armor', { shred: 1 }],
      ['Resonator', '+40% damage', { dmg: 0.4 }],
      ['Sonic Boom', '+80% damage, 30% stun', { dmg: 0.8, stun: 0.3 }],
    ]),
    B('Tempo', '#ffd24a', [
      ['Faster Beat', '+20% fire rate', { rate: 0.2 }],
      ['Wide Cone', '+15% range', { range: 0.15 }],
      ['Double Time', '+25% fire rate', { rate: 0.25 }],
      ['Echo', '+15% range', { range: 0.15 }],
      ['Drum Solo', '+60% fire rate', { rate: 0.6 }],
    ]),
    B('Disorient', '#b46bff', [
      ['Vertigo', '+20% slow', { slow: 0.2 }],
      ['Radar Ping', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Stagger', '+15% stun chance', { stun: 0.15 }],
      ['Ringing Ears', '+20% slow', { slow: 0.2 }],
      ['Brown Note', 'Executes below 15% HP', { execute: 0.15 }],
    ]),
  ],
  plasma: [
    B('Core', '#6af0ff', [
      ['Hotter Plasma', '+30% damage', { dmg: 0.3 }],
      ['Dense Core', '+35% damage', { dmg: 0.35 }],
      ['Ionized', 'Hits shred armor', { shred: 1 }],
      ['Star Core', '+50% damage', { dmg: 0.5 }],
      ['Supernova', 'Orbs explode on impact (3 m)', { splash: 3, dmg: 0.3 }],
    ]),
    B('Accelerator', '#ffd24a', [
      ['Magnetic Rails', '+20% fire rate', { rate: 0.2 }],
      ['Fast Orbs', '+25% fire rate', { rate: 0.25 }],
      ['Twin Emitter', '+1 orb', { shots: 1 }],
      ['Long Field', '+15% range', { range: 0.15 }],
      ['Orb Storm', '+2 orbs', { shots: 2 }],
    ]),
    B('Field', '#b46bff', [
      ['Static Cling', '+20% slow', { slow: 0.2 }],
      ['Scanner', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Plasma Burn', 'Orbs burn (+8/s)', { burn: 8 }],
      ['Collector', '+2 gold per kill', { bounty: 2 }],
      ['Event Horizon', '30% stun chance, +20% slow', { stun: 0.3, slow: 0.2 }],
    ]),
  ],
  storm: [
    B('Thunder', '#9ab0ff', [
      ['Charged Clouds', '+30% damage', { dmg: 0.3 }],
      ['Forked Bolt', '+1 chain', { chain: 1 }],
      ['Megavolt', '+40% damage', { dmg: 0.4 }],
      ['Chain Lightning', '+2 chains', { chain: 2 }],
      ['Wrath of the Sky', '+100% damage, +2 bolts', { dmg: 1.0, shots: 2 }],
    ]),
    B('Squall', '#ffd24a', [
      ['Quick Strikes', '+20% fire rate', { rate: 0.2 }],
      ['Wide Front', '+15% range', { range: 0.15 }],
      ['Frequent Storms', '+25% fire rate', { rate: 0.25 }],
      ['Double Strike', '+1 bolt', { shots: 1 }],
      ['Hurricane', '+60% fire rate', { rate: 0.6 }],
    ]),
    B('Static', '#5fd8ff', [
      ['Paralysis', '15% stun chance', { stun: 0.15 }],
      ['Weather Radar', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Ionize', 'Hits shred armor', { shred: 1 }],
      ['Lucky Strike', '+15% crit chance', { crit: 0.15 }],
      ['Eye of the Storm', '+40% stun chance', { stun: 0.4 }],
    ]),
  ],
  silo: [
    B('Payload', '#ff5a3a', [
      ['Bigger Warheads', '+25% damage', { dmg: 0.25 }],
      ['Wide Blast', '+0.8 m splash', { splash: 0.8 }],
      ['Bunker Buster', '+50% damage vs bosses', { bossDmg: 0.5 }],
      ['Thermobaric', 'Blasts burn (+10/s)', { burn: 10 }],
      ['Nuclear Tipped', '+100% damage, +1.5 m splash', { dmg: 1.0, splash: 1.5 }],
    ]),
    B('Launch Control', '#ffd24a', [
      ['Fast Fuel', '+15% fire rate', { rate: 0.15 }],
      ['Extra Cell', '+1 missile', { shots: 1 }],
      ['Auto Loader', '+20% fire rate', { rate: 0.2 }],
      ['Smart Guidance', 'Better homing', { homing: 3 }],
      ['Doomsday Salvo', '+3 missiles', { shots: 3 }],
    ]),
    B('Targeting', '#5fd8ff', [
      ['Radar Dish', '+15% range', { range: 0.15 }],
      ['IR Seeker', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Shock Payload', '15% stun chance', { stun: 0.15 }],
      ['Cluster Head', 'Blasts scatter 2 bomblets', { cluster: 2 }],
      ['MIRV', 'Blasts scatter 5 bomblets', { cluster: 5 }],
    ]),
  ],
  prism: [
    B('Refraction', '#ffe066', [
      ['Extra Facet', '+1 extra beam', { beams: 1 }],
      ['Brighter Light', '+30% damage', { dmg: 0.3 }],
      ['Second Facet', '+1 extra beam', { beams: 1 }],
      ['Focused Light', '+40% damage', { dmg: 0.4 }],
      ['Rainbow Array', '+2 extra beams, +50% damage', { beams: 2, dmg: 0.5 }],
    ]),
    B('Intensity', '#ff3d7f', [
      ['Lens Polish', '+50% max ramp', { ramp: 0.5 }],
      ['Long Focus', '+15% range', { range: 0.15 }],
      ['Hot Spot', '+50% max ramp', { ramp: 0.5 }],
      ['Burn Through', 'Hits shred armor', { shred: 1 }],
      ['Sunbeam', '+100% damage, +100% max ramp', { dmg: 1.0, ramp: 1.0 }],
    ]),
    B('Spectrum', '#5fd8ff', [
      ['UV Light', 'Detects cloaked Phantoms', { detect: 1 }],
      ['Heat Glare', '+5 burn/s', { burn: 5 }],
      ['Blinding Flash', '10% stun chance', { stun: 0.1 }],
      ['Gold Leaf', '+2 gold per kill', { bounty: 2 }],
      ['Disintegrate', 'Executes below 12% HP', { execute: 0.12 }],
    ]),
  ],
  howitzer: [
    B('Big Guns', '#8a9a6a', [
      ['Heavy Shell', '+25% damage', { dmg: 0.25 }],
      ['Wider Blast', '+1 m splash', { splash: 1 }],
      ['HE Filler', '+35% damage', { dmg: 0.35 }],
      ['Shrapnel', 'Hits shred armor', { shred: 1 }],
      ['Grand Battery', '+100% damage, +2 m splash', { dmg: 1.0, splash: 2 }],
    ]),
    B('Gun Crew', '#ffd24a', [
      ['Drilled Crew', '+20% fire rate', { rate: 0.2 }],
      ['Ammo Train', '+25% fire rate', { rate: 0.25 }],
      ['Second Gun', '+1 shell', { shots: 1 }],
      ['Veterans', '+25% fire rate', { rate: 0.25 }],
      ['Barrage Doctrine', '+2 shells', { shots: 2 }],
    ]),
    B('Forward Observer', '#5fd8ff', [
      ['Spotter', '+15% range', { range: 0.15 }],
      ['Concussion', '15% stun chance', { stun: 0.15 }],
      ['Recon Drone', 'Detects cloaked Phantoms', { detect: 1 }],
      ['White Phosphorus', 'Blasts burn (+10/s)', { burn: 10 }],
      ['Shockwave', '40% stun chance', { stun: 0.4 }],
    ]),
  ],
};

TREES.barracks = [
  B('Firepower', '#ff9a3a', [
    ['Better Rifles', '+25% unit damage', { dmg: 0.25 }],
    ['Drill Sergeant', '+20% unit fire rate', { rate: 0.2 }],
    ['Marksmen', '+35% unit damage', { dmg: 0.35 }],
    ['Armor Piercing', 'Shots shred armor', { shred: 1 }],
    ['Elite Guard', '+80% unit damage', { dmg: 0.8 }],
  ]),
  B('Numbers', '#5fd8ff', [
    ['Recruitment', '+20% faster squads', { rate: 0.2 }],
    ['Bigger Squads', '+1 soldier per squad', { shots: 1 }],
    ['Conscription', '+25% faster squads', { rate: 0.25 }],
    ['Platoon', '+1 soldier per squad', { shots: 1 }],
    ['Company', '+2 soldiers per squad', { shots: 2 }],
  ]),
  B('Recon', '#b46bff', [
    ['Binoculars', '+15% unit range', { range: 0.15 }],
    ['Thermal Sights', 'Units see cloaked Phantoms', { detect: 1 }],
    ['Field Radio', '+20% unit range', { range: 0.2 }],
    ['Flares', '10% stun chance', { stun: 0.1 }],
    ['Spec Ops', '+20% crit chance', { crit: 0.2 }],
  ]),
];
TREES.factory = [
  B('Main Gun', '#ff9a3a', [
    ['HEAT Rounds', '+25% shell damage', { dmg: 0.25 }],
    ['Bigger Charge', '+1 m splash', { splash: 1 }],
    ['Sabot', '+35% shell damage', { dmg: 0.35 }],
    ['Autoloader', '+30% fire rate', { rate: 0.3 }],
    ['Siege Gun', '+100% damage, +2 m splash', { dmg: 1.0, splash: 2 }],
  ]),
  B('Assembly Line', '#5fd8ff', [
    ['Night Shift', '+20% faster tanks', { rate: 0.2 }],
    ['Second Line', '+1 tank per batch', { shots: 1 }],
    ['Robotics', '+25% faster tanks', { rate: 0.25 }],
    ['Reinforced Hulls', 'Shots shred armor', { shred: 1 }],
    ['Armored Column', '+2 tanks per batch', { shots: 2 }],
  ]),
  B('Optics', '#b46bff', [
    ['Rangefinder', '+15% range', { range: 0.15 }],
    ['Thermals', 'Tanks see cloaked Phantoms', { detect: 1 }],
    ['Stabilizer', '+20% range', { range: 0.2 }],
    ['Concussion', '15% stun chance', { stun: 0.15 }],
    ['Hunter Killer', '+25% crit chance', { crit: 0.25 }],
  ]),
];
TREES.helipad = [
  B('Rockets', '#ff9a3a', [
    ['Hydra Pods', '+25% rocket damage', { dmg: 0.25 }],
    ['Wider Warheads', '+1 m splash', { splash: 1 }],
    ['Hellfire', '+35% rocket damage', { dmg: 0.35 }],
    ['Rapid Pods', '+30% fire rate', { rate: 0.3 }],
    ['Thunderbird', '+100% damage', { dmg: 1.0 }],
  ]),
  B('Flight Deck', '#5fd8ff', [
    ['Ground Crew', '+20% faster launches', { rate: 0.2 }],
    ['Wingman', '+1 gunship per launch', { shots: 1 }],
    ['Hot Refuel', '+25% faster launches', { rate: 0.25 }],
    ['Armored Cockpit', 'Rockets shred armor', { shred: 1 }],
    ['Air Wing', '+2 gunships per launch', { shots: 2 }],
  ]),
  B('Avionics', '#b46bff', [
    ['Radar', '+15% range', { range: 0.15 }],
    ['FLIR', 'Gunships see cloaked Phantoms', { detect: 1 }],
    ['Datalink', '+20% range', { range: 0.2 }],
    ['Chaff', '15% stun chance', { stun: 0.15 }],
    ['Top Gun', '+25% crit chance', { crit: 0.25 }],
  ]),
];

TREES.carrier = [
  B('Payload', '#ff9a3a', [
    ['Rocket Racks', '+25% jet damage', { dmg: 0.25 }],
    ['Cluster Warheads', '+1 m splash', { splash: 1 }],
    ['Heavy Ordnance', '+35% jet damage', { dmg: 0.35 }],
    ['Strafing Run', '+30% fire rate', { rate: 0.3 }],
    ['Carpet Bombing', '+100% damage, +2 m splash', { dmg: 1.0, splash: 2 }],
  ]),
  B('Flight Deck', '#5fd8ff', [
    ['Catapult', '+20% faster launches', { rate: 0.2 }],
    ['Wingman', '+1 jet per launch', { shots: 1 }],
    ['Deck Crew', '+25% faster launches', { rate: 0.25 }],
    ['Armor Piercing', 'Rockets shred armor', { shred: 1 }],
    ['Squadron', '+2 jets per launch', { shots: 2 }],
  ]),
  B('AWACS', '#b46bff', [
    ['Long Radar', '+15% range', { range: 0.15 }],
    ['Thermal Pods', 'Jets see cloaked Phantoms', { detect: 1 }],
    ['Datalink', '+20% range', { range: 0.2 }],
    ['Sonic Boom', '15% stun chance', { stun: 0.15 }],
    ['Ace Pilots', '+25% crit chance', { crit: 0.25 }],
  ]),
];

/** Can this branch buy its next tier? Returns a reason string when not. */
export function canBuy(picks, branch) {
  const total = picks.reduce((a, b) => a + b, 0);
  const tier = picks[branch];
  if (tier >= 5) return 'Branch maxed';
  if (total >= 10) return 'All 10 upgrades used';
  if (tier >= 3 && picks.some((p, i) => i !== branch && p > 3)) return 'Only one branch can go past tier 3';
  return null;
}
