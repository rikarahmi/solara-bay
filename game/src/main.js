// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. Screens: title,
// playing, paused, win and lose. ?shot=start|drive|chase|mission stages one
// fixed scene instead of running the loop, paints it twice and sets
// window.__SOLARA_READY__ for a screenshot.
import * as THREE from 'three';
import { STEP, WORLD, TUNING, MISSIONS } from './config.js';
import { createRng } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createTraffic, createParkedCars } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer, updatePlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createRender } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : WORLD.seed;

const canvas = document.getElementById('game');
const render = createRender(canvas);
const scene = render.scene;
const rng = createRng(seed);
const input = createInput(canvas);
const audio = createAudio();
if (shot) audio.enabled = false;

const city = buildCity(scene, rng);
const traffic = createTraffic(scene, rng, city.colliders);
const parked = createParkedCars(scene, rng, city.colliders);
const peds = createPedestrians(scene, rng, city.colliders);
const player = createPlayer(scene);
const police = createPolice(scene, rng, city.colliders);
const missions = createMissions(scene);
const hud = createHud();

const w = {
  input, audio, hud, render, city, traffic, parked,
  peds: peds.peds, pedsKnockDown: peds.knockDown,
  player, police, missions,
  phase: 'title',
  time: 0,
  cash: 0,
  pressedE: false,
  prevE: false,
  muted: false,
  nextMissionAt: 0,
  get camYaw() { return render.camYaw; },
  crime(kind) { police.addCrime(kind, w.time); },
  toast(msg) { hud.toast(msg); },
  saveGame,
  startGame,
};

function readSave() {
  try {
    const raw = window.localStorage.getItem(TUNING.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveGame() {
  try {
    // A finished mission saves as the NEXT one, so Continue never replays
    // a job already done; finishing the last one saves as free roam.
    const next = missions.index + (missions.done ? 1 : 0);
    window.localStorage.setItem(TUNING.saveKey, JSON.stringify({
      missionIndex: next, cash: w.cash,
    }));
  } catch { /* storage can be off; the game still plays */ }
}

function resetWorld() {
  player.x = 0;
  player.z = 14;
  player.heading = 0;
  player.onFoot = true;
  player.car = null;
  player.health = TUNING.playerHealth;
  player.lastHurt = -99;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = 0;
  police.clear(scene);
  render.camYaw = Math.PI;
  render.camPitch = 0.32;
  w.time = 0;
  w.nextMissionAt = 0;
}

function startGame(missionIndex) {
  resetWorld();
  missions.start(missionIndex);
  w.phase = 'playing';
  hud.showPlaying();
  hud.hideBanner();
  const m = MISSIONS[missionIndex];
  if (m) hud.toast(`${m.title} — ${m.contact}: ${m.briefing}`);
  audio.init();
}

function endGame(win, title, text) {
  w.phase = win ? 'win' : 'lose';
  hud.showEnd(win, title, text);
  audio.engine(0, false);
  audio.siren(false);
  if (win) audio.missionDone();
  else audio.busted();
  saveGame();
}

function step(dt) {
  w.time += dt;
  w.pressedE = input.down('KeyE') && !w.prevE;
  w.prevE = input.down('KeyE');
  city.update(dt, w.time);
  traffic.update(dt, player.car);
  peds.update(dt, w.time);
  missions.animate(dt, w.time);

  if (w.phase !== 'playing') return;

  const look = input.consumeLook();
  render.applyLook(look.dx, look.dy);

  updatePlayer(player, dt, {
    input, camYaw: render.camYaw, colliders: city.colliders,
    parked, traffic: traffic.cars, police: police.cars, peds: peds.peds,
    pedsKnockDown: peds.knockDown, audio,
    crime: (k) => police.addCrime(k, w.time),
    toast: (m) => hud.toast(m),
    time: w.time,
  });

  // Health regen after 5 s without damage.
  if (w.time - player.lastHurt > 5 && player.health > 0) {
    player.health = Math.min(TUNING.playerHealth, player.health + TUNING.healthRegen * dt);
  }

  const busted = police.update(dt, w.time, player, traffic.cars);
  audio.siren(police.cars.length > 0);
  if (busted) {
    endGame(false, 'BUSTED', 'The Bay PD caught you on foot. The story ends in a cell.');
    return;
  }
  if (player.health <= 0) {
    endGame(false, 'WASTED', 'Dario Solis went down in Solara Bay. The city moves on without him.');
    return;
  }

  const missionEvent = missions.update(dt, w);
  if (missionEvent === 'failed') {
    hud.toast('Mission failed — the clock ran out. Try it again.');
    audio.busted();
    missions.start(missions.index);
  } else if (missionEvent === 'complete') {
    if (missions.index + 1 < MISSIONS.length) {
      w.nextMissionAt = w.time + 2;
    } else {
      endGame(true, 'SOLARA BAY COMPLETE', `All five jobs done. Dario Solis is a legend of the bay — $${w.cash.toLocaleString('en-US')} richer.`);
      return;
    }
  }
  if (w.nextMissionAt > 0 && w.time >= w.nextMissionAt) {
    w.nextMissionAt = 0;
    missions.next();
    const m = MISSIONS[missions.index];
    if (m) hud.toast(`${m.title} — ${m.contact}: ${m.briefing}`);
  }

  hud.update(w);
  hud.tick(dt);
}
w.step = step;

// --- screens ---------------------------------------------------------------
hud.bind();
hud.onStart = () => { try { window.localStorage.removeItem(TUNING.saveKey); } catch {} w.cash = 0; startGame(0); };
hud.onContinue = () => {
  const save = readSave();
  w.cash = save ? save.cash : 0;
  startGame(save ? save.missionIndex : 0);
};
hud.onResume = () => { w.phase = 'playing'; hud.showPause(false); };
hud.onRestart = () => startGame(missions.index);
hud.onTitle = () => { w.phase = 'title'; hud.showTitle(!!readSave()); };

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Enter' && (w.phase === 'title' || w.phase === 'win' || w.phase === 'lose')) {
    if (w.phase === 'title') hud.onContinue();
    else startGame(missions.index);
  }
  if ((e.code === 'KeyP' || e.code === 'Escape') && w.phase === 'playing') {
    w.phase = 'paused';
    hud.showPause(true);
  } else if ((e.code === 'KeyP' || e.code === 'Escape') && w.phase === 'paused') {
    w.phase = 'playing';
    hud.showPause(false);
  }
  if (e.code === 'KeyR' && (w.phase === 'playing' || w.phase === 'paused' || w.phase === 'lose')) startGame(missions.index);
  if (e.code === 'KeyM') {
    w.muted = !w.muted;
    audio.setMuted(w.muted);
    hud.toast(w.muted ? 'Sound muted' : 'Sound on');
  }
});
canvas.addEventListener('mousedown', () => {
  if (input.locked && w.phase === 'playing' && player.onFoot) player.wantShot = true;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && w.phase === 'playing') {
    w.phase = 'paused';
    hud.showPause(true);
  }
});

