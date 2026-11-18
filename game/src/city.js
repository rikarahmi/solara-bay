// Solara Bay itself: roads, blocks, buildings, beach, sea, pier, lighthouse,
// palms and street props. Everything is generated from the seeded RNG, so the
// same seed builds the same city. Returns colliders (building footprints) and
// the named spots missions point at.
import * as THREE from 'three';
import { WORLD, PALETTE, DISTRICTS } from './config.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildingTexture(rng, base) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    // faint vertical grime
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 3, h);
    // lit and dark windows
    const cols = 4;
    const rows = 10;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const lit = rng.chance(0.35);
        g.fillStyle = lit ? '#ffd98a' : 'rgba(20,24,40,0.85)';
        g.fillRect(10 + c * 30, 12 + r * 24, 20, 14);
      }
    }
  });
}

function roadTexture(rng) {
  const t = canvasTexture(64, 128, (g, w, h) => {
    g.fillStyle = '#3c3a42';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 40; i += 1) g.fillRect(rng.next() * w, rng.next() * h, 2, 2);
    g.fillStyle = '#d8d2c2';
    g.fillRect(w / 2 - 2, 8, 4, 44); // centre dash
    g.fillStyle = 'rgba(216,210,194,0.6)';
    g.fillRect(3, 0, 2, h);
    g.fillRect(w - 5, 0, 2, h);
  });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Sky dome: vertical sunset gradient, sun side warmer.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      mid: { value: new THREE.Color(PALETTE.skyMid) },
      low: { value: new THREE.Color(PALETTE.skyLow) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){
        float h = normalize(vP).y;
        vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 24, 16), skyMat);
  group.add(sky);

  // Low sun disc in the west, so driving west faces the sunset.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(55, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.set(-950, 110, -140);
  sun.lookAt(0, 60, 0);
  group.add(sun);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(110, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9a4d, transparent: true, opacity: 0.35, fog: false }),
  );
  glow.position.copy(sun.position).add(new THREE.Vector3(4, 0, 0));
  glow.lookAt(0, 60, 0);
  group.add(glow);

  scene.fog = new THREE.Fog(PALETTE.fog, 260, 1050);

  // Ground, beach and sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(120, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 620),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(305, 0.05, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 1400),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(640, 0.02, 0);
  group.add(sea);

  // Roads: dark strips with a repeating dash texture, both directions.
  const roadTex = roadTexture(rng);
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const roadLen = 560;
  for (const c of WORLD.roads) {
    const along = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, roadLen), roadMat.clone());
    along.material.map = roadTex.clone();
    along.material.map.repeat.set(1, roadLen / 16);
    along.material.map.needsUpdate = true;
    along.rotation.x = -Math.PI / 2;
    along.rotation.z = Math.PI / 2;
    along.position.set(0, 0.06, c);
    along.receiveShadow = true;
    group.add(along);
    const across = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, roadLen), roadMat.clone());
    across.material.map = roadTex.clone();
    across.material.map.repeat.set(1, roadLen / 16);
    across.material.map.needsUpdate = true;
    across.rotation.x = -Math.PI / 2;
    across.position.set(c, 0.06, 0);
    across.receiveShadow = true;
    group.add(across);
  }
  // Dirt strips out to the lighthouse and the marina.
  const dirtMat = new THREE.MeshLambertMaterial({ color: 0xb89a6a });
  for (const z of [-240, 120]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(70, 10), dirtMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(305, 0.07, z);
    group.add(strip);
  }

  // Blocks: sidewalk slabs, then buildings — except the special districts.
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const blockGeo = new THREE.BoxGeometry(46, 0.5, 46);
  const special = new Map([
    ['0,0', 'plaza'],
    ['-120,-60', 'market'],
    ['-180,240', 'harbor'],
    ['120,-180', 'park'],
  ]);
  const baseColors = ['#e8b48a', '#d9a06b', '#c98f7a', '#a8b8c8', '#e8d8b0', '#b8c8a8', '#d8b8c8', '#e8c8a0'];
  const texVariants = baseColors.map((c) => buildingTexture(rng, c));
  const blockCenters = [];
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 8; j += 1) {
      blockCenters.push({ x: -210 + i * 60, z: -210 + j * 60 });
    }
  }
  for (const b of blockCenters) {
    const slab = new THREE.Mesh(blockGeo, walkMat);
    slab.position.set(b.x, 0.25, b.z);
    slab.receiveShadow = true;
    group.add(slab);
    const kind = special.get(`${b.x},${b.z}`);
    if (kind === 'plaza') {
      buildPlaza(group, b);
      continue;
    }
    if (kind === 'market') {
      buildMarket(group, b, colliders);
      continue;
    }
    if (kind === 'harbor') {
      buildHarbor(group, b, colliders);
      continue;
    }
    if (kind === 'park') {
      buildPark(group, b, rng);
      continue;
    }
    const distC = Math.hypot(b.x, b.z);
    const tall = distC < 130;
    const count = rng.int(1, 2);
    for (let n = 0; n < count; n += 1) {
      const w = rng.range(14, 22);
      const d = rng.range(14, 22);
      const hgt = tall ? rng.range(18, 46) : rng.range(8, 22);
      const ox = count === 1 ? 0 : (n === 0 ? -11 : 11);
      const oz = count === 1 ? 0 : (n === 0 ? -11 : 11);
      const tex = rng.pick(texVariants);
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat);
      mesh.position.set(b.x + ox, 0.5 + hgt / 2, b.z + oz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w + 1, 1, d + 1),
        new THREE.MeshLambertMaterial({ color: 0x6b5a48 }),
      );
      roof.position.set(b.x + ox, 0.5 + hgt + 0.5, b.z + oz);
      group.add(roof);
      colliders.push({
        minX: b.x + ox - w / 2 - 0.4, maxX: b.x + ox + w / 2 + 0.4,
        minZ: b.z + oz - d / 2 - 0.4, maxZ: b.z + oz + d / 2 + 0.4,
      });
    }
  }

  // Palms along the beach and the plaza.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8a4a });
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 7, 6);
  const frondGeo = new THREE.ConeGeometry(2.6, 2.2, 5);
  for (let i = 0; i < 26; i += 1) {
    const x = rng.range(276, 322);
    const z = -280 + i * 22 + rng.range(-6, 6);
    addPalm(group, x, z, trunkGeo, trunkMat, frondGeo, frondMat, rng);
  }
  for (const [x, z] of [[-18, -18], [18, -18], [-18, 18], [18, 18], [-150, -30], [150, 150]]) {
    addPalm(group, x, z, trunkGeo, trunkMat, frondGeo, frondMat, rng);
  }

  // Streetlights at every other intersection.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe2a0, emissive: 0xffc860, emissiveIntensity: 0.9 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const lampGeo = new THREE.SphereGeometry(0.45, 8, 6);
  for (const rx of WORLD.roads) {
    for (const rz of WORLD.roads) {
      if ((Math.round(rx / 60) + Math.round(rz / 60)) % 2 !== 0) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(rx + 8.5, 3, rz + 8.5);
      group.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(rx + 8.5, 6.2, rz + 8.5);
      group.add(lamp);
    }
  }

  // Marina pier + boats.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(70, 1, 12), pierMat);
  pier.position.set(365, 0.6, 120);
  pier.castShadow = true;
  group.add(pier);
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
  const hullMat2 = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  for (let i = 0; i < 3; i += 1) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2.4, 3.4), i % 2 ? hullMat : hullMat2);
    hull.position.y = 0.4;
    boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2, 2.4), new THREE.MeshLambertMaterial({ color: 0x2e6fc2 }));
    cabin.position.set(-1, 2.4, 0);
    boat.add(cabin);
    boat.position.set(352 + i * 16, 0.4, 100 + i * 12);
    boat.rotation.y = rng.range(-0.2, 0.2);
    group.add(boat);
  }

  // Lighthouse at the point.
  const light = buildLighthouse(group);
  colliders.push({ minX: 295, maxX: 305, minZ: -245, maxZ: -235 });

  return {
    colliders,
    spots: {
      plaza: { x: 0, z: 0 },
      market: { x: -120, z: -60 },
      marina: { x: 300, z: 120 },
      harbor: { x: -180, z: 240 },
      lighthouse: { x: 300, z: -240 },
    },
    lighthouseBeam: light.beam,
    update(dt, time) {
      light.beam.rotation.y = time * 0.5;
      sea.position.y = 0.02 + Math.sin(time * 0.5) * 0.05;
    },
  };
}

