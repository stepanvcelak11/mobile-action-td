// Turret powers — Tactics (active, 3 uses per match), Traits (passive), Mods (2 chip slots)
// and Overload (a reactor mode charged by kills). Internally still called gadget/star/gear/hyper. Unlocked by turret level (cards), bought with coins.

export const GADGETS = {
  overdrive: { name: 'Overdrive', desc: 'Doubles fire rate for 5 s.', color: '#ff9a3a' },
  nova: { name: 'Nova Blast', desc: 'A shockwave around the turret deals 4× damage.', color: '#ffcf5a' },
  barrage: { name: 'Missile Barrage', desc: 'Launches 6 homing missiles at enemies in range.', color: '#ff5a3a' },
  frostnova: { name: 'Frost Nova', desc: 'Freezes every enemy in range for 2.5 s.', color: '#8fe3ff' },
  reveal: { name: 'Target Painter', desc: 'Reveals and marks enemies in range: +30% damage taken for 8 s.', color: '#ff3d7f' },
  coolant: { name: 'Coolant Flush', desc: 'Resets heat and removes overheating for 6 s.', color: '#4fc3ff' },
  snipe: { name: 'Precision Shot', desc: 'Instantly hits the strongest enemy on the map for 6× damage.', color: '#e8e0c8' },
  slowfield: { name: 'Stasis Field', desc: 'Slows enemies in range by 60% for 5 s.', color: '#b46bff' },
};

export const STAR_POWERS = {
  headhunter: { name: 'Headhunter', desc: '+50% headshot damage.' },
  bounty: { name: 'Bounty', desc: '+3 gold per kill from this turret.' },
  ricochet: { name: 'Ricochet', desc: 'Hits bounce to a nearby enemy for 50% damage.' },
  explosive: { name: 'Volatile Kills', desc: 'Enemies killed by this turret explode (2× damage, 2 m).' },
  doubletap: { name: 'Double Tap', desc: '15% chance to fire twice.' },
  venomrounds: { name: 'Venom Rounds', desc: 'Hits poison enemies (+6 burn/s).' },
  longshot: { name: 'Long Shot', desc: '+20% range.' },
  crushing: { name: 'Crusher', desc: '+30% damage to armoured enemies and bosses.' },
};

export const GEARS = {
  damage: { name: 'Damage Mod', desc: '+10% damage', fx: { dmg: 0.1 }, color: '#ff5a3a' },
  speed: { name: 'Rate Mod', desc: '+10% fire rate', fx: { rate: 0.1 }, color: '#ffcf5a' },
  range: { name: 'Optics Mod', desc: '+8% range', fx: { range: 0.08 }, color: '#4fc3ff' },
  cooling: { name: 'Cryo Mod', desc: '−20% barrel heat', fx: { heat: 0.2 }, color: '#8fe3ff' },
  gold: { name: 'Salvage Mod', desc: '+2 gold per kill', fx: { bounty: 2 }, color: '#ffc62e' },
  pierce: { name: 'Pierce Mod', desc: 'Projectiles pierce +1', fx: { pierce: 1 }, color: '#e8e0c8' },
  crit: { name: 'Crit Mod', desc: '+8% crit chance', fx: { crit: 0.08 }, color: '#ff3d9f' },
  vision: { name: 'Sensor Mod', desc: 'Detects cloaked enemies', fx: { detect: 1 }, color: '#7affc0' },
};
export const GEAR_ORDER = Object.keys(GEARS);

// per turret: [gadget A, gadget B], [star power A, star power B], hypercharge
const P = (g, s, hname, hfx) => ({ gadgets: g, stars: s, hyper: { name: hname, fx: hfx } });
export const TURRET_POWERS = {
  cannon: P(['overdrive', 'reveal'], ['explosive', 'crushing'], 'Siege Mode', { splash: 2, shots: 1 }),
  gatling: P(['overdrive', 'coolant'], ['doubletap', 'bounty'], 'Bullet Hell', { shots: 2, pierce: 1 }),
  sniper: P(['snipe', 'reveal'], ['headhunter', 'longshot'], 'Deadshot', { pierce: 3, crit: 0.3 }),
  scatter: P(['nova', 'overdrive'], ['doubletap', 'ricochet'], 'Buckshot Frenzy', { shots: 5 }),
  cryo: P(['frostnova', 'slowfield'], ['ricochet', 'crushing'], 'Ice Age', { freeze: 0.4, splash: 1.5 }),
  venom: P(['slowfield', 'reveal'], ['venomrounds', 'ricochet'], 'Plague', { burn: 18, splash: 1.5 }),
  flame: P(['nova', 'coolant'], ['venomrounds', 'explosive'], 'Inferno', { burn: 20, range: 0.3 }),
  bouncer: P(['barrage', 'nova'], ['explosive', 'doubletap'], 'Cluster Party', { cluster: 3 }),
  rocket: P(['barrage', 'overdrive'], ['explosive', 'longshot'], 'Rocket Rain', { shots: 3, cluster: 3 }),
  harpoon: P(['snipe', 'slowfield'], ['headhunter', 'crushing'], 'Whaler', { pierce: 4, slow: 0.2 }),
  mortar: P(['barrage', 'slowfield'], ['crushing', 'explosive'], 'Earthshaker', { stun: 0.5, splash: 2 }),
  sonic: P(['frostnova', 'nova'], ['crushing', 'bounty'], 'Resonance', { stun: 0.4, range: 0.3 }),
  tesla: P(['nova', 'frostnova'], ['ricochet', 'bounty'], 'Superconductor', { chain: 4, stun: 0.3 }),
  plasma: P(['overdrive', 'nova'], ['explosive', 'longshot'], 'Fusion', { splash: 2, dmg: 0.4 }),
  laser: P(['coolant', 'reveal'], ['crushing', 'venomrounds'], 'Overheat Beam', { beams: 2, ramp: 1 }),
  storm: P(['nova', 'reveal'], ['ricochet', 'bounty'], 'Tempest', { chain: 3, shots: 1 }),
  rail: P(['snipe', 'overdrive'], ['headhunter', 'crushing'], 'Rail Storm', { rate: 0.8, dmg: 0.3 }),
  silo: P(['barrage', 'snipe'], ['explosive', 'crushing'], 'Armageddon', { shots: 3, splash: 1 }),
  prism: P(['coolant', 'overdrive'], ['venomrounds', 'longshot'], 'Spectrum', { beams: 3 }),
  howitzer: P(['barrage', 'slowfield'], ['crushing', 'longshot'], 'Bombardment', { shots: 2, splash: 2 }),
  barracks: P(['reveal', 'slowfield'], ['bounty', 'headhunter'], 'Rally Cry', { rate: 0.8, dmg: 0.4 }),
  factory: P(['barrage', 'reveal'], ['crushing', 'explosive'], 'Blitzkrieg', { rate: 0.8, splash: 2 }),
  helipad: P(['barrage', 'reveal'], ['longshot', 'bounty'], 'Air Superiority', { rate: 0.8, dmg: 0.4 }),
};

// unlock levels and coin prices
export const POWER_UNLOCK = { gadget: 3, star: 6, gear1: 7, gear2: 9, hyper: 10 };
export const POWER_PRICE = { gadget: 400, star: 1200, gear: 700, hyper: 2500 };
export const HYPER_KILLS = 14;        // kills to fill the meter (manual kills count double)
export const HYPER_TIME = 8;          // seconds
export const GADGET_USES = 3;
export const GADGET_CD = 12;