// --- debug handle for play tests -------------------------------------------
window.__SOLARA_DEBUG__ = {
  state() {
    return {
      phase: w.phase,
      time: +w.time.toFixed(2),
      mission: missions.index,
      missionText: missions.text(),
      missionTimer: missions.timer ? +missions.timer.toFixed(1) : 0,
      stars: police.stars,
      policeCars: police.cars.length,
      cash: w.cash,
      health: Math.round(player.health),
      onFoot: player.onFoot,
      px: +player.x.toFixed(1),
      pz: +player.z.toFixed(1),
      speed: player.car ? +player.car.speed.toFixed(1) : 0,
      traffic: traffic.cars.length,
      peds: peds.peds.length,
      pedsDown: peds.peds.filter((p) => p.down > 0).length,
      parked: parked.length,
    };
  },
  world: w,
  teleport(x, z) { player.x = x; player.z = z; player.mesh.position.set(x, 0, z); },
  setStars(n) { police.setStars(n, w.time); },
  start: startGame,
};

// --- run --------------------------------------------------------------------
if (shot) {
  const screen = stageShot(shot, w);
  if (screen === 'title') hud.showTitle(false);
  else hud.showPlaying();
  hud.update(w);
  let painted = 0;
  (function paint() {
    render.draw();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__SOLARA_READY__ = true;
  }());
} else {
  hud.showTitle(!!readSave());
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += frameDt;
    last = now;
    if (w.phase === 'playing') {
      while (accumulator >= STEP) {
        step(STEP);
        accumulator -= STEP;
      }
      render.update(STEP, player, w.time);
    } else if (w.phase === 'title') {
      w.time += frameDt;
      // Attract mode: the city lives behind the title.
      traffic.update(STEP, null);
      peds.update(STEP, w.time);
      city.update(STEP, w.time);
      render.titleCamera(w.time);
    }
    if (w.phase === 'paused' || w.phase === 'win' || w.phase === 'lose') {
      render.update(STEP, player, w.time);
    }
    render.draw();
  }
  requestAnimationFrame(frame);
}

export { w };
