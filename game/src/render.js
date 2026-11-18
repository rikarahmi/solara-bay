// Rendering: WebGL renderer, sunset lighting with shadows, and the chase /
// on-foot camera that follows the player and answers the mouse.
import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyMid);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2500);

  // Warm low sun from the west + a cool purple fill from the east.
  const sun = new THREE.DirectionalLight(0xffb36b, 2.4);
  sun.position.set(-300, 180, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x7a6cff, 0.55);
  fill.position.set(300, 120, 200);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xff9a6a, 0.5));

  const render = {
    renderer, scene, camera, sun,
    camYaw: 0,
    camPitch: 0.32,
    camDist: 10,
    driveDist: 13, // chase-camera distance while driving (shots may tighten it)
    camPos: new THREE.Vector3(0, 30, 60),
    lookTarget: new THREE.Vector3(),

    resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },

    // Mouse look: drag or pointer lock rotates the orbit.
    applyLook(dx, dy) {
      render.camYaw -= dx * 0.0032;
      render.camPitch = Math.max(0.05, Math.min(1.1, render.camPitch + dy * 0.0024));
    },

    // Follow the player: behind the car when driving, behind the walker on foot.
    update(dt, player, time) {
      const driving = !player.onFoot && player.car;
      const target = driving ? player.car : player;
      const baseYaw = driving ? player.car.heading + Math.PI : render.camYaw;
      const dist = driving ? render.driveDist : 8.5;
      const height = driving ? 4.6 : 3.4;
      const tx = target.x;
      const tz = target.z;
      const wantX = tx - Math.sin(baseYaw) * Math.cos(render.camPitch) * dist;
      const wantZ = tz - Math.cos(baseYaw) * Math.cos(render.camPitch) * dist;
      const wantY = height + Math.sin(render.camPitch) * dist;
      const k = Math.min(1, dt * 7);
      render.camPos.x += (wantX - render.camPos.x) * k;
      render.camPos.y += (wantY - render.camPos.y) * k;
      render.camPos.z += (wantZ - render.camPos.z) * k;
      render.lookTarget.set(tx, 1.8, tz);
      camera.position.copy(render.camPos);
      camera.lookAt(render.lookTarget);
      // The sun shadow follows the player so shadows stay crisp nearby.
      sun.position.set(tx - 300, 180, tz - 80);
      sun.target.position.set(tx, 0, tz);
      sun.target.updateMatrixWorld();
    },

    // A fixed cinematic camera for the title screen.
    titleCamera(time) {
      const a = time * 0.02;
      camera.position.set(Math.sin(a) * 190, 55 + Math.sin(time * 0.1) * 6, 190 + Math.cos(a) * 40);
      camera.lookAt(0, 18, -40);
    },

    draw() {
      renderer.render(scene, camera);
    },
  };

  render.resize();
  window.addEventListener('resize', render.resize);
  return render;
}
