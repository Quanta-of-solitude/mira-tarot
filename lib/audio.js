// Client-only: the room's music and sound effects. Everything is a no-op while sound is off.
let actx = null, master = null, fx = null, on = false;

/* ---------- music: a generated evening raga ----------
   A tanpura drone (plucked Pa-Sa-Sa-Sa, looping), slow santoor-like phrases in raga Bhupali
   (Sa Re Ga Pa Dha, a calm pentatonic), a soft pad underneath, and a long reverb.
   Strings are synthesised with the Karplus-Strong algorithm, rendered once into buffers. */
const SA = 146.83; // D3
const BHUPALI = [0, 2, 4, 7, 9]; // semitones above Sa
const st = (n) => SA * Math.pow(2, n / 12);

function pluckBuffer(freq, seconds, { decay = 0.996, bright = 0.5, buzz = 0 } = {}) {
  const sr = actx.sampleRate, N = Math.max(2, Math.round(sr / freq - 0.5)), len = Math.floor(sr * seconds);
  const buf = actx.createBuffer(1, len, sr), out = buf.getChannelData(0), line = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; prev = prev + bright * (w - prev); line[i] = prev; } // softened excitation
  let idx = 0, last = 0, peak = 0;
  for (let i = 0; i < len; i++) {
    const cur = line[idx], next = line[(idx + 1) % N];
    let y = decay * 0.5 * (cur + next);
    line[idx] = y; idx = (idx + 1) % N;
    let v = cur * 0.85 + last * 0.15; last = cur;
    if (buzz) v += buzz * 0.35 * Math.tanh(3 * v) * Math.abs(v); // a little jawari: the tanpura's buzzing bridge
    out[i] = v; peak = Math.max(peak, Math.abs(v));
  }
  const fade = Math.floor(sr * 0.3);
  for (let i = 0; i < len; i++) { out[i] /= peak || 1; if (i > len - fade) out[i] *= (len - i) / fade; }
  return { buf, rate: freq / (sr / (N + 0.5)) };
}

function reverb(seconds = 4.5) {
  const sr = actx.sampleRate, len = Math.floor(sr * seconds), ir = actx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  const conv = actx.createConvolver(); conv.buffer = ir; return conv;
}

const voices = {};
function play(key, when, gain, pan = 0) {
  const v = voices[key]; if (!v) return;
  const s = actx.createBufferSource(); s.buffer = v.buf; s.playbackRate.value = v.rate;
  const g = actx.createGain(); g.gain.value = gain;
  const p = actx.createStereoPanner ? actx.createStereoPanner() : null;
  if (p) { p.pan.value = pan; s.connect(g).connect(p).connect(fx); } else s.connect(g).connect(fx);
  s.start(when);
}