function addPalm(group, x, z, trunkGeo, trunkMat, frondGeo, frondMat, rng) {
  const palm = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 3.5;
  trunk.rotation.z = rng.range(-0.08, 0.08);
  palm.add(trunk);
  const fronds = new THREE.Mesh(frondGeo, frondMat);
  fronds.position.y = 7.4;
  palm.add(fronds);
  const fronds2 = new THREE.Mesh(frondGeo, frondMat);
  fronds2.position.y = 6.6;
  fronds2.rotation.y = 0.8;
  fronds2.scale.setScalar(0.8);
  palm.add(fronds2);
  palm.position.set(x, 0.5, z);
  group.add(palm);
}

function buildPlaza(group, b) {
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7.5, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x9a938a }),
  );
  rim.position.set(b.x, 1.1, b.z);
  group.add(rim);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(6.2, 6.2, 0.4, 20),
    new THREE.MeshLambertMaterial({ color: 0x2e8ab2 }),
  );
  water.position.set(b.x, 1.6, b.z);
  group.add(water);
  const jet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1, 3, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d2c2 }),
  );
  jet.position.set(b.x, 2.6, b.z);
  group.add(jet);
}

function buildMarket(group, b, colliders) {
  const stallMat = new THREE.MeshLambertMaterial({ color: 0xd97b2e });
  const stallMat2 = new THREE.MeshLambertMaterial({ color: 0x3fae6a });
  for (let i = 0; i < 3; i += 1) {
    const stall = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(5, 1.4, 3), i % 2 ? stallMat : stallMat2);
    counter.position.y = 1.2;
    stall.add(counter);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.3, 3.6), new THREE.MeshLambertMaterial({ color: 0xe8e4da }));
    roof.position.y = 3.2;
    stall.add(roof);
    stall.position.set(b.x - 10 + i * 10, 0.5, b.z - 6);
    group.add(stall);
    colliders.push({ minX: b.x - 12.5 + i * 10, maxX: b.x - 7.5 + i * 10, minZ: b.z - 7.5, maxZ: b.z - 4.5 });
  }
  // fruit crates
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
  for (let i = 0; i < 4; i += 1) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), crateMat);
    crate.position.set(b.x - 8 + i * 5, 1.1, b.z + 10);
    group.add(crate);
  }
}

