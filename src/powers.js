// Turret powers — Tactics (active, 3 uses per match), Traits (passive), Mods (2 chip slots)
// and Overload (a reactor mode charged by kills). Internally still called gadget/star/gear/hyper. Unlocked by turret level (cards), bought with coins.

export const GADGETS = {
  overdrive: { name: 'Overdrive', desc: 'Double fire rate for 5 s — and no heat builds up meanwhile.', color: '#ff9a3a' },
  nova: { name: 'Nova Blast', desc: 'Shockwave (7 m or more) deals 5× damage and staggers everything it hits.', color: '#ffcf5a' },
  barrage: { name: 'Missile Barrage', desc: 'Launches 6 homing missiles at enemies in range.', color: '#ff5a3a' },
  frostnova: { name: 'Frost Nova', desc: 'Freezes every enemy in range for 2.5 s.', color: '#8fe3ff' },
  reveal: { name: 'Target Painter', desc: 'Reveals cloaked enemies in range and marks them: +40% damage taken for 8 s.', color: '#ff3d7f' },
  coolant: { name: 'Coolant Flush', desc: 'Heat to zero, no heat and +20% fire rate for 6 s.', color: '#4fc3ff' },
  snipe: { name: 'Precision Shot', desc: 'Instantly hits the strongest enemy on the map for 6× damage.', color: '#e8e0c8' },
  slowfield: { name: 'Stasis Field', desc: 'Slows enemies in range by 60% for 5 s.', color: '#b46bff' },
};

// Tailored tactics: each turret's second tactic is its own. `fx` is a timed stat buff (same keys as
// Overload), `act` an instant effect handled in main.js useGadget.
const U = (name, desc, color, extra) => ({ name, desc, color, ...extra });
export const UNIQUE_TACTICS = {
  cannon: U('Twin Salvo', 'For 6 s both barrels fire every shot and hit 60% harder.', '#f0a020', { fx: { shots: 1, dmg: 0.6 }, dur: 6 }),
  gatling: U('Tracer Belt', 'For 6 s every bullet sets its target on fire (+15 burn/s).', '#ff8a3a', { fx: { burn: 15, rate: 0.3 }, dur: 6 }),
  sniper: U('Hollow Point', 'For 6 s shots deal double damage and pierce 3 enemies.', '#e8e0c8', { fx: { dmg: 1, pierce: 3 }, dur: 6 }),
  scatter: U("Dragon's Breath", 'For 6 s pellets ignite (+12 burn/s) and spread flames on impact.', '#ff5a1a', { fx: { burn: 12, splash: 1 }, dur: 6 }),
  cryo: U('Absolute Zero', 'Freezes everything in range for 3 s; frozen enemies under 35% health shatter.', '#bff4ff', { act: 'zero' }),
  venom: U('Toxic Cloud', 'A poison cloud on the road nearest the enemies: 30 damage/s and 40% slow for 7 s.', '#8fe04a', { act: 'cloud' }),
  flame: U('Napalm Wall', 'A 10 m strip of burning road in front of the turret for 8 s.', '#ff4a1a', { act: 'napalm' }),
  bouncer: U('Pinball', 'For 7 s every grenade splits into 3 bouncing bomblets.', '#c8a040', { fx: { cluster: 3 }, dur: 7 }),
  rocket: U('Cluster Swarm', 'For 6 s rockets burst into 3 bomblets and fire one extra rocket.', '#ff4a3a', { fx: { cluster: 3, shots: 1 }, dur: 6 }),
  minelayer: U('Minefield', 'Instantly lays 6 armed mines along the road in range.', '#7affd8', { act: 'minefield' }),
  harpoon: U('Deep Hook', 'Drags every enemy in range 7 m back along the road and stuns them for 1 s.', '#5aa0c8', { act: 'pull' }),
  mortar: U('Carpet Shelling', '10 shells walk down the road through the whole range.', '#b0a070', { act: 'carpet' }),
  sonic: U('Shockwave', 'Pushes enemies in range 5 m back and staggers them for 1.5 s.', '#ff66cc', { act: 'push' }),
  tesla: U('Storm Grid', 'For 6 s lightning jumps to 4 extra enemies and stuns more often.', '#b46bff', { fx: { chain: 4, stun: 0.25 }, dur: 6 }),
  plasma: U('Sun Core', 'For 6 s orbs blow up twice as wide and hit 50% harder.', '#6af0ff', { fx: { splash: 2, dmg: 0.5 }, dur: 6 }),
  laser: U('Focus Lens', 'For 6 s the beam heats up three times faster and deals +50%.', '#ff3d7f', { fx: { ramp: 2, dmg: 0.5 }, dur: 6 }),
  storm: U('Thunderstorm', '12 lightning bolts rain on enemies in range over 3 s.', '#9ab0ff', { act: 'thunder' }),
  rail: U('Overcharge', 'For 5 s rails deal 150% more damage and pierce everything.', '#4fc3ff', { fx: { dmg: 1.5, pierce: 20 }, dur: 5 }),
  silo: U('Warhead', 'Launches one heavy missile at the strongest enemy in range: huge blast.', '#ff5a3a', { act: 'warhead' }),
  prism: U('Refraction', 'For 6 s the beam splits to 2 extra targets.', '#ffe066', { fx: { beams: 2 }, dur: 6 }),
  howitzer: U('Bunker Buster', 'For 6 s shells hit 2.2× as hard and stun for 1 s.', '#8a9a6a', { fx: { dmg: 1.2, stun: 0.6 }, dur: 6 }),
  barracks: U('Reinforcements', 'Drops a full squad on the enemy closest to the base.', '#6ab04c', { act: 'deploy' }),
  helipad: U('Air Drop', 'A gunship sweeps to the enemy closest to the base.', '#8fd0ff', { act: 'deploy' }),
  factory: U('Armoured Push', 'Sends a tank straight to the enemy closest to the base.', '#b8a070', { act: 'deploy' }),
};
for (const [t, u] of Object.entries(UNIQUE_TACTICS)) GADGETS[`u_${t}`] = u;

