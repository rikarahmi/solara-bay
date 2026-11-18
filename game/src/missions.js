// Missions: the five-job story arc. One objective at a time; each objective
// type watches the game until its condition is met, then the next begins.
// The beacon (a glowing pillar + floating diamond) marks the current target.
import * as THREE from 'three';
import { MISSIONS } from './config.js';

export function createMissions(scene) {
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0x39c2ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true), beaconMat);
  beacon.position.y = 30;
  beacon.visible = false;
  scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({ color: 0x39c2ff }),
  );
  diamond.visible = false;
  scene.add(diamond);
  // A small pickup crate shown at onFootTo targets.
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.8, 1.8),
    new THREE.MeshLambertMaterial({ color: 0xe8b93b, emissive: 0x664411, emissiveIntensity: 0.5 }),
  );
  crate.visible = false;
  scene.add(crate);

  const missions = {
    index: 0,
    objIndex: 0,
    timer: 0,
    done: false,
    active: false,
    target: null,
    heatArmed: false,

    current() {
      return MISSIONS[missions.index] || null;
    },
    objective() {
      const m = missions.current();
      return m ? m.objectives[missions.objIndex] : null;
    },
    text() {
      const o = missions.objective();
      return o ? o.text : '';
    },

    start(index) {
      missions.index = index;
      missions.objIndex = 0;
      missions.done = false;
      missions.active = true;
      missions.heatArmed = false;
      missions.setupObjective();
    },

    setupObjective() {
      const o = missions.objective();
      missions.timer = o && o.timer ? o.timer : 0;
      const target = o && o.x !== undefined ? { x: o.x, z: o.z, r: o.r || 10 } : null;
      missions.target = target;
      if (target) {
        beacon.position.set(target.x, 30, target.z);
        beacon.visible = true;
        diamond.position.set(target.x, 8, target.z);
        diamond.visible = true;
      } else {
        beacon.visible = false;
        diamond.visible = false;
      }
      crate.visible = !!(o && o.type === 'onFootTo' && target);
      if (crate.visible) crate.position.set(target.x, 1.4, target.z);
    },

    // Returns 'complete' | 'failed' | null. Called every step with the world.
    update(dt, w) {
      if (!missions.active || missions.done) return null;
      const o = missions.objective();
      if (!o) return null;
      if (missions.timer > 0) {
        missions.timer -= dt;
        if (missions.timer <= 0) return 'failed';
      }
      const px = w.player.x;
      const pz = w.player.z;
      const atTarget = missions.target && Math.hypot(px - missions.target.x, pz - missions.target.z) < missions.target.r;
      switch (o.type) {
        case 'stealCar':
          if (!w.player.onFoot) return missions.advance(w);
          break;
        case 'driveTo':
          if (atTarget && !w.player.onFoot) return missions.advance(w);
          break;
        case 'onFootTo':
          if (atTarget && w.player.onFoot && w.pressedE) return missions.advance(w);
          break;
        case 'gainHeat':
          if (w.police.stars >= o.stars) return missions.advance(w);
          break;
        case 'loseHeat':
          if (w.police.stars === 0) return missions.advance(w);
          break;
        case 'escape':
          if (missions.target && atTarget && w.police.stars >= 4) return missions.advance(w);
          if (!missions.heatArmed) {
            missions.heatArmed = true;
            w.police.setStars(4, w.time);
          }
          break;
        default:
          break;
      }
      return null;
    },

    advance(w) {
      const m = missions.current();
      missions.objIndex += 1;
      if (missions.objIndex >= m.objectives.length) {
        missions.done = true;
        missions.active = false;
        beacon.visible = false;
        diamond.visible = false;
        crate.visible = false;
        w.cash += m.reward;
        w.audio.missionDone();
        w.toast(`Mission complete — $${m.reward} earned!`);
        w.saveGame();
        return 'complete';
      }
      missions.setupObjective();
      return null;
    },

    next() {
      if (missions.index + 1 < MISSIONS.length) {
        missions.start(missions.index + 1);
        return true;
      }
      return false;
    },

    animate(dt, time) {
      if (diamond.visible) {
        diamond.rotation.y = time * 1.5;
        diamond.position.y = 8 + Math.sin(time * 2) * 0.8;
      }
      if (beacon.visible) beacon.material.opacity = 0.22 + Math.sin(time * 2.5) * 0.08;
      if (crate.visible) crate.rotation.y = time * 0.8;
    },
  };
  return missions;
}
