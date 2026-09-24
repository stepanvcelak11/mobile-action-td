// Static game data: turret types, enemies, maps, themes, perks, abilities.

/*
 * Turret kinds:
 *  shell/bullet/rocket/shard/sniper/mortar = projectile weapons
 *  zap = chain lightning (hitscan), rail = piercing beam (hitscan)
 *  flame = continuous cone, laser = continuous ramping beam
 * Manual control is ~1.7–2× an auto turret's DPS, weak points multiply further (WEAK_MULT + upgrades).
 */
export const TURRETS = {
  cannon: {
    name: 'Twin Cannon', cost: 100, unlockTP: 0, color: '#f0a020',
    desc: 'Balanced twin shells. Reliable all-rounder.',
    range: 11.5, interval: 1.2, damage: 12, shots: 2, speed: 55, kind: 'shell',
    manual: { interval: 0.5, damage: 17, heat: 12, speed: 120 }, fov: 75,
  },
  gatling: {
    name: 'Gatling', cost: 120, unlockTP: 0, color: '#46d46a',
    desc: 'Shreds swarms and drones at short range.',
    range: 9, interval: 0.14, damage: 4, shots: 1, speed: 75, kind: 'bullet', spread: 0.035,
    manual: { interval: 0.1, damage: 5, heat: 2.4, speed: 130 }, fov: 75,
  },
  sniper: {
    name: 'Sniper', cost: 150, unlockTP: 0, color: '#e8e0c8',
    desc: 'Huge range. Manual shots drop and fly — lead your target. Weak points ×3.',
    range: 26, interval: 2.6, damage: 45, shots: 1, speed: 160, kind: 'sniper', target: 'strong', weakBonus: 1.25,
    manual: { interval: 1.3, damage: 150, heat: 22, speed: 150, gravity: 18 }, fov: 20, scope: true,
  },
  cryo: {
    name: 'Cryo Lance', cost: 150, unlockTP: 2, color: '#8fe3ff',
    desc: 'Ice shards that slow enemies. Upgrades freeze and shatter.',
    range: 10, interval: 1.0, damage: 9, shots: 1, speed: 45, kind: 'shard', slow: 0.45,
    manual: { interval: 0.35, damage: 15, heat: 8, speed: 90 }, fov: 75,
  },
  flame: {
    name: 'Flamethrower', cost: 160, unlockTP: 3, color: '#ff7a1a',
    desc: 'Short-range cone that sets everything on fire.',
    range: 6.5, interval: 0.1, damage: 3.2, shots: 1, kind: 'flame', burn: 5, cone: 0.35,
    manual: { interval: 0.1, damage: 5.5, heat: 2.2 }, fov: 75,
  },
  rocket: {
    name: 'Rocket Pod', cost: 175, unlockTP: 4, color: '#ff4a3a',
    desc: 'Long-range homing rockets with splash damage. Hits air.',
    range: 15, interval: 2.4, damage: 40, shots: 2, speed: 22, kind: 'rocket', splash: 3.0, homing: 3.5,
    manual: { interval: 1.0, damage: 55, heat: 20, speed: 42, splash: 3.2 }, fov: 75,
  },
  mortar: {
    name: 'Mortar', cost: 190, unlockTP: 5, color: '#b0a070',
    desc: 'Lobbed shells with a big blast. Ground only — aim ahead of the target.',
    range: 21, minRange: 4, interval: 3.0, damage: 55, shots: 1, kind: 'mortar', splash: 3.4, groundOnly: true,
    manual: { interval: 1.5, damage: 80, heat: 20, splash: 3.6 }, fov: 70,
  },
  tesla: {
    name: 'Tesla Coil', cost: 200, unlockTP: 6, color: '#b46bff',
    desc: 'Lightning chains between enemies and slows them.',
    range: 8.5, interval: 0.9, damage: 20, shots: 1, kind: 'zap', chain: 3, slow: 0.45,
    manual: { interval: 0.6, damage: 26, heat: 14, chain: 3 }, fov: 75,
  },
  laser: {
    name: 'Laser', cost: 220, unlockTP: 7, color: '#ff3d7f',
    desc: 'Continuous beam that ramps up the longer it stays on one target.',
    range: 12, interval: 0.1, damage: 2.4, shots: 1, kind: 'laser', ramp: 1.5,
    manual: { interval: 0.1, damage: 4, heat: 1.6 }, fov: 75,
  },
  rail: {
    name: 'Railgun', cost: 250, unlockTP: 8, color: '#4fc3ff',
    desc: 'Pierces every enemy in a line. Zoom scope in FPV.',
    range: 22, interval: 3.0, damage: 130, shots: 1, kind: 'rail', target: 'strong',
    manual: { interval: 2.0, damage: 160, heat: 34 }, fov: 42, scope: true,
  },
  scatter: {
    name: 'Scatter Cannon', cost: 140, unlockTP: 3, color: '#ffa05a',
    desc: 'A shotgun: 7 pellets per blast. Devastating up close, weak far away.',
    range: 7.5, interval: 1.1, damage: 6, shots: 7, speed: 60, kind: 'bullet', spread: 0.12,
    manual: { interval: 0.55, damage: 8, heat: 14, speed: 110, pellets: 7 }, fov: 80,
  },
  venom: {
    name: 'Venom Sprayer', cost: 160, unlockTP: 4, color: '#7fe04a',
    desc: 'Toxic globs: poison damage over time plus a slow. Stack it on tough enemies.',
    range: 10, interval: 0.9, damage: 5, shots: 1, speed: 40, kind: 'venom', burn: 8, slow: 0.25,
    manual: { interval: 0.3, damage: 7, heat: 7, speed: 70 }, fov: 78,
  },
  bouncer: {
    name: 'Grenadier', cost: 170, unlockTP: 5, color: '#c8a040',
    desc: 'Fast lobbed grenades with a small blast. Ground only — lead the target.',
    range: 13, minRange: 3, interval: 1.4, damage: 24, shots: 1, kind: 'mortar', splash: 2.2, groundOnly: true, lob: 0.6,
    manual: { interval: 0.7, damage: 34, heat: 12, splash: 2.4 }, fov: 75,
  },
  harpoon: {
    name: 'Harpoon', cost: 200, unlockTP: 6, color: '#5aa0c8',
    desc: 'A heavy spear that pierces enemies and pins them (big slow).',
    range: 16, interval: 2.2, damage: 60, shots: 1, speed: 70, kind: 'harpoon', pierce: 2, slow: 0.6, target: 'strong',
    manual: { interval: 1.2, damage: 90, heat: 20, speed: 90 }, fov: 70,
  },
  sonic: {
    name: 'Sonic Emitter', cost: 210, unlockTP: 7, color: '#ff66cc',
    desc: 'Shockwave pulses hit every enemy around it and stagger them. Manual: aimed sonic blast.',
    range: 7.5, interval: 1.6, damage: 16, shots: 1, kind: 'pulse', slow: 0.3, stun: 0.1,
    manual: { interval: 0.8, damage: 30, heat: 14 }, fov: 80,
  },
  plasma: {
    name: 'Plasma Orb', cost: 230, unlockTP: 8, color: '#6af0ff',
    desc: 'Slow plasma orbs that burn through everything in their path.',
    range: 14, interval: 2.0, damage: 28, shots: 1, speed: 14, kind: 'orb', pierce: 99,
    manual: { interval: 1.0, damage: 40, heat: 18, speed: 22 }, fov: 75,
  },
  storm: {
    name: 'Storm Spire', cost: 240, unlockTP: 9, color: '#9ab0ff',
    desc: 'Calls lightning from the sky onto enemies anywhere in range.',
    range: 18, interval: 1.8, damage: 45, shots: 1, kind: 'zap', sky: true, chain: 2,
    manual: { interval: 0.9, damage: 55, heat: 18, chain: 2 }, fov: 75,
  },
  silo: {
    name: 'Hellfire Silo', cost: 260, unlockTP: 10, color: '#ff5a3a',
    desc: 'Vertical missile salvos that hunt the toughest enemy on the field.',
    range: 24, interval: 3.2, damage: 70, shots: 3, speed: 20, kind: 'rocket', splash: 2.6, homing: 6, silo: true, target: 'strong',
    manual: { interval: 1.4, damage: 80, heat: 24, speed: 34, splash: 2.8 }, fov: 75,
  },
  prism: {
    name: 'Prism Tower', cost: 260, unlockTP: 10, color: '#ffe066',
    desc: 'Refracted beams hit three enemies at once and ramp up.',
    range: 11, interval: 0.1, damage: 1.6, shots: 1, kind: 'laser', ramp: 1.0, beams: 2,
    manual: { interval: 0.1, damage: 2.8, heat: 1.8 }, fov: 75,
  },
  howitzer: {
    name: 'Howitzer', cost: 280, unlockTP: 11, color: '#8a9a6a',
    desc: 'Extreme-range artillery with a huge blast. Ground only — shells take a while to land.',
    range: 32, minRange: 8, interval: 4.2, damage: 120, shots: 1, kind: 'mortar', splash: 4.6, groundOnly: true, lob: 1.4,
    manual: { interval: 2.2, damage: 170, heat: 30, splash: 5 }, fov: 65,
  },
  // Army towers (src/army.js): they deploy units instead of shooting. interval = seconds between
  // squads, damage/range scale the units, shots = squad size bonus from upgrades.
  barracks: {
    name: 'Barracks', cost: 150, unlockTP: 6, color: '#5a8ad8',
    desc: 'Sends riflemen down the road. They block enemies and fight. Fire to drop a squad where you aim, or take control of a soldier.',
    range: 12, interval: 9, damage: 10, shots: 1, kind: 'deploy', unit: 'soldier',
    manual: { interval: 0.6, damage: 10, heat: 12 }, fov: 80,
  },
  factory: {
    name: 'Tank Factory', cost: 260, unlockTP: 10, color: '#4a7ab8',
    desc: 'Builds light tanks that hold the road and shell groups. Fire to drop a tank, or drive one yourself.',
    range: 14, interval: 18, damage: 50, shots: 1, kind: 'deploy', unit: 'tank',
    manual: { interval: 0.6, damage: 50, heat: 12 }, fov: 80,
  },
  helipad: {
    name: 'Helipad', cost: 240, unlockTP: 9, color: '#6ab0e8',
    desc: 'Launches gunships that circle the fight and fire rockets — they hit flyers too. Fire to send them where you aim, or fly one.',
    range: 15, interval: 16, damage: 24, shots: 1, kind: 'deploy', unit: 'heli',
    manual: { interval: 0.6, damage: 24, heat: 12 }, fov: 80,
  },
};
export const TURRET_ORDER = ['cannon', 'gatling', 'sniper', 'scatter', 'cryo', 'venom', 'flame', 'bouncer', 'rocket', 'harpoon', 'mortar', 'sonic', 'tesla', 'plasma', 'laser', 'storm', 'rail', 'silo', 'prism', 'howitzer', 'barracks', 'helipad', 'factory'];

