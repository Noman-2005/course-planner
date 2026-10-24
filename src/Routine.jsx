import { DAYS, toMin, fmt, hourLabel, layoutDay } from "./utils.js";

const PPH = 64; // pixels per hour

export default function Routine({ items, conflictIds, title, onSelect }) {
  const used = new Set();
  items.forEach((i) => i.days.forEach((d) => used.add(d)));
  const days = DAYS.filter((d) => d !== "Fri" || used.has("Fri"));
  const from = Math.floor(Math.min(480, ...items.map((i) => toMin(i.start))) / 60) * 60;
  const to = Math.ceil(Math.max(1020, ...items.map((i) => toMin(i.end))) / 60) * 60;
  const height = ((to - from) * PPH) / 60;
  const hours = [];
  for (let m = from; m <= to; m += 60) hours.push(m);
  const credits = items.reduce((s, i) => s + (Number(i.credit) || 0), 0);
  const y = (min) => ((min - from) * PPH) / 60;

  const select = (item) => onSelect && onSelect(item);

  return (
    <div className="capture">
      <div className="cap-head">
        <h2>{title || "My Semester Routine"}</h2>
        <span>
          {items.length} {items.length === 1 ? "course" : "courses"} · {credits} credits
        </span>
      </div>
      <div className="rt-grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="rt-corner" />
        {days.map((d) => (
          <div className="rt-dayhead" key={d}>
            {d}
          </div>
        ))}
        <div className="rt-times" style={{ height }}>
          {hours.map((m) => (
            <span key={m} style={{ top: y(m) }}>
              {hourLabel(m)}
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div className="rt-col" style={{ height }} key={d}>
            {hours.map((m) => (
              <i className="rt-line" key={m} style={{ top: y(m) }} />
            ))}
            {layoutDay(items, d).map(({ c, lane, lanes }) => (
              <div
                key={c.id + d}
                role="button"
                tabIndex={0}
                className={"rt-block" + (conflictIds.has(c.id) ? " bad" : "")}
                aria-label={`${c.code} section ${c.section}, ${d} ${fmt(c.start)} to ${fmt(c.end)}`}
                style={{
                  "--h": c.hue,
                  top: y(toMin(c.start)),
                  height: ((toMin(c.end) - toMin(c.start)) * PPH) / 60 - 1,
                  left: `calc(${lane} * 100% / ${lanes} + 2px)`,
                  width: `calc(100% / ${lanes} - 4px)`,
                }}
                onClick={() => select(c)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(c);
                  }
                }}
              >
                <b>
                  {c.code} · {c.section}
                </b>
                <span>
                  {fmt(c.start)} – {fmt(c.end)}
                </span>
                {c.room && <span>Room {c.room}</span>}
                {c.faculty && <span className="rt-fac">{c.faculty}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}