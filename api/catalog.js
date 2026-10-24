import { createHash, timingSafeEqual } from "node:crypto";

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const DAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d.result;
}

const sha = (s) => createHash("sha256").update(String(s == null ? "" : s)).digest();
function passOk(input) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return timingSafeEqual(sha(input), sha(expected));
}

const normId = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9_-]+/g, "").slice(0, 20);
const str = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const okTime = (t) => /^\d{2}:\d{2}$/.test(t) && +t.slice(0, 2) < 24 && +t.slice(3) < 60;
const mins = (t) => +t.slice(0, 2) * 60 + +t.slice(3);

function cleanCourses(courses) {
  if (!Array.isArray(courses) || !courses.length || courses.length > 500) throw new Error("Invalid course list");
  const seen = new Set();
  const out = [];
  for (const c of courses) {
    const code = str(c && c.code, 24);
    if (!code || seen.has(code)) throw new Error(`Invalid or duplicate course code: ${code || "(empty)"}`);
    seen.add(code);
    if (!Array.isArray(c.sections) || !c.sections.length || c.sections.length > 150) throw new Error(`${code}: invalid sections`);
    const names = new Set();
    const sections = [];
    for (const s of c.sections) {
      const sec = str(s && s.sec, 8);
      const days = DAYS.filter((d) => Array.isArray(s.days) && s.days.includes(d));
      const start = str(s.start, 5);
      const end = str(s.end, 5);
      if (!sec || names.has(sec) || !days.length || !okTime(start) || !okTime(end) || mins(end) <= mins(start)) {
        throw new Error(`${code} section ${sec || "?"}: invalid data`);
      }
      names.add(sec);
      const seatsNum = s.seats === null || s.seats === undefined || s.seats === "" ? NaN : Number(s.seats);
      sections.push({
        sec,
        faculty: str(s.faculty, 120),
        days,
        start,
        end,
        room: str(s.room, 60),
        seats: Number.isFinite(seatsNum) ? Math.max(0, Math.min(9999, Math.round(seatsNum))) : null,
      });
    }
    out.push({ code, title: str(c.title, 120) || code, credit: Math.max(0, Math.min(12, Number(c.credit) || 0)), sections });
  }
  return out;
}

const send = (res, code, body) => res.status(code).json(body);
const readIndex = async () => {
  try {
    return JSON.parse((await redis(["GET", "cp:index"])) || "{}") || {};
  } catch {
    return {};
  }
};

async function handleGet(req, res) {
  const url = new URL(req.url, "http://localhost");
  const dept = url.searchParams.get("dept");
  if (dept) {
    const id = normId(dept);
    const raw = id ? await redis(["GET", `cp:dept:${id}`]) : null;
    if (!raw) return send(res, 404, { error: "Not found" });
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(raw);
  }
  const idx = await readIndex();
  const departments = Object.entries(idx)
    .map(([id, v]) => ({ id, term: v.term, updatedAt: v.updatedAt, count: v.count }))
    .sort((a, b) => a.id.localeCompare(b.id));
  res.setHeader("Cache-Control", "no-store");
  return send(res, 200, { departments });
}

async function handlePost(req, res) {
  let b = req.body;
  if (typeof b === "string") {
    try {
      b = JSON.parse(b);
    } catch {
      b = null;
    }
  }
  if (!b || typeof b !== "object") return send(res, 400, { error: "Bad request" });

  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const rl = `cp:rl:${ip}`;
  let tries = 0;
  try {
    tries = Number(await redis(["GET", rl])) || 0;
  } catch {}
  if (tries >= 10) return send(res, 429, { error: "Too many wrong attempts. Try again in 15 minutes." });

  if (!passOk(b.password)) {
    try {
      const n = await redis(["INCR", rl]);
      if (n === 1) await redis(["EXPIRE", rl, 900]);
    } catch {}
    await new Promise((r) => setTimeout(r, 700));
    return send(res, 401, { error: "Wrong password" });
  }

  if (b.action === "verify") return send(res, 200, { ok: true });

  if (b.action === "delete") {
    const id = normId(b.department);
    if (!id) return send(res, 400, { error: "Bad department" });
    await redis(["DEL", `cp:dept:${id}`]);
    const idx = await readIndex();
    delete idx[id];
    await redis(["SET", "cp:index", JSON.stringify(idx)]);
    return send(res, 200, { ok: true });
  }

  if (b.action === "publish") {
    const id = normId(b.department);
    if (!id) return send(res, 400, { error: "Enter a department name (letters and numbers)" });
    let courses;
    try {
      courses = cleanCourses(b.courses);
    } catch (e) {
      return send(res, 400, { error: e.message });
    }
    const term = str(b.term, 20);
    const updatedAt = Date.now();
    const json = JSON.stringify({ program: id, term, courses, updatedAt });
    if (json.length > 900000) return send(res, 413, { error: "The list is too large" });
    await redis(["SET", `cp:dept:${id}`, json]);
    const idx = await readIndex();
    idx[id] = { term, updatedAt, count: courses.length };
    await redis(["SET", "cp:index", JSON.stringify(idx)]);
    return send(res, 200, { ok: true, department: id, updatedAt });
  }

  return send(res, 400, { error: "Unknown action" });
}

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (!REDIS_URL || !REDIS_TOKEN) return send(res, 500, { error: "Storage is not configured on the server." });
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "POST") return await handlePost(req, res);
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed" });
  } catch (e) {
    return send(res, 500, { error: "Server error" });
  }
}