// How to play each turret yourself (shown in the Armory).
export const TURRET_TIPS = {
  cannon: 'Alternating barrels. Aim at heads for ×2 damage and at tank tracks to slow them.',
  gatling: 'Hold FIRE and sweep across swarms; watch the heat bar.',
  sniper: 'Real bullet drop and travel time: aim slightly above and ahead. Hold still to steady the scope.',
  scatter: 'Let enemies come close — every pellet that lands counts.',
  cryo: 'Freeze the lead enemy of a group so the rest pile up behind it.',
  venom: 'Poison stacks up. Spray the tanks and bosses, the slow does the rest.',
  flame: 'Sweep the cone over the road; burning enemies keep taking damage.',
  bouncer: 'Grenades arc — fire where the enemy will be when the grenade lands.',
  rocket: 'Rockets fly straight when you aim them; lead fast targets.',
  harpoon: 'Line enemies up: the spear pierces and pins everything it hits.',
  mortar: 'Watch the landing ring and lead the group.',
  sonic: 'Point the blast at the thickest crowd — everything in the cone is staggered.',
  tesla: 'Aim at the middle of a group so the chain reaches everyone.',
  plasma: 'Orbs are slow but pierce everything — fire along the road.',
  laser: 'Keep the beam on one target: damage ramps up the longer you hold it.',
  storm: 'Lightning strikes where you aim on the ground — great for shielded groups.',
  rail: 'Scope in and line enemies up; the slug pierces the whole line.',
  silo: 'Your missiles launch straight at the crosshair and explode on impact.',
  prism: 'Hold the beam; two refracted beams hit nearby enemies automatically.',
  howitzer: 'Shells take a long time to land — aim well ahead of the group.',
  barracks: 'FIRE drops a squad where you aim and moves the rally point. TAKE CONTROL to fight as a rifleman: left thumb moves, drag right to aim.',
  factory: 'Park tanks in chokepoints — they block up to five enemies. TAKE CONTROL to drive one and fire its cannon.',
  helipad: 'Gunships shoot flyers. TAKE CONTROL to fly one: left thumb flies, drag right to aim the rockets.',
};

