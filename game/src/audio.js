// All sound is synthesised in WebAudio: engine hum, sirens, gunshots, chimes
// and a slow sunset pad. No audio files, no network. Everything is a no-op
// until init() runs on a user gesture (and never runs in screenshot mode).
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    musicTimer: null,
    engineNodes: null,
    sirenNodes: null,
    enabled: true,

    init() {
      if (!audio.enabled || audio.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audio.ctx = new AC();
        audio.master = audio.ctx.createGain();
        audio.master.gain.value = 0.5;
        audio.master.connect(audio.ctx.destination);
        audio.startMusic();
      } catch (_) {
        audio.ctx = null;
      }
    },

    setMuted(m) {
      audio.muted = m;
      if (audio.master) audio.master.gain.value = m ? 0 : 0.5;
    },

    // A two-note engine hum whose pitch follows speed (0..1).
    engine(speed01, on) {
      if (!audio.ctx) return;
      if (!on) {
        if (audio.engineNodes) {
          try { audio.engineNodes.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1); } catch (_) {}
          audio.engineNodes = null;
        }
        return;
      }
      if (!audio.engineNodes) {
        const osc = audio.ctx.createOscillator();
        osc.type = 'sawtooth';
        const sub = audio.ctx.createOscillator();
        sub.type = 'square';
        const gain = audio.ctx.createGain();
        gain.gain.value = 0.05;
        const filter = audio.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        osc.connect(filter);
        sub.connect(filter);
        filter.connect(gain);
        gain.connect(audio.master);
        osc.start();
        sub.start();
        audio.engineNodes = { osc, sub, gain, filter };
      }
      const n = audio.engineNodes;
      const t = audio.ctx.currentTime;
      const base = 55 + speed01 * 130;
      n.osc.frequency.setTargetAtTime(base, t, 0.08);
      n.sub.frequency.setTargetAtTime(base / 2, t, 0.08);
      n.filter.frequency.setTargetAtTime(300 + speed01 * 900, t, 0.1);
      n.gain.gain.setTargetAtTime(0.04 + speed01 * 0.05, t, 0.1);
    },

    // Two-tone police siren while any police car is active.
    siren(on) {
      if (!audio.ctx) return;
      if (!on) {
        if (audio.sirenNodes) {
          try { audio.sirenNodes.osc.stop(); audio.sirenNodes.gain.disconnect(); } catch (_) {}
          audio.sirenNodes = null;
        }
        return;
      }
      if (audio.sirenNodes) return;
      const osc = audio.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 700;
      const lfo = audio.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 1.4;
      const lfoGain = audio.ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const gain = audio.ctx.createGain();
      gain.gain.value = 0.035;
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start();
      lfo.start();
      audio.sirenNodes = { osc, lfo, gain };
    },

    blip(freq, dur, type, vol, when = 0) {
      if (!audio.ctx) return;
      const t = audio.ctx.currentTime + when;
      const osc = audio.ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const gain = audio.ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    noiseBurst(dur, vol) {
      if (!audio.ctx) return;
      const len = Math.floor(audio.ctx.sampleRate * dur);
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const gain = audio.ctx.createGain();
      gain.gain.value = vol;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1800;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      src.start();
    },

    shot() { audio.noiseBurst(0.14, 0.3); audio.blip(160, 0.1, 'square', 0.12); },
    punch() { audio.noiseBurst(0.08, 0.2); },
    pickup() { audio.blip(660, 0.12, 'sine', 0.14); audio.blip(880, 0.18, 'sine', 0.14, 0.1); },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => audio.blip(f, 0.22, 'triangle', 0.14, i * 0.11));
    },
    busted() { audio.blip(220, 0.5, 'sawtooth', 0.16); audio.blip(165, 0.7, 'sawtooth', 0.16, 0.4); },
    click() { audio.blip(440, 0.06, 'sine', 0.1); },
    crash() { audio.noiseBurst(0.25, 0.3); },

    // Slow sunset pad: Am – F – C – G, one soft chord every 4 s.
    startMusic() {
      if (!audio.ctx || audio.musicTimer) return;
      const chords = [
        [220, 261.6, 329.6],
        [174.6, 220, 261.6],
        [130.8, 196, 246.9],
        [196, 246.9, 293.7],
      ];
      let step = 0;
      audio.musicTimer = window.setInterval(() => {
        if (audio.muted || !audio.ctx) return;
        const chord = chords[step % chords.length];
        step += 1;
        chord.forEach((f) => {
          const osc = audio.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = f;
          const gain = audio.ctx.createGain();
          gain.gain.setValueAtTime(0.0001, audio.ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.035, audio.ctx.currentTime + 1.2);
          gain.gain.linearRampToValueAtTime(0.0001, audio.ctx.currentTime + 3.8);
          osc.connect(gain);
          gain.connect(audio.master);
          osc.start();
          osc.stop(audio.ctx.currentTime + 4);
        });
      }, 4000);
    },
  };
  return audio;
}
