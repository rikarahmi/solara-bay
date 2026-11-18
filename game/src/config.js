// Solara Bay — static tuning, city layout and mission script.
// Every name, character, district and vehicle here is original.
// The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate.
export const STEP = 1 / 60;

export const WORLD = {
  bound: 270, // playable city half-size (metres); beach + sea lie east of it
  roadGap: 60, // distance between parallel roads
  roadWidth: 14,
  roads: [-240, -180, -120, -60, 0, 60, 120, 180, 240],
  beachX: 272, // sand starts here
  seaX: 330, // water starts here
  seed: 1,
};

export const DISTRICTS = [
  { name: 'Coral Plaza', x: 0, z: 0 },
  { name: 'Marina Row', x: 300, z: 120 },
  { name: 'Old Market', x: -120, z: -60 },
  { name: 'Harbor Yard', x: -180, z: 240 },
  { name: 'Lighthouse Point', x: 300, z: -240 },
  { name: 'Palm Heights', x: 120, z: -180 },
  { name: 'Sunset Strip', x: 0, z: 180 },
];

export const PALETTE = {
  skyTop: 0x2b1a52,
  skyMid: 0xff7a3c,
  skyLow: 0xffc46b,
  fog: 0xe88a58,
  sun: 0xffd27a,
  ground: 0x776f60,
  road: 0x3c3a42,
  sidewalk: 0xa89c8b,
  sand: 0xe0c188,
  sea: 0x1d6f8f,
  seaDeep: 0x14506b,
};

export const CAR_COLORS = [
  0xc23b2e, 0x2e6fc2, 0xe8b93b, 0x3fae6a, 0x8a5fc2, 0xe8e4da,
  0x22242a, 0xd97b2e, 0x4fb3c2, 0xb03a6e, 0x7a8a3a, 0x5a6e8a,
];

export const PED_SHIRTS = [
  0xe8e4da, 0x3fae6a, 0xc23b2e, 0x2e6fc2, 0xe8b93b, 0x8a5fc2, 0xd97b2e, 0x4fb3c2,
];

// Missions: a five-job story arc for Dario Solis, a driver new in Solara Bay.
// Each mission is a list of objectives; the game advances one at a time.
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'Mission 1 — First Wheels',
    contact: 'Lena Marlowe',
    briefing: 'New in town, driver? Prove it. Take any parked car and bring it to Coral Plaza. Nobody here locks their doors.',
    reward: 200,
    objectives: [
      { type: 'stealCar', text: 'Steal a parked car (walk close and press E)' },
      { type: 'driveTo', x: 0, z: 0, r: 12, text: 'Drive to Coral Plaza' },
    ],
  },
  {
    id: 'sunset-courier',
    title: 'Mission 2 — Sunset Courier',
    contact: 'Lena Marlowe',
    briefing: 'A package is waiting at Old Market. Grab it on foot, then drive it to Marina Row before the sun drops. Ninety seconds.',
    reward: 350,
    objectives: [
      { type: 'onFootTo', x: -120, z: -60, r: 8, text: 'Walk to the market stall and press E to grab the package' },
      { type: 'driveTo', x: 300, z: 120, r: 12, text: 'Deliver the package to Marina Row', timer: 90 },
    ],
  },
  {
    id: 'heat-check',
    title: 'Mission 3 — Heat Check',
    contact: 'Otto Rey',
    briefing: 'The Bay PD needs to learn your name, then forget it. Get two stars of heat, then lose them. No jail, no hospital.',
    reward: 400,
    objectives: [
      { type: 'gainHeat', stars: 2, text: 'Raise your wanted level to 2 stars (steal a car, hit something)' },
      { type: 'loseHeat', text: 'Lose the heat — get back to 0 stars' },
    ],
  },
  {
    id: 'harbor-lights',
    title: 'Mission 4 — Harbor Lights',
    contact: 'Lena Marlowe',
    briefing: 'A crate came in at Harbor Yard. Pick it up on foot, then run it up to Lighthouse Point. The harbour master looks the other way — for a price.',
    reward: 500,
    objectives: [
      { type: 'onFootTo', x: -180, z: 240, r: 8, text: 'Walk to the crate at Harbor Yard and press E' },
      { type: 'driveTo', x: 300, z: -240, r: 12, text: 'Drive the crate to Lighthouse Point', timer: 120 },
    ],
  },
  {
    id: 'bay-finale',
    title: 'Mission 5 — Bay Finale',
    contact: 'Otto Rey',
    briefing: 'Last job. The whole department is on you — four stars. Reach the lighthouse lookout and you are a legend of Solara Bay. Get caught and you are a footnote.',
    reward: 800,
    objectives: [
      { type: 'escape', x: 300, z: -240, r: 12, text: 'Reach Lighthouse Point with 4 stars on you', timer: 150 },
    ],
  },
];

export const TUNING = {
  walkSpeed: 6,
  runSpeed: 10,
  playerAccel: 26,
  playerMaxSpeed: 34,
  playerReverseSpeed: 12,
  playerTurn: 2.1,
  trafficSpeed: 10,
  trafficCount: 14,
  pedCount: 22,
  parkedCount: 16,
  maxPolice: 4,
  wantedDecayIdle: 25, // seconds with no crime before stars start falling
  wantedDecayStep: 8, // seconds per star once decaying
  playerHealth: 100,
  healthRegen: 3, // per second after 5 s without damage
  punchRange: 2.2,
  punchDamage: 34,
  shotRange: 55,
  shotDamage: 50,
  shotCooldown: 0.35,
  bustDistance: 3.2,
  bustTime: 1.5,
  saveKey: 'solara-bay-save-v1',
};
