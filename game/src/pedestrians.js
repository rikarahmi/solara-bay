// Pedestrians: simple walkers on the sidewalks, wandering from corner to
// corner. They can be punched or shot (a crime) and run over (a bigger one);
// a hit pedestrian falls and stays down for a while, then gets up and walks on.
import * as THREE from 'three';
import { WORLD, TUNING, PED_SHIRTS } from './config.js';
import { hitsBuilding } from './vehicles.js';

const legGeo = new THREE.BoxGeometry(0.22, 0.75, 0.22);
const bodyGeo = new THREE.BoxGeometry(0.62, 0.85, 0.36);
const headGeo = new THREE.SphereGeometry(0.26, 10, 8);
const armGeo = new THREE.BoxGeometry(0.16, 0.7, 0.16);

function makePedMesh(shirt, skin) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2a2e3a });
  const body = new THREE.Mesh(bodyGeo, shirtMat);
  body.position.y = 1.25;
  g.add(body);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.92;
  g.add(head);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.16, 0.42, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.16, 0.42, 0);
  g.add(legR);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.42, 1.25, 0);
  g.add(armL);
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.42, 1.25, 0);
  g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export function createPedestrians(scene, rng, colliders) {
  const peds = [];
  const skins = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];

  function randomSidewalkSpot() {
    // A point just off a road, on a sidewalk edge.
    const road = rng.pick(WORLD.roads);
    const along = rng.range(-240, 240);
    const side = rng.chance(0.5) ? 8.5 : -8.5;
    if (rng.chance(0.5)) return { x: road + side, z: along };
    return { x: along, z: road + side };
  }

  for (let i = 0; i < TUNING.pedCount; i += 1) {
    const spot = randomSidewalkSpot();
    const mesh = makePedMesh(rng.pick(PED_SHIRTS), rng.pick(skins));
    mesh.position.set(spot.x, 0, spot.z);
    scene.add(mesh);
    peds.push({
      mesh, x: spot.x, z: spot.z,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.2),
      tx: spot.x, tz: spot.z,
      walkPhase: rng.range(0, Math.PI * 2),
      down: 0, // seconds left lying down
      dead: false,
    });
  }

  function pickTarget(p) {
    const spot = randomSidewalkSpot();
    p.tx = spot.x;
    p.tz = spot.z;
  }

  function update(dt, time) {
    for (const p of peds) {
      if (p.down > 0) {
        p.down -= dt;
        p.mesh.rotation.x = -Math.PI / 2 * Math.min(1, (0.5 - Math.max(0, p.down - 0.0)) * 4 + 0.5);
        if (p.down <= 0) {
          p.mesh.rotation.x = 0;
          pickTarget(p);
        }
        continue;
      }
      const dx = p.tx - p.x;
      const dz = p.tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) { pickTarget(p); continue; }
      const want = Math.atan2(dx, dz);
      let diff = want - p.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const nx = p.x + Math.sin(p.heading) * p.speed * dt;
      const nz = p.z + Math.cos(p.heading) * p.speed * dt;
      if (!hitsBuilding(nx, nz, 0.5, colliders) && Math.abs(nx) < 268 && Math.abs(nz) < 268) {
        p.x = nx;
        p.z = nz;
      } else {
        pickTarget(p);
      }
      p.walkPhase += dt * p.speed * 4;
      const swing = Math.sin(p.walkPhase) * 0.5;
      p.mesh.userData.legL.rotation.x = swing;
      p.mesh.userData.legR.rotation.x = -swing;
      p.mesh.userData.armL.rotation.x = -swing * 0.7;
      p.mesh.userData.armR.rotation.x = swing * 0.7;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }

  function knockDown(p) {
    p.down = 6;
    p.mesh.rotation.x = -Math.PI / 2;
  }

  return { peds, update, knockDown };
}
