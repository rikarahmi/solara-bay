// AI traffic: cars that cruise the road grid, turn at intersections, slow for
// the car ahead, and U-turn at the city edge. All routes come from the seed.
import { WORLD, TUNING } from './config.js';
import { makeCar, driveCar, hitsBuilding, separateCars } from './vehicles.js';

export function createTraffic(scene, rng, colliders) {
  const cars = [];
  const lanes = WORLD.roads;

  function randomRoadSpot() {
    const road = rng.pick(lanes);
    const along = rng.range(-240, 240);
    if (rng.chance(0.5)) return { x: road, z: along, axis: 'z', dir: rng.chance(0.5) ? 1 : -1 };
    return { x: along, z: road, axis: 'x', dir: rng.chance(0.5) ? 1 : -1 };
  }

  for (let i = 0; i < TUNING.trafficCount; i += 1) {
    const spot = randomRoadSpot();
    const heading = spot.axis === 'z' ? (spot.dir > 0 ? 0 : Math.PI) : (spot.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(scene, spot.x, spot.z, heading, { driver: 'ai', color: rng.pick([0xc23b2e, 0x2e6fc2, 0xe8b93b, 0x3fae6a, 0x8a5fc2, 0xe8e4da, 0x22242a, 0xd97b2e, 0x4fb3c2]) });
    car.ai = { axis: spot.axis, dir: spot.dir, lane: spot.axis === 'z' ? spot.x : spot.z, speed: rng.range(8, 13) };
    cars.push(car);
  }

  function nearestRoad(v) {
    let best = lanes[0];
    for (const r of lanes) if (Math.abs(r - v) < Math.abs(best - v)) best = r;
    return best;
  }

  function update(dt, playerCar) {
    for (const car of cars) {
      const ai = car.ai;
      // Car ahead on the same lane? Slow down.
      let targetSpeed = ai.speed;
      for (const other of cars) {
        if (other === car) continue;
        if (other.ai.axis !== ai.axis || other.ai.lane !== ai.lane || other.ai.dir !== ai.dir) continue;
        const along = ai.axis === 'z' ? (other.z - car.z) * ai.dir : (other.x - car.x) * ai.dir;
        if (along > 0 && along < 13) { targetSpeed = Math.min(targetSpeed, 3); break; }
      }
      if (playerCar) {
        const along = ai.axis === 'z' ? (playerCar.z - car.z) * ai.dir : (playerCar.x - car.x) * ai.dir;
        const side = ai.axis === 'z' ? Math.abs(playerCar.x - car.x) : Math.abs(playerCar.z - car.z);
        if (along > 0 && along < 12 && side < 4) targetSpeed = 2;
      }
      // Ease toward target speed, then roll forward along the lane.
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2);
      const step = car.speed * dt;
      if (ai.axis === 'z') car.z += ai.dir * step;
      else car.x += ai.dir * step;
      // Keep to the right-hand lane (offset 3.5 from the road centre).
      const lanePos = ai.lane + (ai.axis === 'z' ? (ai.dir > 0 ? 3.5 : -3.5) : (ai.dir > 0 ? -3.5 : 3.5));
      if (ai.axis === 'z') car.x += (lanePos - car.x) * Math.min(1, dt * 3);
      else car.z += (lanePos - car.z) * Math.min(1, dt * 3);
      car.heading = ai.axis === 'z' ? (ai.dir > 0 ? 0 : Math.PI) : (ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      // At an intersection, sometimes turn onto the crossing road.
      const alongPos = ai.axis === 'z' ? car.z : car.x;
      const cross = nearestRoad(alongPos);
      if (Math.abs(alongPos - cross) < 1.2 && rng.chance(0.02)) {
        const newDir = rng.chance(0.5) ? 1 : -1;
        if (rng.chance(0.7)) {
          ai.axis = ai.axis === 'z' ? 'x' : 'z';
          ai.lane = cross;
          ai.dir = newDir;
        }
      }
      // Edge of the city: turn around.
      if (car.x > 250 || car.x < -250 || car.z > 250 || car.z < -250) {
        ai.dir *= -1;
        if (ai.axis === 'z') car.z = Math.max(-250, Math.min(250, car.z));
        else car.x = Math.max(-250, Math.min(250, car.x));
      }
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
      for (const w of car.group.userData.wheels) w.rotation.x += car.speed * dt * 2.2;
    }
    // Gentle separation so traffic never overlaps.
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) separateCars(cars[i], cars[j]);
      if (playerCar) separateCars(cars[i], playerCar);
    }
  }

  return { cars, update };
}

// Parked cars along road edges, ready to steal.
export function createParkedCars(scene, rng, colliders) {
  const parked = [];
  const spots = [];
  for (const road of WORLD.roads) {
    for (const along of [-210, -150, -90, -30, 30, 90, 150, 210]) {
      spots.push({ x: road + 5.6, z: along, heading: 0 });
      spots.push({ x: road - 5.6, z: along + 18, heading: Math.PI });
      spots.push({ x: along, z: road + 5.6, heading: Math.PI / 2 });
      spots.push({ x: along + 18, z: road - 5.6, heading: -Math.PI / 2 });
    }
  }
  // Shuffle deterministically, take the first N that do not touch a building.
  for (let i = spots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  for (const s of spots) {
    if (parked.length >= TUNING.parkedCount) break;
    if (hitsBuilding(s.x, s.z, 3, colliders)) continue;
    if (Math.abs(s.x) > 250 || Math.abs(s.z) > 250) continue;
    const car = makeCar(scene, s.x, s.z, s.heading, { driver: 'parked', color: rng.pick([0xc23b2e, 0x2e6fc2, 0xe8b93b, 0x3fae6a, 0x8a5fc2, 0xe8e4da, 0x22242a, 0xd97b2e, 0x4fb3c2, 0xb03a6e]) });
    parked.push(car);
  }
  return parked;
}

export { driveCar };