export const STAR_POWERS = {
  headhunter: { name: 'Headhunter', desc: '+50% headshot damage.' },
  bounty: { name: 'Bounty', desc: '+3 gold per kill from this turret.' },
  ricochet: { name: 'Ricochet', desc: 'Hits bounce to a nearby enemy for 50% damage.' },
  explosive: { name: 'Volatile Kills', desc: 'Enemies killed by this turret explode (2× damage, 2 m).' },
  doubletap: { name: 'Double Tap', desc: '25% of shots fire a free second shot — also when you aim.' },
  venomrounds: { name: 'Venom Rounds', desc: 'Every hit poisons: +12 damage per second for 3 s.' },
  longshot: { name: 'Long Shot', desc: '+20% range.' },
  crushing: { name: 'Crusher', desc: '+30% damage to armoured enemies and bosses.' },
};

export const GEARS = {
  damage: { name: 'Damage Mod', desc: '+15% damage', fx: { dmg: 0.15 }, color: '#ff5a3a' },
  speed: { name: 'Rate Mod', desc: '+15% fire rate', fx: { rate: 0.15 }, color: '#ffcf5a' },
  range: { name: 'Optics Mod', desc: '+12% range', fx: { range: 0.12 }, color: '#4fc3ff' },
  cooling: { name: 'Cryo Mod', desc: '−30% heat per shot', fx: { heat: 0.3 }, color: '#8fe3ff' },
  gold: { name: 'Salvage Mod', desc: '+3 gold per kill', fx: { bounty: 3 }, color: '#ffc62e' },
  pierce: { name: 'Pierce Mod', desc: 'Projectiles pierce +1', fx: { pierce: 1 }, color: '#e8e0c8' },
  crit: { name: 'Crit Mod', desc: '+12% chance of double damage', fx: { crit: 0.12 }, color: '#ff3d9f' },
  vision: { name: 'Sensor Mod', desc: 'Detects cloaked enemies', fx: { detect: 1 }, color: '#7affc0' },
};
export const GEAR_ORDER = Object.keys(GEARS);

// per turret: [gadget A, gadget B], [star power A, star power B], hypercharge
const P = (g, s, hname, hfx) => ({ gadgets: g, stars: s, hyper: { name: hname, fx: hfx } });
export const TURRET_POWERS_BASE = {
  cannon: P(['overdrive', 'reveal'], ['explosive', 'crushing'], 'Siege Mode', { splash: 2, shots: 1 }),
  gatling: P(['overdrive', 'coolant'], ['doubletap', 'bounty'], 'Bullet Hell', { shots: 2, pierce: 1 }),
  sniper: P(['snipe', 'reveal'], ['headhunter', 'longshot'], 'Deadshot', { pierce: 3, crit: 0.3 }),
  scatter: P(['nova', 'overdrive'], ['doubletap', 'ricochet'], 'Buckshot Frenzy', { shots: 5 }),
  cryo: P(['frostnova', 'slowfield'], ['ricochet', 'crushing'], 'Ice Age', { freeze: 0.4, splash: 1.5 }),
  venom: P(['slowfield', 'reveal'], ['venomrounds', 'ricochet'], 'Plague', { burn: 18, splash: 1.5 }),
  flame: P(['nova', 'coolant'], ['venomrounds', 'explosive'], 'Inferno', { burn: 20, range: 0.3 }),
  bouncer: P(['barrage', 'nova'], ['explosive', 'doubletap'], 'Cluster Party', { cluster: 3 }),
  rocket: P(['barrage', 'overdrive'], ['explosive', 'longshot'], 'Rocket Rain', { shots: 3, cluster: 3 }),
  minelayer: P(['slowfield', 'nova'], ['ricochet', 'bounty'], 'Storm Carpet', { shots: 3, chain: 2 }),
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
  carrier: P(['barrage', 'reveal'], ['longshot', 'explosive'], 'Air Strike Package', { rate: 0.8, splash: 2 }),
  helipad: P(['barrage', 'reveal'], ['longshot', 'bounty'], 'Air Superiority', { rate: 0.8, dmg: 0.4 }),
};

// unlock levels and coin prices
export const POWER_UNLOCK = { gadget: 3, star: 6, gear1: 7, gear2: 9, hyper: 10 };
export const POWER_PRICE = { gadget: 400, star: 1200, gear: 700, hyper: 2500 };
export const HYPER_KILLS = 14;        // kills to fill the meter (manual kills count double)
export const HYPER_TIME = 8;          // seconds
export const GADGET_USES = 3;
export const GADGET_CD = 12;

// Every turret's tactic B is its tailored one.
export const TURRET_POWERS = Object.fromEntries(Object.entries(TURRET_POWERS_BASE).map(([t, p]) => [t, UNIQUE_TACTICS[t] ? { ...p, gadgets: [p.gadgets[0], `u_${t}`] } : p]));
