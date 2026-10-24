import { DAYS, HUES, toMin } from "./utils.js";

const b64u = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64u = (str) => {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
async function pipe(stream, bytes) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

const clamp = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, "").trim().slice(0, n);
const clampNum = (v) => Math.min(Math.max(Number(v) || 0, 0), 30);
const validTime = (t) => {
  if (!/^\d{2}:\d{2}$/.test(t)) return false;
  const [h, m] = t.split(":").map(Number);
  return h < 24 && m < 60;
};

export async function encodeShare(title, items) {
  const rows = items.map((i) => [i.code, i.title, i.credit, i.section, i.faculty, i.room, i.days.join(""), i.start, i.end]);
  const bytes = new TextEncoder().encode(JSON.stringify([title, rows]));
  if (typeof CompressionStream !== "undefined") {
    try {
      return "z" + b64u(await pipe(new CompressionStream("deflate-raw"), bytes));
    } catch {}
  }
  return "p" + b64u(bytes);
}

export async function decodeShare(payload) {
  try {
    if (typeof payload !== "string" || payload.length < 2 || payload.length > 20000) return null;
    const kind = payload[0];
    const body = payload.slice(1);
    if (!/^[A-Za-z0-9_-]+$/.test(body)) return null;
    let bytes = unb64u(body);
    if (kind === "z") {
      if (typeof DecompressionStream === "undefined") return null;
      bytes = await pipe(new DecompressionStream("deflate-raw"), bytes);
    } else if (kind !== "p") return null;
    if (bytes.length > 200000) return null;

    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(data) || !Array.isArray(data[1]) || data[1].length === 0 || data[1].length > 30) return null;

    const title = clamp(data[0], 80) || "Shared routine";
    const codes = [];
    const seen = new Set();
    const items = [];
    for (const r of data[1]) {
      if (!Array.isArray(r)) return null;
      const code = clamp(r[0], 24);
      const section = clamp(r[3], 12);
      const found = String(r[6] == null ? "" : r[6]).match(/Sat|Sun|Mon|Tue|Wed|Thu|Fri/g) || [];
      const days = DAYS.filter((d) => found.includes(d));
      const start = String(r[7]);
      const end = String(r[8]);
      if (!code || !section || !days.length || !validTime(start) || !validTime(end) || toMin(end) <= toMin(start)) return null;
      let ci = codes.indexOf(code);
      if (ci < 0) {
        codes.push(code);
        ci = codes.length - 1;
      }
      let id = code + section;
      while (seen.has(id)) id += "_";
      seen.add(id);
      items.push({
        id,
        code,
        title: clamp(r[1], 120) || code,
        credit: clampNum(r[2]),
        hue: HUES[ci % 8],
        section,
        faculty: clamp(r[4], 120),
        room: clamp(r[5], 60),
        days,
        start,
        end,
      });
    }
    return { title, items };
  } catch {
    return null;
  }
}