let nextTanpura = 0, nextPhrase = 0, nextBell = 0, tanStep = 0;
const TANPURA = [["pa", 0.9, -0.35], ["sa2", 0.75, 0.15], ["sa2", 0.7, 0.3], ["sa", 1, -0.1]];
function phrase(t0) {
  // A short melodic phrase that wanders around the scale and comes to rest on Sa, Ga or Pa.
  let deg = [0, 2, 3, 4, 5][Math.floor(Math.random() * 5)], t = t0;
  const n = 3 + Math.floor(Math.random() * 4);
  for (let k = 0; k < n; k++) {
    deg = Math.max(0, Math.min(9, deg + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
    if (k === n - 1) deg = [0, 2, 3, 5][Math.floor(Math.random() * 4)];
    const key = "m" + deg;
    play(key, t, 0.16 + Math.random() * 0.05, (Math.random() - 0.5) * 0.6);
    if (Math.random() < 0.25) play(key, t + 0.11, 0.06, 0.2); // santoor-like double strike
    t += [0.45, 0.6, 0.6, 0.9, 1.2][Math.floor(Math.random() * 5)];
  }
  return t;
}
function schedule() {
  if (!on || !actx) return;
  const now = actx.currentTime, ahead = now + 1.2;
  if (nextTanpura < now) nextTanpura = now + 0.1;
  while (nextTanpura < ahead) {
    const [k, g, pan] = TANPURA[tanStep % 4]; play(k, nextTanpura, 0.32 * g, pan);
    nextTanpura += tanStep % 4 === 3 ? 2.1 : 1.15; tanStep++;
  }
  if (!nextPhrase) nextPhrase = now + 6;
  if (nextPhrase < ahead) { const end = phrase(Math.max(nextPhrase, now + 0.05)); nextPhrase = end + 5 + Math.random() * 9; }
  if (!nextBell) nextBell = now + 14;
  if (nextBell < ahead) { bell(st(BHUPALI[Math.floor(Math.random() * 5)] + 24), 0.012, nextBell - now); nextBell += 18 + Math.random() * 20; }
}

function init() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = 0; master.connect(actx.destination);
    // everything musical goes through fx: a dry path and a long, dark reverb
    fx = actx.createGain();
    const dry = actx.createGain(); dry.gain.value = 0.55;
    const wet = actx.createGain(); wet.gain.value = 0.5;
    const tone = actx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 3800;
    const verb = reverb();
    fx.connect(tone); tone.connect(dry).connect(master); tone.connect(verb).connect(wet).connect(master);
    // strings, rendered once
    voices.sa = pluckBuffer(st(-12), 4.5, { decay: 0.9985, bright: 0.35, buzz: 0.9 });
    voices.sa2 = pluckBuffer(st(0), 4, { decay: 0.998, bright: 0.4, buzz: 0.9 });
    voices.pa = pluckBuffer(st(-5), 4, { decay: 0.998, bright: 0.4, buzz: 0.9 });
    for (let d = 0; d < 10; d++) { const semis = BHUPALI[d % 5] + 12 * Math.floor(d / 5); voices["m" + d] = pluckBuffer(st(semis + 12), 3, { decay: 0.9965, bright: 0.75 }); }
    // a soft pad on Sa and Pa that breathes slowly
    const pad = actx.createGain(); pad.gain.value = 0.035;
    const lp = actx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600; lp.connect(pad); pad.connect(fx);
    [[st(-12), 0], [st(-5), 0.03], [st(0), -0.02]].forEach(([f, det], i) => {
      const o = actx.createOscillator(); o.type = i === 1 ? "triangle" : "sine"; o.frequency.value = f; o.detune.value = det * 100;
      const g = actx.createGain(); g.gain.value = 0.5;
      const l = actx.createOscillator(); l.frequency.value = 0.04 + i * 0.025; const lg = actx.createGain(); lg.gain.value = 0.35; l.connect(lg).connect(g.gain);
      o.connect(g).connect(lp); o.start(); l.start();
    });
    setInterval(schedule, 250);
    // the candles crackle now and then
    setInterval(() => { if (on && Math.random() < 0.25) flick(1 + Math.floor(Math.random() * 2), 0.05, 0.03); }, 520);
  } catch { actx = null; }
}

function bell(f, vol = 0.08, delay = 0) {
  if (!actx || !on) return;
  const t = actx.currentTime + delay;
  [1, 2.01, 3.02].forEach((m, i) => {
    const o = actx.createOscillator(), g = actx.createGain(); o.type = "sine"; o.frequency.value = f * m;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol / (i + 1), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6 / (i + 1));
    o.connect(g).connect(master); o.start(t); o.stop(t + 2.8);
  });
}
function chime() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, 0.09, i * 0.1)); }
function flick(n = 1, spacing = 0.035, vol = 0.25) {
  if (!actx || !on) return;
  const len = Math.floor(actx.sampleRate * 0.03), buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  for (let k = 0; k < n; k++) {
    const s = actx.createBufferSource(); s.buffer = buf;
    const f = actx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2200 + Math.random() * 1800;
    const g = actx.createGain(); g.gain.value = vol * (0.6 + Math.random() * 0.4);
    s.connect(f).connect(g).connect(master); s.start(actx.currentTime + k * spacing + Math.random() * 0.01);
  }
}
function wind() {
  if (!actx || !on) return;
  const len = Math.floor(actx.sampleRate * 2.2), buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = actx.createBufferSource(); s.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 0.8; const t0 = actx.currentTime;
  f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(1200, t0 + 0.7); f.frequency.exponentialRampToValueAtTime(250, t0 + 2.1);
  const g = actx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.16, t0 + 0.5); g.gain.exponentialRampToValueAtTime(0.001, t0 + 2.1);
  s.connect(f).connect(g).connect(master); s.start();
}

// Mira has no spoken voice: browser text-to-speech voices vary by device and often sound robotic or male.
// Lines are shown as subtitles and timed to a calm reading speed; the room's music and effects keep playing.
function speak(text) {
  const ms = 900 + text.length * 48;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function hush() {}

function setSound(v) {
  on = v;
  if (v) { init(); try { actx && actx.resume(); } catch { /* ignore */ } }
  if (master) master.gain.setTargetAtTime(v ? 1 : 0, actx.currentTime, 0.3);
  if (!v) hush();
}

export const audio = { setSound, bell, chime, flick, wind, speak, hush, get on() { return on; } };