export const WEAK_MULT = 1.75;
export const MAX_UPGRADES = 10;
export const TIER_COST = [0.4, 0.6, 0.9, 1.5, 3.0]; // × turret cost
export const SELL_RATE = 0.6;

/*
 * Enemies. air = flies (ground-only weapons can't hit), cloak = auto turrets need Detection,
 * shield = absorbs damage until broken (weak point breaks it instantly), armor = damage reduction,
 * split = spawns minis on death.
 */
export const ENEMIES = {
  scout: { name: 'Crawler', hp: 40, speed: 4.4, reward: 15, damage: 5, radius: 0.75, centerY: 0.55, barY: 1.5, barW: 1.2, wpR: 0.3, lateral: 0.8, cost: 1 },
  mini: { name: 'Mini', hp: 22, speed: 5.2, reward: 5, damage: 3, radius: 0.55, centerY: 0.4, barY: 1.1, barW: 0.8, wpR: 0.22, lateral: 0.9, cost: 0.6, scale: 0.7 },
  heavy: { name: 'Tank', hp: 260, speed: 1.9, reward: 40, damage: 15, radius: 1.45, centerY: 0.85, barY: 2.5, barW: 2.0, wpR: 0.42, lateral: 0.45, armor: 0.25, cost: 4 },
  drone: { name: 'Drone', hp: 50, speed: 5.0, reward: 18, damage: 6, radius: 0.85, centerY: 3.4, barY: 4.4, barW: 1.2, wpR: 0.3, lateral: 1.4, air: true, cost: 1.6 },
  shield: { name: 'Guardian', hp: 150, shield: 140, speed: 2.3, reward: 45, damage: 12, radius: 1.2, centerY: 0.9, barY: 2.7, barW: 1.8, wpR: 0.38, lateral: 0.5, cost: 5 },
  cloak: { name: 'Phantom', hp: 85, speed: 3.6, reward: 35, damage: 10, radius: 0.85, centerY: 0.75, barY: 1.9, barW: 1.3, wpR: 0.3, lateral: 0.7, cloak: true, cost: 3 },
  splitter: { name: 'Splitter', hp: 150, speed: 2.5, reward: 25, damage: 10, radius: 1.15, centerY: 0.85, barY: 2.2, barW: 1.6, wpR: 0.36, lateral: 0.5, split: 3, cost: 3.5 },
  boss: { name: 'Behemoth', hp: 2200, speed: 1.1, reward: 300, damage: 50, radius: 2.9, centerY: 2.0, barY: 6.2, barW: 4.2, wpR: 0.95, lateral: 0, armor: 0.15, cost: 0 },
  runner: { name: 'Runner', hp: 26, speed: 7.2, reward: 10, damage: 4, radius: 0.6, centerY: 0.6, barY: 1.4, barW: 1.0, wpR: 0.25, lateral: 1.0, cost: 0.8, minMap: 1 },
  medic: { name: 'Medic', hp: 110, speed: 2.8, reward: 35, damage: 8, radius: 0.9, centerY: 0.9, barY: 2.2, barW: 1.4, wpR: 0.3, lateral: 0.6, heal: 18, cost: 3.2, minMap: 2 },
  burrower: { name: 'Burrower', hp: 120, speed: 3.2, reward: 30, damage: 9, radius: 0.9, centerY: 0.5, barY: 1.6, barW: 1.4, wpR: 0.3, lateral: 0.5, burrow: true, cost: 3, minMap: 3 },
  juggernaut: { name: 'Juggernaut', hp: 620, speed: 1.35, reward: 80, damage: 22, radius: 1.7, centerY: 1.2, barY: 3.3, barW: 2.4, wpR: 0.45, lateral: 0.3, armor: 0.5, cost: 8, minMap: 4 },
  bomber: { name: 'Bomber', hp: 190, speed: 2.6, reward: 40, damage: 14, radius: 1.3, centerY: 4.2, barY: 5.5, barW: 1.8, wpR: 0.4, lateral: 1.0, air: true, cost: 4, minMap: 5 },
  // Season 2: shields itself and heals everything around it.
  aegis: { name: 'Aegis Priest', hp: 260, shield: 160, speed: 2.0, reward: 60, damage: 14, radius: 1.0, centerY: 1.1, barY: 2.9, barW: 1.8, wpR: 0.34, lateral: 0.4, heal: 14, cost: 5.5, minMap: 7 },
};

