// Cross-device sync. Each browser gets a private random code; the code unlocks the saved data anywhere.
// Local storage stays the source of truth — changes are pushed (debounced), and a newer remote copy is pulled on start.

export const SYNC_KEYS = [
  "cp-dept",
  "cp-added",
  "cp-custom",
  "cp-picks",
  "cp-plans",
  "cp-title",
  "cp-auto-mode",
  "cp-grad",
  "cp-profile-name",
];

// values that mean "nothing saved yet" — they are never uploaded
const DEFAULTS = {
  "cp-dept": '""',
  "cp-added": "[]",
  "cp-custom": "[]",
  "cp-picks": "{}",
  "cp-plans": "[]",
  "cp-title": '"My Semester Routine"',
  "cp-auto-mode": '"default"',
  "cp-grad": "{}",
  "cp-profile-name": '""',
};

const K_CODE = "cp-sync-code";
const K_VER = "cp-sync-ver"; // server version this device last synced with
const K_HASH = "cp-sync-hash"; // hash of the data this device last synced
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1
const CODE_RE = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

const ls = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

/* ---------- code ---------- */

function randomCode() {
  const out = [];
  const buf = new Uint8Array(64);
  while (out.length < 12) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < 248 && out.length < 12) out.push(ALPHABET[b % 31]); // 248 = 31 * 8, no modulo bias
    }
  }
  return `${out.slice(0, 4).join("")}-${out.slice(4, 8).join("")}-${out.slice(8).join("")}`;
}

export function normalizeCode(input) {
  const s = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length !== 12) return null;
  const c = `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
  return CODE_RE.test(c) ? c : null;
}

// The code only exists once the person turns sync on (Generate a code, or Sync with an existing one).
export function getCode() {
  const have = ls.get(K_CODE);
  return have && CODE_RE.test(have) ? have : null;
}

// Turns sync on for this device with a brand-new code and backs up what is already here.
export function createCode() {
  const code = randomCode();
  ls.set(K_CODE, code);
  ls.del(K_VER);
  ls.del(K_HASH);
  push(false);
  return code;
}

// Turns sync off for this device. By default the data stays here and just stops syncing.
// With { wipe: true } it also removes this device's saved data (the synced copy on the server is untouched).
export async function syncOut({ wipe = false } = {}) {
  clearTimeout(timer);

  if (wipe && ls.get(K_CODE)) {
    // make sure the latest local changes are saved to the server first, so nothing is lost
    const unsaved = Object.keys(snapshot()).length > 0 && hashOf(snapshot()) !== ls.get(K_HASH);
    if (unsaved) {
      await push(false);
      if (hashOf(snapshot()) !== ls.get(K_HASH)) throw new Error("backup failed");
    }
  }

  ls.del(K_CODE);
  ls.del(K_VER);
  ls.del(K_HASH);
  if (wipe) for (const k of SYNC_KEYS) ls.del(k);
  setStatus("idle");
}

/* ---------- snapshot ---------- */

function snapshot() {
  const data = {};
  for (const k of SYNC_KEYS) {
    const v = ls.get(k);
    if (v == null || v === DEFAULTS[k]) continue;
    data[k] = v;
  }
  return data;
}

function hashOf(data) {
  const s = JSON.stringify(SYNC_KEYS.map((k) => (k in data ? data[k] : null)));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h) + ":" + s.length;
}

function applyRemote(data) {
  for (const k of SYNC_KEYS) {
    if (typeof data[k] === "string") ls.set(k, data[k]);
    else ls.del(k);
  }
}

/* ---------- status (for the little indicator) ---------- */

let status = "idle"; // idle | syncing | synced | offline
const listeners = new Set();
function setStatus(s) {
  status = s;
  listeners.forEach((fn) => fn(s));
}
export const getStatus = () => status;
export function onStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------- network ---------- */

async function call(body, keepalive = false) {
  const r = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    keepalive,
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("sync failed");
  return r.json();
}

let pushing = null;
let timer = 0;

async function push(keepalive = false) {
  const code = ls.get(K_CODE);
  if (!code) return;
  const data = snapshot();
  const h = hashOf(data);
  const nothingToSave = !Object.keys(data).length && !ls.get(K_VER); // never create an empty record
  if (h === ls.get(K_HASH) || nothingToSave) {
    setStatus("synced");
    return;
  }
  if (pushing && !keepalive) {
    await pushing;
  }
  setStatus("syncing");
  const run = (async () => {
    try {
      const res = await call({ action: "push", code, data }, keepalive);
      ls.set(K_VER, String(res.updatedAt));
      ls.set(K_HASH, h);
      setStatus(hashOf(snapshot()) === h ? "synced" : "syncing");
    } catch {
      setStatus("offline");
    }
  })();
  pushing = run;
  await run;
  if (pushing === run) pushing = null;
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => push(false), 1500);
}

/* ---------- start ---------- */

let started = false;

function initListeners() {
  if (started) return;
  started = true;
  window.addEventListener("cp-local-change", schedule);
  window.addEventListener("online", () => push(false));
  window.addEventListener("pagehide", () => {
    clearTimeout(timer);
    if (ls.get(K_CODE) && hashOf(snapshot()) !== ls.get(K_HASH)) push(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && ls.get(K_CODE) && hashOf(snapshot()) !== ls.get(K_HASH)) {
      clearTimeout(timer);
      push(true);
    }
  });
}

// Returns true if newer data from another device was applied (the page then needs a reload).
export async function startSync() {
  initListeners();
  const code = getCode();
  if (!code) return false; // sync is not turned on here: nothing is created or sent

  setStatus("syncing");
  try {
    const meta = await call({ action: "meta", code });
    const local = snapshot();
    const clean = hashOf(local) === ls.get(K_HASH);
    const ver = Number(ls.get(K_VER)) || 0;

    if (meta && meta.updatedAt > ver && clean) {
      const full = await call({ action: "pull", code });
      if (full && full.data) {
        applyRemote(full.data);
        ls.set(K_VER, String(full.updatedAt));
        ls.set(K_HASH, hashOf(snapshot()));
        setStatus("synced");
        return true;
      }
    }

    if (!meta) {
      // nothing on the server yet: back up whatever this device already has (never an empty snapshot)
      if (Object.keys(local).length) await push(false);
      else setStatus("synced");
    } else if (!clean) {
      await push(false); // this device has newer unsynced changes
    } else {
      setStatus("synced");
    }
  } catch {
    setStatus("offline");
  }
  return false;
}

/* ---------- restore on another device ---------- */

export const hasLocalData = () => Object.keys(snapshot()).length > 0;


// Looks the code up without changing anything. -> { updatedAt, data } | null (not found)
export async function lookupCode(input) {
  const code = normalizeCode(input);
  if (!code) throw new Error("invalid");
  const res = await call({ action: "pull", code });
  return res ? { code, ...res } : null;
}

// Replaces this device's data with the saved copy and adopts the code.
export function adoptRemote({ code, updatedAt, data }) {
  clearTimeout(timer);
  applyRemote(data || {});
  ls.set(K_CODE, code);
  ls.set(K_VER, String(updatedAt));
  ls.set(K_HASH, hashOf(snapshot()));
}