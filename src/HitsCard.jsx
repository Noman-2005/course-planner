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
    <div className="hc">
      <div className="hc-top">
        <span className="hc-l">Total hits</span>
        <i className={"hc-dot" + (live ? "" : " off")} aria-hidden="true" />
      </div>
      <span className="hc-v" key={total}>
        {total === null ? "—" : total.toLocaleString("en-US")}
      </span>
    </div>
  );
}