export const ENEMY_TIPS = {
  drone: 'DRONES fly — the Mortar can\'t hit them. Gatling and Rockets shine.',
  shield: 'GUARDIANS carry an energy shield. Hit the glowing generator on their back to pop it instantly.',
  cloak: 'PHANTOMS are cloaked — auto turrets ignore them without Detection. Shoot them yourself or reveal them with splash.',
  splitter: 'SPLITTERS burst into three minis when destroyed.',
  heavy: 'TANKS are armored (−25% damage). Shoot their TRACKS to slow them down, or strip armor with Shred upgrades.',
  runner: 'RUNNERS are fragile but extremely fast. Gatling and Scatter handle them best.',
  medic: 'MEDICS heal every enemy around them. Kill them first — aim for the head!',
  burrower: 'BURROWERS dig underground every few seconds and can\'t be hit while buried.',
  juggernaut: 'JUGGERNAUTS have 50% armor. Crippling their legs and Shred upgrades are your friends.',
  bomber: 'BOMBERS are armored flyers. Ground-only weapons can\'t touch them.',
  aegis: 'AEGIS PRIESTS carry a shield and heal everyone nearby. Pop the shield on the back core, then go for the head.',
};

// Hit zones for manual shots (local coordinates): head = ×2 damage, limbs (legs, tracks, rotors) = crippled (slowed).
export const HEADSHOT_MULT = 2;
export const HITZONES = {
  scout: { head: [0, 0.6, 0.72, 0.28], limbs: [[-0.75, 0.3, 0, 0.35], [0.75, 0.3, 0, 0.35]] },
  mini: { head: [0, 0.6, 0.72, 0.28], limbs: [[-0.75, 0.3, 0, 0.35], [0.75, 0.3, 0, 0.35]] },
  heavy: { head: [0, 1.35, 0.2, 0.55], limbs: [[-1.05, 0.34, 0, 0.55], [1.05, 0.34, 0, 0.55], [-1.05, 0.34, 1.0, 0.45], [1.05, 0.34, 1.0, 0.45]] },
  drone: { head: [0, 3.4, 0.4, 0.3], limbs: [[0.64, 3.55, 0.64, 0.35], [-0.64, 3.55, 0.64, 0.35], [0.64, 3.55, -0.64, 0.35], [-0.64, 3.55, -0.64, 0.35]] },
  shield: { head: [0, 1.62, 0.35, 0.36], limbs: [[-0.45, 0.35, 0, 0.3], [0.45, 0.35, 0, 0.3]] },
  cloak: { head: [0, 1.55, 0.05, 0.32], limbs: [] },
  splitter: { head: [0, 1.55, 0, 0.3], limbs: [] },
  boss: { head: [0, 2.45, 2.1, 0.7], limbs: [[-2.4, 0.3, -1.4, 0.55], [2.4, 0.3, -1.4, 0.55], [-2.4, 0.3, 1.4, 0.55], [2.4, 0.3, 1.4, 0.55]] },
  runner: { head: [0, 0.95, 0.5, 0.24], limbs: [[-0.25, 0.3, 0, 0.25], [0.25, 0.3, 0, 0.25]] },
  medic: { head: [0, 1.55, 0.1, 0.3], limbs: [[-0.3, 0.35, 0, 0.28], [0.3, 0.35, 0, 0.28]] },
  burrower: { head: [0, 0.55, 0.9, 0.35], limbs: [] },
  juggernaut: { head: [0, 2.2, 0.4, 0.45], limbs: [[-0.75, 0.55, 0, 0.45], [0.75, 0.55, 0, 0.45]] },
  bomber: { head: [0, 4.2, 1.2, 0.45], limbs: [[-1.4, 4.3, 0, 0.45], [1.4, 4.3, 0, 0.45]] },
  aegis: { head: [0, 2.05, 0.18, 0.34], limbs: [[-0.34, 0.42, 0, 0.3], [0.34, 0.42, 0, 0.3]] },
};

