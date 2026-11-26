import { useEffect, useRef, useState } from "react";
import { fetchHits } from "./hits.js";

const POLL_MS = 3000; // how often the number is refreshed while this card is on screen

export default function HitsCard() {
  const [total, setTotal] = useState(null);
  const [bump, setBump] = useState(null); // { n, id } -> the little "+N" chip
  const [live, setLive] = useState(true);
  const prev = useRef(null);

  useEffect(() => {
    let stopped = false;
    let timer;

    const schedule = () => {
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };

    async function tick() {
      if (document.hidden) return schedule(); // no requests while the tab is in the background
      try {
        const n = await fetchHits();
        if (stopped) return;
        if (prev.current !== null && n > prev.current) setBump({ n: n - prev.current, id: Date.now() });
        prev.current = n;
        setTotal(n);
        setLive(true);
      } catch {
        if (!stopped) setLive(false);
      }
      schedule();
    }

    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        tick();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!bump) return;
    const t = setTimeout(() => setBump(null), 2500);
    return () => clearTimeout(t);
  }, [bump]);

  return (
    <div className="hits">
      <div className="hits-ico" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <div className="hits-main">
        <span className="hits-l">Total hits</span>
        <span className="hits-v" key={total}>
          {total === null ? "—" : total.toLocaleString("en-US")}
        </span>
      </div>
      <div className="hits-side">
        {bump && (
          <span className="hits-plus" key={bump.id}>
            +{bump.n}
          </span>
        )}
        <span className={"hits-live" + (live ? "" : " off")}>
          <i aria-hidden="true" /> {live ? "Live" : "Offline"}
        </span>
      </div>
    </div>
  );
}