function buildHarbor(group, b, colliders) {
  const whMat = new THREE.MeshLambertMaterial({ color: 0x7a6a5a });
  for (const [dx, dz, w, d] of [[-10, -8, 16, 10], [12, 8, 12, 14]]) {
    const wh = new THREE.Mesh(new THREE.BoxGeometry(w, 9, d), whMat);
    wh.position.set(b.x + dx, 5, b.z + dz);
    wh.castShadow = true;
    group.add(wh);
    colliders.push({
      minX: b.x + dx - w / 2, maxX: b.x + dx + w / 2,
      minZ: b.z + dz - d / 2, maxZ: b.z + dz + d / 2,
    });
  }
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xb07830 });
  const crateMat2 = new THREE.MeshLambertMaterial({ color: 0x4f7a8a });
  for (let i = 0; i < 6; i += 1) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), i % 2 ? crateMat : crateMat2);
    crate.position.set(b.x - 14 + (i % 3) * 4, 2, b.z + 12 + Math.floor(i / 3) * 4);
    crate.castShadow = true;
    group.add(crate);
    colliders.push({
      minX: b.x - 15.5 + (i % 3) * 4, maxX: b.x - 12.5 + (i % 3) * 4,
      minZ: b.z + 10.5 + Math.floor(i / 3) * 4, maxZ: b.z + 13.5 + Math.floor(i / 3) * 4,
    });
  }
}

function buildPark(group, b, rng) {
  const grass = new THREE.Mesh(
    new THREE.BoxGeometry(40, 0.7, 40),
    new THREE.MeshLambertMaterial({ color: 0x4a7a3a }),
  );
  grass.position.set(b.x, 0.6, b.z);
  grass.receiveShadow = true;
  group.add(grass);
  const pathMat = new THREE.MeshLambertMaterial({ color: 0xd8c8a8 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(40, 5), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(b.x, 1.0, b.z);
  group.add(path);
  for (let i = 0; i < 5; i += 1) {
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(rng.range(1.4, 2.4), 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a6a2a }),
    );
    bush.position.set(b.x + rng.range(-16, 16), 1.6, b.z + rng.range(-16, 16));
    group.add(bush);
  }
}

function buildLighthouse(group) {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 5.5, 30, 12),
    new THREE.MeshLambertMaterial({ color: 0xe8e4da }),
  );
  base.position.set(300, 15.5, -240);
  base.castShadow = true;
  group.add(base);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(4.7, 4.9, 5, 12),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
  );
  band.position.set(300, 20, -240);
  group.add(band);
  const room = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3.4, 4, 12),
    new THREE.MeshLambertMaterial({ color: 0x2a2a30 }),
  );
  room.position.set(300, 32, -240);
  group.add(room);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe27a, emissiveIntensity: 2 }),
  );
  lamp.position.set(300, 32, -240);
  group.add(lamp);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3.6, 3, 12),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
  );
  roof.position.set(300, 35.5, -240);
  group.add(roof);
  // Rotating beam: two opposite translucent cones.
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beamGroup = new THREE.Group();
  beamGroup.position.set(300, 32, -240);
  for (const s of [1, -1]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(3.5, 34, 10, 1, true), beamMat);
    cone.rotation.z = s * Math.PI / 2;
    cone.position.x = s * 17;
    beamGroup.add(cone);
  }
  group.add(beamGroup);
  return { beam: beamGroup };
}

export { DISTRICTS };
