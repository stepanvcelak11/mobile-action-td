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
};

/** Can this branch buy its next tier? Returns a reason string when not. */
export function canBuy(picks, branch) {
  const total = picks.reduce((a, b) => a + b, 0);
  const tier = picks[branch];
  if (tier >= 5) return 'Branch maxed';
  if (total >= 10) return 'All 10 upgrades used';
  if (tier >= 3 && picks.some((p, i) => i !== branch && p > 3)) return 'Only one branch can go past tier 3';
  return null;
}
