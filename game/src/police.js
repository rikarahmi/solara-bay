// Wanted level and the Bay PD: crimes raise stars, police cars spawn and chase,
// ramming the player. Lose the heat by staying clean and out of sight; get
// busted when a cop reaches the player on foot at two stars or more.
import { WORLD, TUNING } from './config.js';
import { makeCar, driveCar, separateCars } from './vehicles.js';

const CRIME_STARS = { steal: 1, assault: 1, shoot: 1, runover: 2, ramCop: 1 };

export function createPolice(scene, rng, colliders) {
  const police = {
    cars: [],
    stars: 0,
    lastCrimeAt: -999,
    decayAt: 0,
    bustTimer: 0,
    crimeCooldown: {},

    addCrime(kind, time) {
      const cd = police.crimeCooldown[kind] || -99;
      if (time - cd < 3) return; // one star per crime kind per 3 s at most
      police.crimeCooldown[kind] = time;
      police.stars = Math.min(5, police.stars + (CRIME_STARS[kind] || 1));
      police.lastCrimeAt = time;
      police.decayAt = time + TUNING.wantedDecayIdle;
    },

    setStars(n, time) {
      police.stars = Math.max(0, Math.min(5, n));
      police.lastCrimeAt = time;
      police.decayAt = time + TUNING.wantedDecayIdle;
    },

    spawnCop(player) {
      if (police.cars.length >= TUNING.maxPolice) return;
      const angle = rng.range(0, Math.PI * 2);
      const dist = rng.range(70, 110);
      let x = player.x + Math.sin(angle) * dist;
      let z = player.z + Math.cos(angle) * dist;
      x = Math.max(-250, Math.min(250, x));
      z = Math.max(-250, Math.min(250, z));
      const road = WORLD.roads.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
      x = road + 3.5;
      const car = makeCar(scene, x, z, 0, { driver: 'police', police: true });
      police.cars.push(car);
    },

    removeCop(car) {
      car.group.removeFromParent();
      police.cars.splice(police.cars.indexOf(car), 1);
    },

    update(dt, time, player, trafficCars) {
      // Decay: once idle long enough, lose one star every few seconds.
      if (police.stars > 0 && time > police.decayAt) {
        police.decayAt = time + TUNING.wantedDecayStep;
        police.stars -= 1;
      }
      // Keep one cop per star (up to the cap).
      const want = Math.min(police.stars, TUNING.maxPolice);
      while (police.cars.length < want) police.spawnCop(player);
      while (police.cars.length > want) police.removeCop(police.cars[police.cars.length - 1]);

      let nearOnFoot = false;
      for (const cop of police.cars) {
        // Pursuit steering: aim at the player, limited turn rate, full throttle.
        const dx = player.x - cop.x;
        const dz = player.z - cop.z;
        const dist = Math.hypot(dx, dz);
        const wantHeading = Math.atan2(dx, dz);
        let diff = wantHeading - cop.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const steer = Math.max(-1, Math.min(1, diff * 1.6));
        const maxSpeed = 26 + police.stars * 1.5;
        if (!player.car && dist < 2.5) {
          // The cop stops on the player to make the arrest instead of
          // driving past: face the player and hold position.
          cop.speed = 0;
          cop.heading = wantHeading;
          cop.group.position.set(cop.x, 0, cop.z);
          cop.group.rotation.y = cop.heading;
        } else {
          driveCar(cop, dt, 1, steer, colliders, maxSpeed);
          // A cop closing in on the player on foot slows to a crawl.
          if (!player.car && dist < 4) cop.speed = Math.min(cop.speed, 2);
        }
        for (const other of trafficCars) separateCars(cop, other);
        for (const other of police.cars) {
          if (other !== cop) separateCars(cop, other);
        }
        if (player.car) {
          if (separateCars(cop, player.car)) {
            police.addCrime('ramCop', time);
          }
        } else if (dist < TUNING.bustDistance) {
          nearOnFoot = true;
          if (dist < 2.2 && time - player.lastHurt > 1) {
            player.lastHurt = time;
            player.health -= 20;
          }
        }
      }
      // Busted: a cop stands on the player on foot while wanted. Close
      // passes count toward the arrest; distance only lets it fade slowly.
      if (nearOnFoot && police.stars >= 2) {
        police.bustTimer += dt;
      } else {
        police.bustTimer = Math.max(0, police.bustTimer - dt * 1.5);
      }
      return police.bustTimer > TUNING.bustTime;
    },

    clear(scene) {
      for (const car of police.cars) car.group.removeFromParent();
      police.cars = [];
      police.stars = 0;
      police.bustTimer = 0;
    },
  };
  return police;
}
