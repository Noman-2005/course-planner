import Icon from "./Icon.jsx";
import { fmt, overlaps, toMin, useEscape } from "./utils.js";

const codesOf = (list) => {
  const out = [];
  list.forEach((i) => out.includes(i.code) || out.push(i.code));
  return out;
};

export default function ClassDetail({ item, courses, items, readOnly, onSwap, onRemove, onClose }) {
  useEscape(onClose);
  const others = items.filter((i) => i.code !== item.code);
  const clashes = codesOf(others.filter((o) => overlaps(o, item)));
  const course = courses.find((c) => c.code === item.code);
  const alt = course
    ? course.sections
        .filter((s) => s.sec !== item.section)
        .map((s) => ({ s, clash: codesOf(others.filter((o) => overlaps(o, s))) }))
        .sort((a, b) => (a.clash.length > 0) - (b.clash.length > 0))
    : [];
  const dur = toMin(item.end) - toMin(item.start);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`${item.code} details`}>
        <div className="m-head">
          <div>
            <span className="tag" style={{ "--h": item.hue }}>
              {item.code}
            </span>
            <h3 className="d-title">{item.title}</h3>
          </div>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="m-body">
          {clashes.length > 0 && (
            <div className="alert inline" role="alert">
              <Icon name="warn" />
              <div>Clashes with {clashes.join(", ")}</div>
            </div>
          )}
          <dl className="kv">
            <dt>Section</dt>
            <dd>{item.section}</dd>
            <dt>Faculty</dt>
            <dd>{item.faculty || "TBA"}</dd>
            <dt>Days</dt>
            <dd>{item.days.join(", ")}</dd>
            <dt>Time</dt>
            <dd>
              {fmt(item.start)} – {fmt(item.end)} ({dur} min)
            </dd>
            <dt>Room</dt>
            <dd>{item.room || "—"}</dd>
            <dt>Credit</dt>
            <dd>{item.credit}</dd>
          </dl>
          {alt.length > 0 && (
            <>
              <h4>Other sections of {item.code}</h4>
              <div className="alt-list">
                {alt.map(({ s, clash }) => (
                  <div className="alt" key={s.sec}>
                    <span className="sec-letter">{s.sec}</span>
                    <div className="alt-info">
                      <b>{s.faculty || "TBA"}</b>
                      <span>
                        {s.days.join(" ")} · {fmt(s.start)}–{fmt(s.end)}
                        {s.room ? ` · ${s.room}` : ""}
                      </span>
                      {clash.length > 0 && <span className="sec-clash">Clashes with {clash.join(", ")}</span>}
                    </div>
                    {!readOnly && (
                      <button className="btn ghost sm" onClick={() => onSwap(item.code, s.sec)}>
                        Swap
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="m-foot">
          {!readOnly && (
            <button className="btn ghost danger" onClick={() => onRemove(item.code)}>
              Remove
            </button>
          )}
          <button className="btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}