export const PERKS = [
  { id: 'gold', name: 'War Chest', desc: '+30 starting gold', max: 3 },
  { id: 'armor', name: 'Reinforced Base', desc: '+25 base HP', max: 3 },
  { id: 'crit', name: 'Gunner Training', desc: '+15% manual damage', max: 3 },
  { id: 'cooling', name: 'Heat Sinks', desc: '−15% barrel heat', max: 3 },
  { id: 'servo', name: 'Servo Motors', desc: '+8% auto fire rate', max: 3 },
  { id: 'bounty', name: 'Bounty Hunter', desc: '+10% kill gold', max: 3 },
  { id: 'support', name: 'Air Support', desc: '−15% ability cooldowns', max: 3 },
  { id: 'headhunter', name: 'Headhunter', desc: '+15% headshot damage', max: 3 },
  { id: 'logistics', name: 'Logistics', desc: '−5% turret build cost', max: 3 },
  { id: 'overcharge', name: 'Overcharge', desc: '+15% Hypercharge fill speed', max: 3 },
];

// Abilities are collectible charges (from chests, the pass, the road and the shop); each use costs one charge.
export const ABILITIES = {
  strike: { name: 'Airstrike', cooldown: 25, damage: 140, color: '#ff8a3a', desc: '5 bombs land 1.2 s after you pick the spot. Lead your target.' },
  emp: { name: 'EMP', cooldown: 30, stun: 2.5, color: '#8fa8ff', desc: 'Stuns every enemy for 2.5 s and pops all shields.' },
  repair: { name: 'Repair', cooldown: 30, heal: 30, color: '#3ee07a', desc: 'Restores 30 base HP.' },
  freeze: { name: 'Cryo Bomb', cooldown: 25, radius: 6, color: '#8fe3ff', desc: 'Freezes everything in a 6 m circle for 3 s.' },
  nuke: { name: 'Orbital Lance', cooldown: 45, damage: 900, color: '#ff4ad8', desc: 'A space laser hits the spot 2 s later for huge damage. Perfect for bosses.' },
  goldrush: { name: 'Gold Rush', cooldown: 40, color: '#ffc62e', desc: 'Kills give double gold for 15 s.' },
  overclock: { name: 'Overclock', cooldown: 40, color: '#ff7a1a', desc: 'All turrets fire 50% faster for 10 s.' },
  shieldwall: { name: 'Shield Wall', cooldown: 50, color: '#5fd8ff', desc: 'The base takes no damage for 8 s.' },
  tarpit: { name: 'Tar Pit', cooldown: 30, radius: 5, color: '#8a6a3a', desc: 'Sticky tar on the road slows enemies by 60% for 8 s.' },
  blackhole: { name: 'Black Hole', cooldown: 45, radius: 5, color: '#9a5aff', desc: 'Pulls enemies in the area back along the road.' },
};
export const ABILITY_ORDER = ['strike', 'emp', 'repair', 'freeze', 'nuke', 'goldrush', 'overclock', 'shieldwall', 'tarpit', 'blackhole'];
export const TARGETED_ABILITIES = ['strike', 'freeze', 'nuke', 'tarpit', 'blackhole'];

