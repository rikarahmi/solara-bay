// Cars: mesh factory (body, cabin, wheels, lights), arcade driving physics
// and shared collision helpers (buildings, other cars, world bounds).
import * as THREE from 'three';
import { WORLD, TUNING, CAR_COLORS } from './config.js';

const bodyGeo = new THREE.BoxGeometry(2.1, 0.75, 4.4);
const cabinGeo = new THREE.BoxGeometry(1.8, 0.65, 2.2);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
const lightGeo = new THREE.BoxGeometry(0.4, 0.22, 0.12);
const barGeo = new THREE.BoxGeometry(1.2, 0.25, 0.5);

export function createCarMesh(color, police) {
  const car = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: police ? 0xf0f0ea : color });
  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.y = 0.62;
  body.castShadow = true;
  car.add(body);
  const cabin = new THREE.Mesh(cabinGeo, new THREE.MeshLambertMaterial({ color: 0x1c2430 }));
  cabin.position.set(0, 1.25, -0.2);
  cabin.castShadow = true;
  car.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14141a });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    car.add(w);
    wheels.push(w);
  }
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe27a, emissiveIntensity: 0.8 });
  for (const x of [-0.7, 0.7]) {
    const h = new THREE.Mesh(lightGeo, headMat);
    h.position.set(x, 0.66, 2.22);
    car.add(h);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xc22020, emissive: 0x881111, emissiveIntensity: 0.7 });
  for (const x of [-0.7, 0.7]) {
    const t = new THREE.Mesh(lightGeo, tailMat);
    t.position.set(x, 0.66, -2.22);
    car.add(t);
  }
  let barRed = null;
  let barBlue = null;
  if (police) {
    barRed = new THREE.Mesh(barGeo, new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1 }));
    barRed.position.set(-0.35, 1.7, -0.2);
    car.add(barRed);
    barBlue = new THREE.Mesh(barGeo, new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 1 }));
    barBlue.position.set(0.35, 1.7, -0.2);
    car.add(barBlue);
    // black hood + trunk bands
    const bandMat = new THREE.MeshLambertMaterial({ color: 0x14141a });
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.1, 1.2), bandMat);
    hood.position.set(0, 1.0, 1.5);
    car.add(hood);
  }
  car.userData = { wheels, barRed, barBlue };
  return car;
}

export function makeCar(scene, x, z, heading, opts = {}) {
  const police = !!opts.police;
  const color = police ? 0xf0f0ea : (opts.color ?? CAR_COLORS[0]);
  const group = createCarMesh(color, police);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    group, color, police,
    x, z, heading,
    speed: 0,
    steer: 0,
    driver: opts.driver || 'parked', // parked | ai | player | police
    radius: 2.6,
    parked: opts.driver === 'parked' || !opts.driver,
    ai: null, // traffic state, filled by traffic.js
    flash: 0,
  };
}

// True when a circle at (x, z) with radius r hits any building collider.
export function hitsBuilding(x, z, r, colliders) {
  for (const c of colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
  }
  return false;
}

// Move a car with arcade physics; slides along building walls (x then z).
export function driveCar(car, dt, throttle, steerInput, colliders, maxSpeed) {
  const accel = TUNING.playerAccel;
  if (throttle > 0) car.speed += accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= accel * 1.4 * dt; // brake
    else car.speed -= accel * 0.5 * dt; // reverse
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  car.speed = Math.max(-TUNING.playerReverseSpeed, Math.min(maxSpeed, car.speed));
  const steerTarget = steerInput * 0.55 * Math.min(1, Math.abs(car.speed) / 8 + 0.25);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += (car.steer * TUNING.playerTurn * dt) * Math.sign(car.speed || 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const r = 1.9;
  if (!hitsBuilding(nx, car.z, r, colliders)) car.x = nx;
  else car.speed *= 0.5;
  if (!hitsBuilding(car.x, nz, r, colliders)) car.z = nz;
  else car.speed *= 0.5;
  // Stay inside the playable area (city + beach).
  car.x = Math.max(-WORLD.bound, Math.min(345, car.x));
  car.z = Math.max(-WORLD.bound, Math.min(WORLD.bound, car.z));
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  // Spin the wheels with speed.
  for (const w of car.group.userData.wheels) w.rotation.x += car.speed * dt * 2.2;
  // Police light bar flashes.
  if (car.police) {
    car.flash += dt;
    const on = Math.floor(car.flash * 4) % 2 === 0;
    car.group.userData.barRed.material.emissiveIntensity = on ? 2.2 : 0.2;
    car.group.userData.barBlue.material.emissiveIntensity = on ? 0.2 : 2.2;
  }
}

// Push two overlapping cars apart and trade a little speed.
export function separateCars(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const min = a.radius + b.radius - 0.6;
  if (d === 0 || d >= min) return false;
  const push = (min - d) / 2;
  const ux = dx / d;
  const uz = dz / d;
  a.x -= ux * push;
  a.z -= uz * push;
  b.x += ux * push;
  b.z += uz * push;
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.6;
  b.speed = avg * 0.6;
  return true;
}
