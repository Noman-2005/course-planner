import { useEffect, useRef, useState } from "react";

export const DAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
export const HUES = [217, 142, 22, 271, 336, 174, 45, 0];

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const pad = (n) => String(n).padStart(2, "0");
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
export const slug = (s) =>
  String(s || "routine")
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "routine";

export const toMin = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
};

export const fmt = (t) => {
  const m = toMin(t);
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${pad(mm)} ${ap}`;
};

export const hourLabel = (minutes) => {
  let h = Math.floor(minutes / 60) % 24;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h} ${ap}`;
};

export const fmtDur = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

/* ---------- conflicts & layout ---------- */
export const sharedDays = (a, b) => DAYS.filter((d) => a.days.includes(d) && b.days.includes(d));
export const overlaps = (a, b) =>
  sharedDays(a, b).length > 0 && toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);

export function findConflicts(items) {
  const pairs = [];
  const ids = new Set();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (overlaps(a, b)) {
        pairs.push({ a, b, shared: sharedDays(a, b) });
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return { pairs, ids };
}

export function layoutDay(items, day) {
  const list = items
    .filter((c) => c.days.includes(day))
    .sort((a, b) => toMin(a.start) - toMin(b.start) || toMin(a.end) - toMin(b.end));
  const laneEnds = [];
  const out = [];
  for (const c of list) {
    let lane = laneEnds.findIndex((e) => e <= toMin(c.start));
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = toMin(c.end);
    out.push({ c, lane });
  }
  return out.map((o) => ({ ...o, lanes: laneEnds.length }));
}

/* ---------- days / time parsing ---------- */
export function parseDays(text) {
  const toks = String(text || "")
    .split(/[\s,;/+&]+/)
    .filter(Boolean);
  const set = new Set();
  const bad = [];
  for (const t of toks) {
    const k = cap(t.slice(0, 3));
    if (DAYS.includes(k) && /^[A-Za-z]+$/.test(t)) set.add(k);
    else bad.push(t);
  }
  return { days: DAYS.filter((d) => set.has(d)), bad };
}

export function parseRange(s) {
  const m = String(s).trim().match(/^(\d{1,2})[:.;](\d{2})\s*[-–—~]\s*(\d{1,2})[:.;](\d{2})$/);
  if (!m) return null;
  const [a, b, c, d] = [+m[1], +m[2], +m[3], +m[4]];
  if (a > 23 || c > 23 || b > 59 || d > 59) return null;
  return { start: `${pad(a)}:${pad(b)}`, end: `${pad(c)}:${pad(d)}` };
}

/* ---------- schedule tokens shared by both importers ---------- */
const D = "(?:Sat|Sun|Mon|Tue|Wed|Thu|Fri)";
export const SCHED_SRC = `\\b${D}(?:[\\s,]+${D})*\\s*\\d{1,2}[:.;]\\d{2}\\s*[-–—~]\\s*\\d{1,2}[:.;]\\d{2}`;
const SCHED_ONE = new RegExp(`^(${D}(?:[\\s,]+${D})*)\\s*(\\d{1,2})[:.;](\\d{2})\\s*[-–—~]\\s*(\\d{1,2})[:.;](\\d{2})$`, "i");

// "Sat 08:30–11:00" -> [{day,start,end}] or null
export function parseSchedToken(s) {
  const m = String(s).trim().match(SCHED_ONE);
  if (!m) return null;
  const [a, b, c, d] = [+m[2], +m[3], +m[4], +m[5]];
  if (a > 23 || c > 23 || b > 59 || d > 59) return null;
  const start = `${pad(a)}:${pad(b)}`;
  const end = `${pad(c)}:${pad(d)}`;
  return m[1].split(/[\s,]+/).map((day) => ({ day: cap(day), start, end }));
}

// several distinct time ranges -> keep the most frequent one (+ warning)
export function resolveSchedule(label, entries, warnings) {
  if (!entries.length) return null;
  const cnt = new Map();
  for (const e of entries) {
    const k = e.start + "-" + e.end;
    cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  let best = null;
  let bc = 0;
  for (const [k, c] of cnt) {
    if (c > bc) {
      best = k;
      bc = c;
    }
  }
  if (cnt.size > 1) warnings.push(`${label}: several time ranges found, kept ${best.replace("-", "–")}`);
  const [start, end] = best.split("-");
  const days = DAYS.filter((d) => entries.some((e) => e.day === d && e.start + "-" + e.end === best));
  return { days, start, end };
}

/* ---------- faculty name rule ---------- */
export const isShortCode = (s) => /^\S+$/.test(s) && (s.match(/[A-Z]/g) || []).length >= 2;

// join all lines; drop ONLY a trailing single-token short-code line (FAH, MahHsn, TBA...)
export function joinFaculty(lines) {
  let L = lines.map((s) => String(s).trim()).filter(Boolean);
  if (L.length > 1 && isShortCode(L[L.length - 1])) L = L.slice(0, -1);
  return L.join(" ").replace(/\s+/g, " ").trim();
}

/* ---------- page header + post warnings ---------- */
export function parseHeader(text) {
  const c = text.match(/(\d+)\s+courses?\b/i);
  const cr = text.match(/(\d+(?:\.\d+)?)\s+credits?\b/i);
  const pt = text.match(/\b([A-Z]{2,8})\s*[·•|\-–]\s*([A-Za-z]+\s?\d{2})\b/);
  return {
    program: pt ? pt[1] : "",
    term: pt ? pt[2].replace(/\s/g, "") : "",
    expected: { courses: c ? +c[1] : null, credits: cr ? parseFloat(cr[1]) : null },
  };
}

export function postWarnings(courses, warnings) {
  for (const c of courses) {
    if (!c.sections.length) {
      warnings.push(`${c.code}: no sections found`);
      continue;
    }
    const letters = c.sections.map((s) => s.sec).filter((x) => /^[A-Z]$/.test(x)).sort();
    if (letters.length > 1) {
      const lo = letters[0].charCodeAt(0);
      const hi = letters[letters.length - 1].charCodeAt(0);
      for (let k = lo; k <= hi; k++) {
        const L = String.fromCharCode(k);
        if (!letters.includes(L)) warnings.push(`${c.code}: section ${L} missing? please check`);
      }
    }
  }
}

/* ---------- hooks ---------- */
export function useLocalStorage(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const r = localStorage.getItem(key);
      return r == null ? initial : JSON.parse(r);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  }, [key, v]);
  return [v, setV];
}

// Escape closes only the top-most modal
const escStack = [];
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && escStack.length) {
      e.stopPropagation();
      escStack[escStack.length - 1].current();
    }
  });
}
export function useEscape(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    escStack.push(ref);
    return () => {
      const i = escStack.indexOf(ref);
      if (i >= 0) escStack.splice(i, 1);
    };
  }, []);
}