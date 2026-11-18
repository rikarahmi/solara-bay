// HUD: cash, wanted stars, health, speed, mission objective, timer, compass
// arrow and a live minimap canvas — plus the title / pause / end overlays.
import { WORLD, MISSIONS } from './config.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'), cash: $('cash'), missionTitle: $('mission-title'),
    missionText: $('mission-text'), missionDist: $('mission-dist'),
    stars: $('stars'), healthFill: $('health-fill'), speed: $('speed'),
    timer: $('timer'), toast: $('toast'), banner: $('banner'),
    compass: $('compass'), minimap: $('minimap'),
    title: $('title-screen'), pause: $('pause-screen'), end: $('end-screen'),
    endTitle: $('end-title'), endText: $('end-text'),
    btnStart: $('btn-start'), btnContinue: $('btn-continue'),
    btnResume: $('btn-resume'), btnRestart: $('btn-restart'), btnTitle: $('btn-title'),
    status: $('status'),
  };
  const mm = els.minimap.getContext('2d');
  let toastTimer = 0;

  function show(el, on) {
    if (el) el.style.display = on ? '' : 'none';
  }

  const hud = {
    onStart: null, onContinue: null, onResume: null, onRestart: null, onTitle: null,

    bind() {
      els.btnStart.addEventListener('click', () => hud.onStart && hud.onStart());
      els.btnContinue.addEventListener('click', () => hud.onContinue && hud.onContinue());
      els.btnResume.addEventListener('click', () => hud.onResume && hud.onResume());
      els.btnRestart.addEventListener('click', () => hud.onRestart && hud.onRestart());
      els.btnTitle.addEventListener('click', () => hud.onTitle && hud.onTitle());
    },

    showTitle(saveExists) {
      show(els.title, true);
      show(els.pause, false);
      show(els.end, false);
      show(els.hud, false);
      show(els.btnContinue, !!saveExists);
      els.status.textContent = 'Solara Bay. Press Enter or click Start to play.';
    },

    showPlaying() {
      show(els.title, false);
      show(els.pause, false);
      show(els.end, false);
      show(els.hud, true);
    },

    showPause(on) {
      show(els.pause, on);
    },

    showEnd(win, title, text) {
      show(els.end, true);
      show(els.pause, false);
      els.endTitle.textContent = title;
      els.endTitle.style.color = win ? '#7ae08a' : '#ff6a5a';
      els.endText.textContent = text;
      els.status.textContent = `${title}. ${text}`;
    },

    toast(msg) {
      els.toast.textContent = msg;
      els.toast.style.opacity = '1';
      toastTimer = 3.5;
    },

    hideToast() {
      els.toast.style.opacity = '0';
      toastTimer = 0;
    },

    banner(text, sub) {
      els.banner.innerHTML = `<div class="banner-big">${text}</div><div class="banner-sub">${sub || ''}</div>`;
      els.banner.style.display = 'block';
    },
    hideBanner() {
      els.banner.style.display = 'none';
    },

    tick(dt) {
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) els.toast.style.opacity = '0';
      }
    },

    update(w) {
      els.cash.textContent = `$${w.cash.toLocaleString('en-US')}`;
      const m = MISSIONS[w.missions.index];
      els.missionTitle.textContent = m ? m.title : 'Solara Bay';
      els.missionText.textContent = w.missions.active ? w.missions.text() : 'All missions complete — free roam!';
      const t = w.missions.target;
      let dist = '';
      if (t) {
        const d = Math.round(Math.hypot(w.player.x - t.x, w.player.z - t.z));
        dist = `${d} m`;
        // Compass arrow: rotate toward the target relative to the camera.
        const ang = Math.atan2(t.x - w.player.x, t.z - w.player.z) - w.camYaw;
        els.compass.style.transform = `translateX(-50%) rotate(${-ang}rad)`;
        els.compass.style.display = 'block';
      } else {
        els.compass.style.display = 'none';
      }
      els.missionDist.textContent = dist;
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += i < w.police.stars ? '★' : '☆';
      els.stars.textContent = stars;
      els.stars.style.color = w.police.stars > 0 ? '#ffd23b' : '#8a93a3';
      els.healthFill.style.width = `${Math.max(0, w.player.health)}%`;
      els.healthFill.style.background = w.player.health > 50 ? '#7ae08a' : w.player.health > 25 ? '#ffd23b' : '#ff6a5a';
      if (w.player.car) {
        els.speed.textContent = `${Math.round(Math.abs(w.player.car.speed) * 3.6)} km/h`;
      } else {
        els.speed.textContent = 'On foot';
      }
      const timer = w.missions.timer;
      els.timer.textContent = timer > 0 ? `⏱ ${Math.ceil(timer)}s` : '';
      els.timer.style.color = timer > 0 && timer < 20 ? '#ff6a5a' : '#ffd23b';
      hud.drawMinimap(w);
    },

    drawMinimap(w) {
      const S = 200;
      const minX = -280, maxX = 360, minZ = -280, maxZ = 280;
      const sx = (x) => ((x - minX) / (maxX - minX)) * S;
      const sz = (z) => ((z - minZ) / (maxZ - minZ)) * S;
      mm.fillStyle = '#20242e';
      mm.fillRect(0, 0, S, S);
      // Sea + sand (east).
      mm.fillStyle = '#1d6f8f';
      mm.fillRect(sx(330), 0, S - sx(330), S);
      mm.fillStyle = '#e0c188';
      mm.fillRect(sx(272), 0, sx(330) - sx(272), S);
      // Roads.
      mm.strokeStyle = '#5a5a66';
      mm.lineWidth = 3;
      for (const c of WORLD.roads) {
        mm.beginPath(); mm.moveTo(sx(-270), sz(c)); mm.lineTo(sx(270), sz(c)); mm.stroke();
        mm.beginPath(); mm.moveTo(sx(c), sz(-270)); mm.lineTo(sx(c), sz(270)); mm.stroke();
      }
      // Buildings.
      mm.fillStyle = '#8a7f6d';
      for (const col of w.city.colliders) {
        mm.fillRect(sx(col.minX), sz(col.minZ), Math.max(1, sx(col.maxX) - sx(col.minX)), Math.max(1, sz(col.maxZ) - sz(col.minZ)));
      }
      // Mission target.
      const t = w.missions.target;
      if (t) {
        mm.fillStyle = '#39c2ff';
        const x = sx(t.x), y = sz(t.z);
        mm.beginPath();
        mm.moveTo(x, y - 6); mm.lineTo(x + 6, y); mm.lineTo(x, y + 6); mm.lineTo(x - 6, y);
        mm.closePath(); mm.fill();
      }
      // Traffic dots.
      mm.fillStyle = '#c8c8c8';
      for (const car of w.traffic.cars) mm.fillRect(sx(car.x) - 1.5, sz(car.z) - 1.5, 3, 3);
      // Police dots (flashing red/blue).
      for (const cop of w.police.cars) {
        mm.fillStyle = Math.floor(w.time * 3) % 2 ? '#ff4040' : '#4080ff';
        mm.beginPath(); mm.arc(sx(cop.x), sz(cop.z), 3.5, 0, Math.PI * 2); mm.fill();
      }
      // Player arrow.
      const px = sx(w.player.x), py = sz(w.player.z);
      mm.save();
      mm.translate(px, py);
      mm.rotate(w.player.heading);
      mm.fillStyle = '#ffd23b';
      mm.beginPath();
      mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(-5, 6);
      mm.closePath(); mm.fill();
      mm.restore();
      // North tick.
      mm.fillStyle = '#eef1f5';
      mm.font = 'bold 11px system-ui, sans-serif';
      mm.fillText('N', 4, 12);
    },
  };
  return hud;
}
