// The screenshot scenes behind ?shot=start|drive|chase|mission (with &seed=N).
// Each one plays the real rules forward from a fresh world for a fixed number
// of 1/60 s steps with scripted input, so the frame is what real play looks
// like and the same seed always gives the same frame.
import { STEP } from './config.js';

const DRIVE_SECONDS = 8;
const CHASE_SECONDS = 6;
const MISSION_SECONDS = 3;

// A parked car facing west (toward the sunset) with a long run ahead of it,
// moved onto its proper right-hand lane. Westbound shots show the sunset,
// the skyline and the traffic ahead.
function westboundCar(w) {
  let best = null;
  for (const car of w.parked) {
    const west = Math.abs(Math.abs(car.heading) - Math.PI / 2) < 0.01 && Math.sin(car.heading) < 0;
    if (!west) continue;
    if (car.x < 60) continue;
    if (!best || car.x > best.x) best = car;
  }
  const car = best || w.parked[0];
  if (!best) {
    // No westbound car with a long run happened to spawn: move one there.
    car.x = 180;
    car.z = -60 - 5.6;
    car.heading = -Math.PI / 2;
    car.group.rotation.y = car.heading;
  }
  // Right-hand lane for a westbound car is 3.5 m north of the road centre.
  car.z += 9.1;
  car.group.position.set(car.x, 0, car.z);
  return car;
}

function stealAndDrive(w, car, seconds) {
  const input = w.input;
  w.player.x = car.x + 3;
  w.player.z = car.z + 3;
  w.player.mesh.position.set(w.player.x, 0, w.player.z);
  input.keys.add('KeyE');
  w.step(STEP);
  input.keys.delete('KeyE');
  w.render.camPitch = 0.2; // low chase camera: skyline and sunset stay in frame
  w.render.driveDist = 11;
  input.keys.add('KeyW');
  for (let i = 0; i < seconds / STEP; i += 1) w.step(STEP);
  input.keys.delete('KeyW');
}

// Put three traffic cars on the road in the frame, so it reads as live
// traffic: the shot camera sits ~11 m west of the car looking east, so cars
// staged west of the player fall behind the lens. Stage them east instead —
// one in the player's lane, one coming the other way, one further out —
// plus a pedestrian on the right sidewalk (screen-right is +z here).
function stageTrafficAhead(w) {
  const px = w.player.x;
  const pz = w.player.z;
  const spots = [
    { car: w.traffic.cars[0], x: px + 24, z: pz, heading: -Math.PI / 2, speed: 12 },
    { car: w.traffic.cars[1], x: px + 42, z: pz - 7, heading: Math.PI / 2, speed: 11 },
    { car: w.traffic.cars[2], x: px + 62, z: pz, heading: -Math.PI / 2, speed: 10 },
  ];
  for (const s of spots) {
    if (!s.car) continue;
    s.car.x = s.x; s.car.z = s.z; s.car.heading = s.heading; s.car.speed = s.speed;
    s.car.group.position.set(s.x, 0, s.z);
    s.car.group.rotation.y = s.heading;
  }
  const ped = w.peds.find((p) => p.down <= 0);
  if (ped) {
    ped.x = px + 16; ped.z = pz + 8.5;
    ped.tx = ped.x; ped.tz = ped.z;
    ped.heading = Math.PI; // face the road
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}

// Settle the chase camera behind the car, then paint one frame.
function settleCamera(w) {
  for (let i = 0; i < 40; i += 1) w.render.update(STEP, w.player, w.time);
  w.render.draw();
}

export function stageShot(name, w) {
  const input = w.input;
  input.keys.clear();

  if (name === 'drive') {
    w.startGame(0);
    const car = westboundCar(w);
    stealAndDrive(w, car, DRIVE_SECONDS);
    stageTrafficAhead(w);
    settleCamera(w);
    return 'playing';
  }

  if (name === 'chase') {
    w.startGame(2); // Mission 3 — Heat Check, so the HUD shows the chase job.
    const car = westboundCar(w);
    stealAndDrive(w, car, 1);
    w.police.setStars(3, w.time);
    w.step(STEP); // spawn the cops
    // Line the cops up behind the player's car for a readable chase frame.
    w.police.cars.forEach((cop, i) => {
      cop.x = car.x + 16 + i * 7;
      cop.z = car.z + (i === 1 ? -7 : 5);
      cop.heading = -Math.PI / 2;
      cop.speed = 18;
    });
    input.keys.add('KeyW');
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) w.step(STEP);
    input.keys.delete('KeyW');
    // Pull the cops in close behind the player's car, fanned across the
    // road, so the pursuit reads in the frame instead of shrinking to
    // specks far down the road.
    const px = w.player.x;
    const pz = w.player.z;
    w.police.cars.forEach((cop, i) => {
      const spots = [[5, -6], [9, 2], [13, -3]];
      const s = spots[i % spots.length];
      cop.x = px + s[0];
      cop.z = pz + s[1];
      cop.heading = -Math.PI / 2;
      cop.speed = 25;
      cop.group.position.set(cop.x, 0, cop.z);
      cop.group.rotation.y = cop.heading;
    });
    // Low camera on the north side of the road (below the player's lane):
    // from here the nearest lamp globe sits ~90° off the view axis, out of
    // the frame, instead of looming a few metres from the lens as a white
    // ball. The player's car stays in frame with the cops right behind it.
    w.render.camera.position.set(px - 13, 5.0, pz - 6);
    w.render.camera.lookAt(px + 18, 1, pz - 1);
    w.render.draw();
    return 'playing';
  }

  if (name === 'mission') {
    w.startGame(1); // Mission 2 — Sunset Courier, pickup at Old Market.
    w.player.x = -129;
    w.player.z = -55;
    w.player.heading = 2.03;
    w.player.mesh.position.set(w.player.x, 0, w.player.z);
    // Face the market stall and its beacon straight on.
    w.render.camYaw = 2.03;
    w.render.camPitch = 0.35;
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) w.step(STEP);
    w.hud.hideToast();
    settleCamera(w);
    return 'playing';
  }

  // Default: title screen over the city at sunset.
  w.time = 8;
  w.render.titleCamera(w.time);
  w.render.draw();
  return 'title';
}
