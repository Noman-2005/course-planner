/* ---------- Tick sounds (Web Audio, no audio files needed) ---------- */
const KEY = "cp-sound";

let ctx = null;
let out = null;
let noise = null;

export function isSoundOn() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();

  // compressor so quick repeated clicks never distort
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(comp);
  comp.connect(ctx.destination);
  out = master;

  // 40ms white noise, reused for every click
  const len = Math.floor(ctx.sampleRate * 0.04);
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

// one tick at time t; f = body pitch, v = loudness
function tick(t, f, v) {
  // 1) click transient
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 3800;
  bp.Q.value = 1.1;
  const gc = ctx.createGain();
  gc.gain.setValueAtTime(0.0001, t);
  gc.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.001);
  gc.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
  src.connect(bp);
  bp.connect(gc);
  gc.connect(out);
  src.start(t);
  src.stop(t + 0.04);

  // 2) body: quick pitch drop = round "pock"
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.055);
  const go = ctx.createGain();
  go.gain.setValueAtTime(0.0001, t);
  go.gain.exponentialRampToValueAtTime(0.42 * v, t + 0.002);
  go.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(go);
  go.connect(out);
  o.start(t);
  o.stop(t + 0.12);

  // 3) glassy "ting" on top
  const h = ctx.createOscillator();
  h.type = "triangle";
  h.frequency.setValueAtTime(f * 2.7, t);
  const gh = ctx.createGain();
  gh.gain.setValueAtTime(0.0001, t);
  gh.gain.exponentialRampToValueAtTime(0.07 * v, t + 0.002);
  gh.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  h.connect(gh);
  gh.connect(out);
  h.start(t);
  h.stop(t + 0.07);
}

/**
 * kind: "select" | "deselect" | "add"
 */
export function playTick(kind = "select") {
  if (!isSoundOn()) return;
  try {
    const c = ensure();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    const t = c.currentTime + 0.005;
    const jitter = 1 + (Math.random() - 0.5) * 0.06; // ±3%

    if (kind === "add") {
      tick(t, 900 * jitter, 0.85);
      tick(t + 0.065, 1350 * jitter, 1);
    } else if (kind === "deselect") {
      tick(t, 620 * jitter, 0.6);
    } else {
      tick(t, 1150 * jitter, 1);
    }
  } catch {
    /* sound must never break the app */
  }
}