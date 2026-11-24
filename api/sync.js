// Device sync: every visitor owns a private random code; the code is the key to their saved data.
// POST /api/sync  { action: "meta" | "pull" | "push", code, data? }

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const CODE_RE = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;
const KEYS = [
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
const MAX_TOTAL = 400_000; // bytes of stored text
const TTL = 60 * 60 * 24 * 400; // refreshed on every use

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

const send = (res, code, body) => {
  res.setHeader("Cache-Control", "no-store");
  return res.status(code).json(body);
};

function cleanData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid data");
  const out = {};
  let total = 0;
  for (const k of KEYS) {
    const v = data[k];
    if (v === undefined || v === null) continue;
    if (typeof v !== "string") throw new Error(`Invalid value for ${k}`);
    try {
      JSON.parse(v);
    } catch {
      throw new Error(`Invalid value for ${k}`);
    }
    total += v.length;
    if (total > MAX_TOTAL) throw new Error("Data is too large");
    out[k] = v;
  }
  return out;
}

async function read(code) {
  const raw = await redis(["GET", `cp:user:${code}`]);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (!REDIS_URL || !REDIS_TOKEN) return send(res, 500, { error: "Storage is not configured" });
  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    const { action, code } = body || {};
    if (typeof code !== "string" || !CODE_RE.test(code)) return send(res, 400, { error: "Invalid code" });

    if (action === "meta" || action === "pull") {
      const rec = await read(code);
      if (!rec) return send(res, 404, { error: "Not found" });
      redis(["EXPIRE", `cp:user:${code}`, TTL]).catch(() => {});
      if (action === "meta") return send(res, 200, { updatedAt: rec.updatedAt });
      return send(res, 200, { updatedAt: rec.updatedAt, data: rec.data || {} });
    }

    if (action === "push") {
      const data = cleanData(body.data);
      const prev = await read(code);
      // strictly increasing, so "newer than what I last saw" always works across devices
      const updatedAt = Math.max(Date.now(), prev && prev.updatedAt ? prev.updatedAt + 1 : 0);
      await redis(["SET", `cp:user:${code}`, JSON.stringify({ updatedAt, data }), "EX", TTL]);
      return send(res, 200, { updatedAt });
    }

    return send(res, 400, { error: "Unknown action" });
  } catch (e) {
    return send(res, 400, { error: e.message || "Bad request" });
  }
}