// Turret skins: palette + a unique accessory model + an attack style (tracer, trail and impact colours).
export const SKINS = {
  factory: { name: 'Factory', rarity: 'common', price: 0, steel: '#5d6773', dark: '#2e343c', light: '#9aa6b2', acc: null, fx: null, desc: 'Standard issue.' },
  desert: { name: 'Desert Raider', rarity: 'rare', price: 80, steel: '#b89868', dark: '#6a5238', light: '#e0c898', acc: 'sandbags', fx: { tracer: '#ffd08a', trail: '#ff9a3a', spark: '#ffcc66' }, desc: 'Sandbag fort and dusty amber tracers.' },
  arctic: { name: 'Arctic Ops', rarity: 'rare', price: 80, steel: '#e6eef6', dark: '#8a9aac', light: '#ffffff', band: '#4fc3ff', acc: 'icicles', fx: { tracer: '#dff8ff', trail: '#6fd8ff', spark: '#bff0ff' }, desc: 'Snow cap, icicles and ice-blue shots.' },
  toxic: { name: 'Biohazard', rarity: 'epic', price: 160, steel: '#55703a', dark: '#2a3a1e', light: '#8fb84a', band: '#8fe04a', glow: '#8fe04a', acc: 'canisters', fx: { tracer: '#d8ff9a', trail: '#6ae04a', spark: '#8fe04a' }, desc: 'Glowing canisters, green acid shots.' },
  obsidian: { name: 'Magma Forge', rarity: 'epic', price: 160, steel: '#3e2a30', dark: '#1c1014', light: '#6a3a40', band: '#ff5a1a', glow: '#ff5a1a', acc: 'spikes', fx: { tracer: '#ffd07a', trail: '#ff4a1a', spark: '#ff7a2a' }, desc: 'Obsidian spikes and molten tracers.' },
  crystal: { name: 'Crystal', rarity: 'epic', price: 180, steel: '#7ab8d8', dark: '#2a4a6a', light: '#c8f0ff', band: '#8ff8ff', glow: '#6af0ff', acc: 'crystals', fx: { tracer: '#ffffff', trail: '#6af0ff', spark: '#bff8ff' }, desc: 'Floating crystal shards and prismatic shots.' },
  royal: { name: 'Royal Guard', rarity: 'legendary', price: 260, steel: '#a8203a', dark: '#4a0a18', light: '#e8c070', band: '#ffd24a', acc: 'banners', fx: { tracer: '#ffe08a', trail: '#ff3a4a', spark: '#ffd24a' }, desc: 'Crimson armour, gold trim and royal banners.' },
  neon: { name: 'Neon Night', rarity: 'legendary', price: 300, steel: '#2a2a3c', dark: '#14141e', light: '#44446a', band: '#ff3d9f', glow: '#ff3d9f', acc: 'neon', fx: { tracer: '#ffffff', trail: '#ff3d9f', spark: '#3af0ff' }, desc: 'Neon tubes and hot-pink laser tracers.' },
  gold: { name: 'Solid Gold', rarity: 'legendary', price: 300, steel: '#ffc93a', dark: '#c08a1a', light: '#fff0a8', band: '#ffffff', metal: 0.55, glow: '#ffb020', acc: 'crown', fx: { tracer: '#fff4c0', trail: '#ffb020', spark: '#ffe066' }, desc: 'Gold plating and a crown. Shoots gold.' },
  camo: { name: 'Jungle Camo', rarity: 'epic', price: 170, steel: '#4a5a32', dark: '#2a3420', light: '#7a8a4a', band: '#c8a24a', acc: 'sandbags', fx: { tracer: '#f0e0a0', trail: '#8ab04a', spark: '#d8c070' }, desc: 'Season 2 · Leaf camouflage, sandbags and olive tracers.' },
  tempest: { name: 'Tempest', rarity: 'legendary', price: 320, steel: '#34405a', dark: '#161c2a', light: '#6a88c0', band: '#8fd8ff', glow: '#5ac8ff', acc: 'crystals', fx: { tracer: '#e8f8ff', trail: '#5ac8ff', spark: '#bfe8ff' }, desc: 'Season 2 · Storm crystals and lightning-blue shots.' },
  void: { name: 'Void Walker', rarity: 'legendary', price: 340, steel: '#2a1a3a', dark: '#0a0612', light: '#5a3a8a', band: '#b46bff', glow: '#9a4aff', acc: 'halo', fx: { tracer: '#f0d8ff', trail: '#9a4aff', spark: '#c48bff' }, desc: 'A floating void halo and purple rift shots.' },
};
export const SKIN_ORDER = ['factory', 'desert', 'arctic', 'toxic', 'obsidian', 'crystal', 'royal', 'neon', 'gold', 'void', 'camo', 'tempest'];
export const RARITY_COLORS = { common: '#9aa7b4', rare: '#4fa8ff', epic: '#b46bff', legendary: '#ffb020' };

