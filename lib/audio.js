// Client-only: ambient room sound, effects and Mira's voice. Everything is a no-op while sound is off.
let actx = null, master = null, on = false, voice = null;

function init() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = 0; master.connect(actx.destination);
    const lp = actx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.connect(master);
    const dg = actx.createGain(); dg.gain.value = 0.045; dg.connect(lp);
    [[55, "sine"], [82.4, "sine"], [110.3, "triangle"], [164.6, "sine"]].forEach(([f, type], i) => {
      const o = actx.createOscillator(); o.type = type; o.frequency.value = f;
      const g = actx.createGain(); g.gain.value = i === 2 ? 0.35 : 0.6;
      const l = actx.createOscillator(); l.frequency.value = 0.05 + i * 0.03;
      const lg = actx.createGain(); lg.gain.value = 0.3; l.connect(lg).connect(g.gain);
      o.connect(g).connect(dg); o.start(); l.start();
    });
    setInterval(() => { if (on && Math.random() < 0.5) bell([659.25, 783.99, 987.77, 1174.66][Math.floor(Math.random() * 4)], 0.025); }, 6000);
    setInterval(() => { if (on && Math.random() < 0.35) flick(1 + Math.floor(Math.random() * 2), 0.05, 0.035); }, 420);
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

function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices(); if (!vs.length) return null;
    const pref = /(Veena|Isha|Raveena|Heera|Neerja|Lekha|Samantha|Moira|Tessa|Karen|Serena|Fiona|Victoria|Google UK English Female|Zira|Aria|Jenny|Female)/i;
    return vs.find((v) => /en-IN/i.test(v.lang) && pref.test(v.name)) || vs.find((v) => pref.test(v.name) && /^en/i.test(v.lang)) || vs.find((v) => /en-IN/i.test(v.lang)) || null;
  } catch { return null; }
}

// Resolves when Mira has finished the line (spoken aloud if sound is on, otherwise timed to reading speed).
function speak(text) {
  const est = 500 + text.length * 55;
  return new Promise((resolve) => {
    let done = false; const finish = () => { if (!done) { done = true; resolve(); } };
    if (on && typeof speechSynthesis !== "undefined") {
      try {
        const u = new SpeechSynthesisUtterance(text);
        voice = voice || pickVoice(); if (voice) u.voice = voice;
        u.rate = 0.9; u.pitch = 1.1; u.volume = 0.95; u.onend = finish; u.onerror = finish;
        speechSynthesis.speak(u); setTimeout(finish, est * 2.5); return;
      } catch { /* fall through to timed */ }
    }
    setTimeout(finish, est * 0.75);
  });
}
function hush() { try { speechSynthesis.cancel(); } catch { /* no speech engine */ } }

function setSound(v) {
  on = v;
  if (v) { init(); try { actx && actx.resume(); } catch { /* ignore */ } }
  if (master) master.gain.setTargetAtTime(v ? 1 : 0, actx.currentTime, 0.3);
  if (!v) hush();
}

export const audio = { setSound, bell, chime, flick, wind, speak, hush, get on() { return on; } };
