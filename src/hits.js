// Visit counter client.
// registerHit(): counts this visit once per browser session (a refresh does not add another hit).
// fetchHits():   reads the current total (used by the Admin "Total hits" card).

const FLAG = "cp-hit-counted";

export function registerHit() {
  try {
    if (sessionStorage.getItem(FLAG)) return;
    sessionStorage.setItem(FLAG, "1");
  } catch {
    // storage blocked: still count this visit
  }
  fetch("/api/hits", { method: "POST", keepalive: true }).catch(() => {});
}

export async function fetchHits() {
  const res = await fetch("/api/hits", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load hits");
  const data = await res.json();
  return Number(data.total) || 0;
}