export const THEMES = {
  grass: {
    sky: '#b9dcf0', skyTop: '#4f8fd0', fog: [70, 150], groundA: '#5d8a3a', groundB: '#7aa04a', edge: '#8a7350', hill: '#6b7a5a',
    road: ['#6e5a3f', '#9b7a4f', '#a68457', '#7f6443'], sun: ['#fff1d6', 2.6], amb: 0.55,
    hemi: ['#cfe6ff', '#4a5a30', 0.7], exposure: 1.05, decor: 'pine', rock: '#8d9099', fx: 'petals',
    pools: { color: '#3f8fc0', color2: '#5fb0dd', glow: false, n: 3 }, landmark: 'windmill', flowers: true,
  },
  desert: {
    sky: '#f6dcb0', skyTop: '#d88a4a', fog: [55, 135], groundA: '#d6b173', groundB: '#e4c48a', edge: '#b48a55', hill: '#c28d55',
    road: ['#8e6c42', '#ae8552', '#bb925c', '#96714a'], sun: ['#ffe2b0', 2.9], amb: 0.5,
    hemi: ['#ffe9c7', '#8a6a3a', 0.6], exposure: 1.0, decor: 'cactus', rock: '#b0845a', fx: 'dust',
    pools: { color: '#2f9fb0', color2: '#56c6d0', glow: false, n: 1 }, landmark: 'pyramids',
  },
  snow: {
    sky: '#d4e2ef', skyTop: '#7fa4c8', fog: [50, 125], groundA: '#dfe8ef', groundB: '#cfdbe6', edge: '#aab6c2', hill: '#eef3f8',
    road: ['#6f7b88', '#8d99a6', '#9da8b4', '#7c8794'], sun: ['#ffffff', 2.1], amb: 0.6,
    hemi: ['#e6f2ff', '#8a98a8', 0.7], exposure: 0.92, decor: 'snowpine', rock: '#7f8c99', fx: 'snow',
    pools: { color: '#a8d8f0', color2: '#d4f0ff', glow: false, n: 4 }, landmark: 'crystals',
  },
  canyon: {
    sky: '#f2c89a', skyTop: '#5f86b8', fog: [60, 140], groundA: '#b8663e', groundB: '#c97a4c', edge: '#8e4c2c', hill: '#a0502c',
    road: ['#6a3a22', '#8a5234', '#9a5e3c', '#74432a'], sun: ['#ffd9a8', 2.8], amb: 0.5,
    hemi: ['#ffe0c0', '#6a2a14', 0.6], exposure: 1.0, decor: 'shrub', rock: '#9a4a2a', fx: 'dust',
    landmark: 'mesas',
  },
  swamp: {
    sky: '#a7b890', skyTop: '#4a5a40', fog: [35, 105], groundA: '#3d4a2a', groundB: '#4d5a32', edge: '#3a3222', hill: '#2e3a24',
    road: ['#2e2a1c', '#4a4028', '#564a30', '#3c3422'], sun: ['#e6f0c0', 1.9], amb: 0.5,
    hemi: ['#d0e0a0', '#1a2210', 0.7], exposure: 1.05, decor: 'deadtree', rock: '#4a4a3a', fx: 'spores',
    pools: { color: '#4fa02a', color2: '#8fe04a', glow: true, n: 9 }, landmark: 'mushrooms',
  },
  magma: {
    sky: '#3a1418', skyTop: '#100608', fog: [40, 110], groundA: '#2d2427', groundB: '#3b2f2f', edge: '#4d2a1c', hill: '#1d1719',
    road: ['#35251f', '#56392a', '#664230', '#472d22'], sun: ['#ffa27a', 1.7], amb: 0.4,
    hemi: ['#ff8a5a', '#200808', 0.7], exposure: 1.15, decor: 'obsidian', rock: '#3a3035', fx: 'embers',
    pools: { color: '#ff5a1a', color2: '#ffb03a', glow: true, n: 14, rim: true }, landmark: 'volcano',
  },
  neon: {
    sky: '#1a1440', skyTop: '#05040f', fog: [45, 120], groundA: '#23232e', groundB: '#2b2b38', edge: '#3a3a4a', hill: '#1a1a24',
    road: ['#16161e', '#2a2a36', '#34343f', '#ffd24a'], sun: ['#a0b4ff', 1.3], amb: 0.45,
    hemi: ['#6a5aff', '#101018', 0.8], exposure: 1.2, decor: 'lamp', rock: '#3a3a48', fx: 'rain',
    pools: { color: '#3aa0ff', color2: '#ff3d9f', glow: true, n: 5 }, landmark: 'city', stars: true,
  },
  // Season 2
  jungle: {
    sky: '#bfe3c8', skyTop: '#3f8f6a', fog: [48, 125], groundA: '#3f7a3a', groundB: '#57924a', edge: '#6a5a3a', hill: '#4a6a3a',
    road: ['#5e4a30', '#7f6440', '#8c7048', '#6e5636'], sun: ['#fff0c8', 2.4], amb: 0.55,
    hemi: ['#d8f0d0', '#2a4a20', 0.75], exposure: 1.05, decor: 'pine', rock: '#6a7a6a', fx: 'spores',
    pools: { color: '#3f9f8a', color2: '#6fc4a8', glow: false, n: 4 }, landmark: 'mushrooms', flowers: true,
  },
  storm: {
    sky: '#6a7a8a', skyTop: '#2a3444', fog: [40, 110], groundA: '#4a5a4a', groundB: '#566656', edge: '#3a3a34', hill: '#44504a',
    road: ['#3a3a3a', '#555552', '#5f5f5a', '#8a8a80'], sun: ['#c8d4ff', 1.7], amb: 0.5,
    hemi: ['#9aaacc', '#1a2020', 0.7], exposure: 1.1, decor: 'deadtree', rock: '#5a606a', fx: 'rain',
    pools: { color: '#2a4a6a', color2: '#4a7a9a', glow: false, n: 3 }, landmark: 'mesas',
  },
};

