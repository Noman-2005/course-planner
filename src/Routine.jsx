import { DAYS, toMin, hourLabel, layoutDay } from "./utils.js";

const PPH = 88; // pixels per hour
const TITLES = /^(dr|md|mr|mrs|ms|prof|engr)\.?$/i;

function initials(name) {
  const w = String(name || "")
    .split(/\s+/)
    .filter((x) => x && !TITLES.test(x));
  if (!w.length || (w.length === 1 && w[0].toUpperCase() === "TBA")) return "?";
  if (w.length === 1) return w[0][0].toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}

// "8:30 AM", "11 AM"
function short(t) {
  const m = toMin(t);
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return mm ? `${h}:${String(mm).padStart(2, "0")} ${ap}` : `${h} ${ap}`;
}

export default function Routine({ items, conflictIds, title, onSelect }) {
  const today = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
  const from = Math.floor(Math.min(480, ...items.map((i) => toMin(i.start))) / 60) * 60;
  const to = Math.ceil(Math.max(1020, ...items.map((i) => toMin(i.end))) / 60) * 60;
  const height = ((to - from) * PPH) / 60;
  const y = (min) => ((min - from) * PPH) / 60;
  const credits = items.reduce((s, i) => s + (Number(i.credit) || 0), 0);

  const legend = [];
  items.forEach((i) => legend.some((l) => l.code === i.code) || legend.push(i));

  const lines = [];
  for (let m = from + 30; m <= to; m += 30) lines.push(m);
  const hours = [];
  for (let m = from + 60; m <= to; m += 60) hours.push(m);

  const select = (item) => onSelect && onSelect(item);

  return (
    <div className="capture">
      <div className="cap-head">
        <h2>{title || "My Semester Routine"}</h2>
        <span>
          {items.length} {items.length === 1 ? "course" : "courses"} · {credits} credits
        </span>
      </div>

      {legend.length > 0 && (
        <div className="rt-legend">
          <span className="rt-legend-l">Courses</span>
          {legend.map((c) => (
            <span className="rt-pill" key={c.code} style={{ "--h": c.hue }}>
              <i />
              {c.code}
            </span>
          ))}
        </div>
      )}

      <div className="rt-grid" style={{ gridTemplateColumns: `56px repeat(${DAYS.length}, minmax(0, 1fr))` }}>
        <div className="rt-corner" />
        {DAYS.map((d) => (
          <div className={"rt-dayhead" + (d === today ? " today" : "")} key={d}>
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

        {DAYS.map((d) => (
          <div className="rt-col" style={{ height }} key={d}>
            {lines.map((m) => (
              <i className={"rt-line" + (m % 60 === 0 ? "" : " half")} key={m} style={{ top: y(m) }} />
            ))}
            {layoutDay(items, d).map(({ c, lane, lanes }) => (
              <div
                key={c.id + d}
                role="button"
                tabIndex={0}
                className={"rt-block" + (conflictIds.has(c.id) ? " bad" : "")}
                aria-label={`${c.code} section ${c.section}, ${d} ${short(c.start)} to ${short(c.end)}`}
                style={{
                  "--h": c.hue,
                  top: y(toMin(c.start)),
                  height: ((toMin(c.end) - toMin(c.start)) * PPH) / 60 - 3,
                  left: `calc(${lane} * 100% / ${lanes} + 4px)`,
                  width: `calc(100% / ${lanes} - 8px)`,
                }}
                onClick={() => select(c)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(c);
                  }
                }}
              >
                <div className="rt-title">
                  <span className="rt-sec">Sec {c.section}</span>
                  {c.title}
                </div>
                <div className="rt-time">
                  {short(c.start)} – {short(c.end)}
                </div>
                {c.room && <div className="rt-room">{c.room}</div>}
                <div className="rt-fac">
                  <span className="rt-av">{initials(c.faculty)}</span>
                  <span className="rt-fn">{c.faculty || "TBA"}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}