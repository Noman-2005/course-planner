// Visit counter.
// POST /api/hits  -> counts one visit and returns { total }
// GET  /api/hits  -> returns { total } (used by the live "Total hits" card in Admin)

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const KEY = "cp:hits";
const MAX_PER_HOUR = 40; // visits one IP address can add per hour (stops simple spamming)

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

const readTotal = async () => Number(await redis(["GET", KEY])) || 0;

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!REDIS_URL || !REDIS_TOKEN) return send(res, 500, { error: "Storage is not configured on the server." });
  try {
    if (req.method === "GET") return send(res, 200, { total: await readTotal() });

    if (req.method === "POST") {
      const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
      const rl = `cp:hitrl:${ip}`;
      const n = Number(await redis(["INCR", rl])) || 0;
      if (n === 1) await redis(["EXPIRE", rl, 3600]);
      if (n > MAX_PER_HOUR) return send(res, 200, { total: await readTotal(), counted: false });
      const total = Number(await redis(["INCR", KEY])) || 0;
      return send(res, 200, { total, counted: true });
    }

    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed" });
  } catch {
    return send(res, 500, { error: "Server error" });
  }
}