// Static game data: turret types, maps, themes, perks, upgrade rules.

export const TURRETS = {
  cannon: {
    name: 'Twin Cannon', cost: 100, unlockTP: 0, color: '#f0a020',
    desc: 'Balanced twin shells. Reliable all-rounder.',
    range: 11.5, interval: 1.2, damage: 12, shots: 2, speed: 55, kind: 'shell',
    manual: { interval: 0.5, damage: 17, heat: 12, speed: 120 }, fov: 75,
  },
  gatling: {
    name: 'Gatling', cost: 120, unlockTP: 2, color: '#46d46a',
    desc: 'Shreds swarms at short range. Hold FIRE to spin up.',
    range: 9, interval: 0.14, damage: 4, shots: 1, speed: 75, kind: 'bullet', spread: 0.035,
    manual: { interval: 0.1, damage: 5, heat: 2.4, speed: 130 }, fov: 75,
  },
  rocket: {
    name: 'Rocket Pod', cost: 175, unlockTP: 4, color: '#ff4a3a',
    desc: 'Long-range homing rockets with splash damage.',
    range: 15, interval: 2.4, damage: 40, shots: 2, speed: 22, kind: 'rocket', splash: 3.0, homing: 3.5,
    manual: { interval: 1.0, damage: 55, heat: 20, speed: 42, splash: 3.2 }, fov: 75,
  },
  tesla: {
    name: 'Tesla Coil', cost: 200, unlockTP: 6, color: '#b46bff',
    desc: 'Lightning chains between enemies and slows them.',
    range: 8.5, interval: 0.9, damage: 20, shots: 1, kind: 'zap', chain: 3, slow: 1.0,
    manual: { interval: 0.6, damage: 26, heat: 14, chain: 3 }, fov: 75,
  },
  rail: {
    name: 'Railgun', cost: 250, unlockTP: 8, color: '#4fc3ff',
    desc: 'Pierces every enemy in a line. Zoom scope in FPV.',
    range: 22, interval: 3.0, damage: 130, shots: 1, kind: 'rail',
    manual: { interval: 2.0, damage: 160, heat: 34 }, fov: 42,
  },
};
export const TURRET_ORDER = ['cannon', 'gatling', 'rocket', 'tesla', 'rail'];

// Manual control is ~1.7–2× an auto turret's DPS (faster + harder hitting), plus weak points.
export const WEAK_MULT = 1.75;

export const UPGRADE = { maxLevel: 3, dmg: 0.45, range: 0.1, rate: 0.12, costFactor: 0.75, sell: 0.6 };

export const PERKS = [
  { id: 'gold', name: 'War Chest', desc: '+30 starting gold', max: 3 },
  { id: 'armor', name: 'Reinforced Base', desc: '+25 base HP', max: 3 },
  { id: 'crit', name: 'Gunner Training', desc: '+15% manual damage', max: 3 },
  { id: 'cooling', name: 'Heat Sinks', desc: '−15% barrel heat', max: 3 },
  { id: 'servo', name: 'Servo Motors', desc: '+8% auto fire rate', max: 3 },
  { id: 'bounty', name: 'Bounty Hunter', desc: '+10% kill gold', max: 3 },
];

export const THEMES = {
  grass: {
    sky: '#a9cfe8', fog: [70, 150], groundA: '#5d8a3a', groundB: '#7aa04a', edge: '#8a7350', hill: '#6b7a5a',
    road: ['#6e5a3f', '#9b7a4f', '#a68457', '#7f6443'], sun: ['#fff1d6', 2.6], amb: 0.55,
    hemi: ['#cfe6ff', '#4a5a30', 0.7], exposure: 1.05, decor: 'pine', rock: '#8d9099', fx: null,
  },
  desert: {
    sky: '#efd2a2', fog: [55, 135], groundA: '#d6b173', groundB: '#e4c48a', edge: '#b48a55', hill: '#c28d55',
    road: ['#8e6c42', '#ae8552', '#bb925c', '#96714a'], sun: ['#ffe2b0', 2.9], amb: 0.5,
    hemi: ['#ffe9c7', '#8a6a3a', 0.6], exposure: 1.0, decor: 'cactus', rock: '#b0845a', fx: 'dust',
  },
  snow: {
    sky: '#c7d9ea', fog: [50, 125], groundA: '#dfe8ef', groundB: '#cfdbe6', edge: '#aab6c2', hill: '#eef3f8',
    road: ['#6f7b88', '#8d99a6', '#9da8b4', '#7c8794'], sun: ['#ffffff', 2.1], amb: 0.6,
    hemi: ['#e6f2ff', '#8a98a8', 0.7], exposure: 0.92, decor: 'snowpine', rock: '#7f8c99', fx: 'snow',
  },
  magma: {
    sky: '#2a1216', fog: [40, 110], groundA: '#2d2427', groundB: '#3b2f2f', edge: '#4d2a1c', hill: '#1d1719',
    road: ['#35251f', '#56392a', '#664230', '#472d22'], sun: ['#ffa27a', 1.7], amb: 0.4,
    hemi: ['#ff8a5a', '#200808', 0.7], exposure: 1.15, decor: 'obsidian', rock: '#3a3035', fx: 'embers', lava: true,
  },
};

export const MAPS = [
  {
    id: 'valley', name: 'Green Valley', sub: 'One winding road. Learn the ropes.', theme: 'grass',
    waves: 8, bosses: [5, 8], hpScale: 1,
    roads: [[[-28, -15], [-14, -16], [0, -14], [12, -11], [16, -5], [10, 0], [-4, 1], [-14, 4], [-17, 10], [-10, 15], [4, 15], [15, 14], [23, 15]]],
  },
  {
    id: 'dunes', name: 'Dune Sea', sub: 'A long zig-zag through the sand.', theme: 'desert',
    waves: 10, bosses: [5, 10], hpScale: 1.15,
    roads: [[[-28, 15], [-20, 5], [-24, -6], [-14, -15], [-4, -8], [-6, 4], [2, 13], [12, 8], [10, -4], [16, -14], [24, -8], [25, 4], [20, 12]]],
  },
  {
    id: 'frost', name: 'Frostbite Pass', sub: 'Two roads merge before your base.', theme: 'snow',
    waves: 12, bosses: [6, 12], hpScale: 1.1,
    roads: [
      [[-28, -16], [-18, -8], [-8, -16], [2, -10], [-3, -3], [8, -1], [16, 0], [24, 0]],
      [[-28, 16], [-18, 8], [-8, 16], [2, 10], [-3, 3], [8, 1], [16, 0], [24, 0]],
    ],
  },
  {
    id: 'magma', name: 'Magma Core', sub: 'A spiral into the volcano. Bosses everywhere.', theme: 'magma',
    waves: 15, bosses: [5, 10, 15], hpScale: 1.3,
    roads: [[[-28, -17], [-10, -17], [10, -17], [24, -13], [26, 0], [22, 13], [6, 17], [-12, 17], [-24, 10], [-24, -4], [-14, -8], [2, -8], [12, -2], [10, 7], [-2, 8], [-8, 2]]],
  },
];
