import { useEffect, useRef, useState } from "react";
import { fetchHits } from "./hits.js";
import "./HitsCard.css";

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
    <div className="hc">
      <span className="hc-ico" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M15 7h6v6" />
        </svg>
      </span>

      <div className="hc-main">
        <span className="hc-l">Total hits</span>
        <span className="hc-v" key={total}>
          {total === null ? "—" : total.toLocaleString("en-US")}
        </span>
      </div>

      <div className="hc-side">
        {bump && (
          <span className="hc-plus" key={bump.id}>
            +{bump.n}
          </span>
        )}
        <span className={"hc-live" + (live ? "" : " off")}>
          <i aria-hidden="true" />
          {live ? "Live" : "Offline"}
        </span>
      </div>
    </div>
  );
}