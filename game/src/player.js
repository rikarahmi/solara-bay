// The player on foot: WASD movement relative to the camera, running, entering
// and leaving cars, punching and shooting. Driving itself lives in vehicles.js;
// the player just hands the car its throttle and steering.
import * as THREE from 'three';
import { TUNING } from './config.js';
import { driveCar, hitsBuilding, separateCars } from './vehicles.js';

const legGeo = new THREE.BoxGeometry(0.24, 0.8, 0.24);
const bodyGeo = new THREE.BoxGeometry(0.68, 0.9, 0.4);
const headGeo = new THREE.SphereGeometry(0.28, 10, 8);

function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xe86a1e }); // orange jacket
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2e3a });
  const body = new THREE.Mesh(bodyGeo, jacket);
  body.position.y = 1.3;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(headGeo, skin);
  head.position.y = 2.0;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 10), new THREE.MeshLambertMaterial({ color: 0x22242a }));
  cap.position.y = 2.22;
  g.add(cap);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.18, 0.45, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.18, 0.45, 0);
  g.add(legR);
  g.userData = { legL, legR };
  return g;
}

export function createPlayer(scene) {
  const mesh = makePlayerMesh();
  scene.add(mesh);
  const player = {
    mesh,
    x: 0, z: 14,
    heading: 0,
    speed: 0,
    onFoot: true,
    car: null,
    health: TUNING.playerHealth,
    lastHurt: -99,
    shotCooldown: 0,
    punchCooldown: 0,
    walkPhase: 0,
    wantShot: false,
    ePressed: false,
  };
  mesh.position.set(player.x, 0, player.z);
  return player;
}

// ctx: { input, camYaw, colliders, parked, traffic, police, peds, audio,
//        crime(kind), toast(msg), time }
export function updatePlayer(player, dt, ctx) {
  const input = ctx.input;
  player.shotCooldown = Math.max(0, player.shotCooldown - dt);
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);

  // E: enter the nearest parked car, or step out of the one being driven.
  if (input.down('KeyE') && !player.ePressed) {
    player.ePressed = true;
    if (player.onFoot) {
      let best = null;
      let bestD = 4.5;
      for (const car of ctx.parked) {
        const d = Math.hypot(car.x - player.x, car.z - player.z);
        if (d < bestD) { best = car; bestD = d; }
      }
      if (best) {
        player.onFoot = false;
        player.car = best;
        best.driver = 'player';
        best.parked = false;
        player.mesh.visible = false;
        if (!best.stolen) {
          best.stolen = true;
          ctx.crime('steal');
          ctx.toast('Car stolen — the heat is on!');
        }
        ctx.audio.click();
      }
    } else if (player.car) {
      const car = player.car;
      car.driver = 'parked';
      car.parked = true;
      car.speed = 0;
      player.x = car.x + Math.cos(car.heading) * 3;
      player.z = car.z - Math.sin(car.heading) * 3;
      player.heading = car.heading;
      player.onFoot = true;
      player.car = null;
      player.mesh.visible = true;
      player.mesh.position.set(player.x, 0, player.z);
      ctx.audio.click();
    }
  }
  if (!input.down('KeyE')) player.ePressed = false;

  if (!player.onFoot && player.car) {
    const car = player.car;
    const fwd = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
    const steer = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0) - (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
    const before = car.speed;
    driveCar(car, dt, fwd, steer, ctx.colliders, TUNING.playerMaxSpeed);
    if (Math.abs(before) > 12 && Math.abs(car.speed) < 4) ctx.audio.crash();
    ctx.audio.engine(Math.abs(car.speed) / TUNING.playerMaxSpeed, true);
    for (const other of ctx.traffic) {
      if (separateCars(car, other)) ctx.audio.crash();
    }
    for (const cop of ctx.police) separateCars(car, cop);
    // Running over a pedestrian is a serious crime.
    for (const p of ctx.peds) {
      if (p.down > 0) continue;
      if (Math.hypot(p.x - car.x, p.z - car.z) < 2.4 && Math.abs(car.speed) > 3) {
        ctx.pedsKnockDown(p);
        ctx.crime('runover');
        ctx.toast('You ran over a pedestrian!');
      }
    }
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    return;
  }
  ctx.audio.engine(0, false);

  // On foot: move relative to the camera yaw.
  const fwd = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
  const strafe = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = run ? TUNING.runSpeed : TUNING.walkSpeed;
  const mx = Math.sin(ctx.camYaw) * fwd + Math.cos(ctx.camYaw) * strafe;
  const mz = Math.cos(ctx.camYaw) * fwd - Math.sin(ctx.camYaw) * strafe;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    const nx = player.x + (mx / len) * speed * dt;
    const nz = player.z + (mz / len) * speed * dt;
    if (!hitsBuilding(nx, player.z, 0.6, ctx.colliders)) player.x = nx;
    if (!hitsBuilding(player.x, nz, 0.6, ctx.colliders)) player.z = nz;
    player.heading = Math.atan2(mx, mz);
    player.walkPhase += dt * speed * 1.6;
    player.mesh.userData.legL.rotation.x = Math.sin(player.walkPhase) * 0.6;
    player.mesh.userData.legR.rotation.x = -Math.sin(player.walkPhase) * 0.6;
  } else {
    player.mesh.userData.legL.rotation.x *= 0.8;
    player.mesh.userData.legR.rotation.x *= 0.8;
  }
  player.x = Math.max(-268, Math.min(345, player.x));
  player.z = Math.max(-268, Math.min(268, player.z));
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;

  // Punch (F): nearest pedestrian in front, close range.
  if (input.down('KeyF') && player.punchCooldown <= 0) {
    player.punchCooldown = 0.5;
    ctx.audio.punch();
    for (const p of ctx.peds) {
      if (p.down > 0) continue;
      const d = Math.hypot(p.x - player.x, p.z - player.z);
      if (d < TUNING.punchRange) {
        const ang = Math.atan2(p.x - player.x, p.z - player.z);
        let diff = ang - player.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < 1.2) {
          ctx.pedsKnockDown(p);
          ctx.crime('assault');
          break;
        }
      }
    }
  }

  // Shoot (left click): nearest pedestrian roughly ahead, within range.
  if (player.wantShot && player.shotCooldown <= 0) {
    player.wantShot = false;
    player.shotCooldown = TUNING.shotCooldown;
    ctx.audio.shot();
    ctx.crime('shoot');
    let best = null;
    let bestD = TUNING.shotRange;
    for (const p of ctx.peds) {
      if (p.down > 0) continue;
      const d = Math.hypot(p.x - player.x, p.z - player.z);
      if (d >= bestD) continue;
      const ang = Math.atan2(p.x - player.x, p.z - player.z);
      let diff = ang - ctx.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.35) { best = p; bestD = d; }
    }
    if (best) ctx.pedsKnockDown(best);
  } else {
    player.wantShot = false;
  }
}