export const MAPS = [
  {
    id: 'valley', name: 'Green Valley', sub: 'One winding road. Learn the ropes.', theme: 'grass',
    waves: 8, bosses: [5, 8], hpScale: 0.9, intro: 0, budget: 0.8, startBonus: 50,
    roads: [[[-28, -15], [-14, -16], [0, -14], [12, -11], [16, -5], [10, 0], [-4, 1], [-14, 4], [-17, 10], [-10, 15], [4, 15], [15, 14], [23, 15]]],
  },
  {
    id: 'dunes', name: 'Dune Sea', sub: 'A long zig-zag through the sand.', theme: 'desert',
    waves: 10, bosses: [5, 10], hpScale: 1.1, intro: 1,
    roads: [[[-28, 15], [-20, 5], [-24, -6], [-14, -15], [-4, -8], [-6, 4], [2, 13], [12, 8], [10, -4], [16, -14], [24, -8], [25, 4], [20, 12]]],
  },
  {
    id: 'frost', name: 'Frostbite Pass', sub: 'Two roads merge before your base.', theme: 'snow',
    waves: 12, bosses: [6, 12], hpScale: 1.1, intro: 2,
    roads: [
      [[-28, -17], [-20, -10], [-27, -4], [-14, -5], [-10, -15], [0, -16], [4, -8], [-2, -3], [8, -1], [16, 0], [24, 0]],
      [[-28, 17], [-20, 10], [-27, 4], [-14, 5], [-10, 15], [0, 16], [4, 8], [-2, 3], [8, 1], [16, 0], [24, 0]],
    ],
  },
  {
    id: 'canyon', name: 'Red Canyon', sub: 'Tight switchbacks between the mesas.', theme: 'canyon',
    waves: 12, bosses: [6, 12], hpScale: 1.2, intro: 3,
    roads: [[[-28, 0], [-20, -12], [-10, -4], [-14, 10], [-2, 15], [4, 2], [0, -12], [12, -16], [20, -6], [12, 6], [20, 14], [26, 8]]],
  },
  {
    id: 'swamp', name: 'Toxic Swamp', sub: 'Two long roads through the bog. Phantoms lurk.', theme: 'swamp',
    waves: 14, bosses: [8, 14], hpScale: 1.15, intro: 4, budget: 0.88, startBonus: 60,
    roads: [
      [[-28, -17], [-14, -10], [-22, -2], [-8, 2], [-4, -10], [8, -14], [10, -4], [20, -4], [24, 4]],
      [[-28, 17], [-12, 16], [-18, 8], [-4, 10], [6, 16], [12, 8], [8, 2], [18, 2], [24, 4]],
    ],
  },
  {
    id: 'magma', name: 'Magma Core', sub: 'A spiral into the volcano. Bosses everywhere.', theme: 'magma',
    waves: 15, bosses: [5, 10, 15], hpScale: 1.3, intro: 5,
    roads: [[[-28, -17], [-10, -17], [10, -17], [24, -13], [26, 0], [22, 13], [6, 17], [-12, 17], [-24, 10], [-24, -4], [-14, -8], [2, -8], [12, -2], [10, 7], [-2, 8], [-8, 2]]],
  },
  {
    id: 'neon', name: 'Neon Ruins', sub: 'Night assault on a ruined city. Three gates, one base.', theme: 'neon',
    waves: 18, bosses: [8, 13, 18], hpScale: 1.2, intro: 6, budget: 0.75,
    roads: [
      [[-28, -17], [-16, -17], [-16, -10], [-25, -10], [-25, -3], [-12, -3], [-8, -10], [-2, -6], [2, 0]],
      [[-28, 17], [-16, 17], [-16, 10], [-25, 10], [-25, 3], [-12, 3], [-8, 10], [-2, 6], [2, 0]],
      [[27, 17], [18, 17], [18, 8], [26, 8], [26, -2], [16, -2], [16, -12], [8, -12], [6, -4], [2, 0]],
    ],
  },
  // Season 2 · Storm Front
  {
    id: 'jungle', name: 'Jungle Delta', sub: 'Two rivers of enemies braid through the jungle. Aegis Priests shield the swarm.', theme: 'jungle', season: 2,
    waves: 16, bosses: [8, 16], hpScale: 1.25, intro: 7, budget: 0.8,
    roads: [
      [[-28, -16], [-18, -12], [-20, -2], [-10, 2], [-4, -8], [6, -10], [10, -2], [4, 6], [12, 12], [22, 10]],
      [[-28, 16], [-16, 14], [-8, 10], [4, 6], [12, 12], [22, 10]],
    ],
  },
  {
    id: 'storm', name: 'Storm Coast', sub: 'Rain, lightning and a long cliff road. The season finale.', theme: 'storm', season: 2,
    waves: 20, bosses: [7, 14, 20], hpScale: 1.3, intro: 8, budget: 0.8,
    roads: [[[-28, 0], [-20, -12], [-8, -15], [0, -6], [-8, 2], [-16, 8], [-10, 15], [2, 14], [8, 4], [16, -6], [24, -14], [26, -2], [20, 8], [26, 15]]],
  },
];
