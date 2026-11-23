import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import { useEscape, useLocalStorage } from "./utils.js";
import { playTick } from "./sound.js";
import { COURSES, BY, GRADES, RUNNING, TOTAL_CREDITS, calcCGPA, pool, suggest, conflicts, slotOf, slotLabel } from "./graduation.js";

const norm = (s) => String(s).replace(/\s+/g, "").toUpperCase();
const GROUPS = [
  ["core", "Core & compulsory", null],
  ["ged", "General education", 3],
  ["elective", "Electives", 5],
];

export default function GraduationTracker({ offered = [], added = [], onAddToPlanner, onClose }) {
  useEscape(onClose);
  const [recRaw, setRec] = useLocalStorage("cp-grad", {});
  const rec = recRaw && typeof recRaw === "object" && !Array.isArray(recRaw) ? recRaw : {};

  const [tab, setTab] = useState("courses");
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState("");
  const [maxCr, setMaxCr] = useState(15);
  const [onlyOffered, setOnlyOffered] = useState(true);
  const [manual, setManual] = useState(null);

  const offeredSet = useMemo(() => new Set(offered.map(norm)), [offered]);
  const addedSet = useMemo(() => new Set(added.map(norm)), [added]);
  const isOffered = (c) => offeredSet.has(norm(c.code));
  const filterOn = onlyOffered && offeredSet.size > 0;

  const stats = useMemo(() => calcCGPA(rec), [rec]);
  const list = useMemo(() => pool(rec).filter((c) => !filterOn || isOffered(c)), [rec, filterOn, offeredSet]); // eslint-disable-line
  const auto = useMemo(() => suggest(rec, maxCr, (c) => !filterOn || isOffered(c)), [rec, maxCr, filterOn, offeredSet]); // eslint-disable-line
  useEffect(() => setManual(null), [rec, maxCr, filterOn]);

  const sel = manual ?? auto;
  const clash = useMemo(() => conflicts(sel), [sel]);
  const selCr = sel.reduce((s, c) => s + (BY[c]?.credit || 0), 0);

  const setGrade = (code, g) => {
    playTick("add");
    setRec((r) => ({ ...(r && typeof r === "object" ? r : {}), [code]: g }));
    setOpen(null);
  };
  const removeGrade = (code) => {
    playTick("deselect");
    setRec((r) => {
      const n = { ...(r || {}) };
      delete n[code];
      return n;
    });
    setOpen(null);
  };
  const toggle = (code) => {
    playTick(sel.includes(code) ? "deselect" : "select");
    setManual(sel.includes(code) ? sel.filter((x) => x !== code) : [...sel, code]);
  };

  const cnt = (t) => Object.keys(rec).filter((c) => BY[c]?.type === t && rec[c] !== "F").length;
  const mine = Object.keys(rec).map((c) => BY[c]).filter(Boolean).sort((a, b) => (a.tri || 99) - (b.tri || 99));
  const match = (c) => (c.code + " " + c.title).toLowerCase().includes(q.trim().toLowerCase());
  const pct = Math.min(100, (stats.earned / TOTAL_CREDITS) * 100);

  const picker = (code) => (
    <div className="gt-picker">
      <div className="chips">
        {GRADES.map((x) => (
          <button key={x.l} className={"chip" + (rec[code] === x.l ? " on" : "")} onClick={() => setGrade(code, x.l)}>
            {x.l}
            <small>{x.gp.toFixed(2)}</small>
          </button>
        ))}
        <button className={"chip" + (rec[code] === RUNNING ? " on" : "")} onClick={() => setGrade(code, RUNNING)}>
          Running
        </button>
        {rec[code] && (
          <button className="chip preset" onClick={() => removeGrade(code)}>
            Remove
          </button>
        )}
      </div>
    </div>
  );

  const badge = (code) => {
    const g = rec[code];
    return (
      <button
        className={"gt-badge" + (g === RUNNING ? " run" : g === "F" ? " f" : "")}
        onClick={() => setOpen(open === code ? null : code)}
        aria-label={`Change grade for ${code}`}
      >
        {g === RUNNING ? "Running" : g}
      </button>
    );
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Graduation tracker">
        <div className="m-head">
          <h3>Graduation Tracker</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <div className="m-body">
          <section className="stats" aria-label="Progress">
            <div className="stat card">
              <span className="stat-l">CGPA</span>
              <span className="stat-v" style={{ color: "var(--accent)" }}>{stats.graded ? stats.cgpa.toFixed(2) : "—"}</span>
            </div>
            <div className="stat card">
              <span className="stat-l">Credits</span>
              <span className="stat-v">{stats.earned} / {TOTAL_CREDITS}</span>
            </div>
            <div className="stat card">
              <span className="stat-l">Running</span>
              <span className="stat-v">{stats.running}</span>
            </div>
          </section>
          <div className="gt-bar" aria-hidden="true"><i style={{ width: pct + "%" }} /></div>

          <div className="chips">
            {[
              ["courses", "All courses"],
              ["mine", `My list (${mine.length})`],
              ["next", "Next trimester"],
            ].map(([k, l]) => (
              <button key={k} className={"chip" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>

          {tab === "courses" && (
            <>
              <input type="search" placeholder="Search a course (code or name)…" value={q} onChange={(e) => setQ(e.target.value)} />
              {GROUPS.map(([t, label, limit]) => (
                <div key={t}>
                  <h4>{limit ? `${label} · ${cnt(t)}/${limit}` : label}</h4>
                  {COURSES.filter((c) => c.type === t && match(c)).map((c) => (
                    <div className="gt-row" key={c.code}>
                      <div className="gt-info">
                        <b>{c.code}</b>
                        <span>{c.title}</span>
                      </div>
                      <span className="gt-cr">{c.credit} cr</span>
                      {rec[c.code] ? (
                        badge(c.code)
                      ) : (
                        <button className="btn primary sm" onClick={() => setOpen(open === c.code ? null : c.code)}>
                          + Add
                        </button>
                      )}
                      {open === c.code && picker(c.code)}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          {tab === "mine" &&
            (mine.length ? (
              mine.map((c) => (
                <div className="gt-row" key={c.code}>
                  <div className="gt-info">
                    <b>{c.code}</b>
                    <span>{c.title}</span>
                  </div>
                  <span className="gt-cr">{c.credit} cr</span>
                  {badge(c.code)}
                  {open === c.code && picker(c.code)}
                </div>
              ))
            ) : (
              <div className="empty">
                <b>No courses yet</b>
                <p className="muted small">Open “All courses” and press + Add on every course you have already done.</p>
              </div>
            ))}

          {tab === "next" && (
            <>
              <div className="gt-ctl">
                <span className="small muted">Max credits</span>
                <input type="range" min="9" max="18" value={maxCr} onChange={(e) => setMaxCr(+e.target.value)} />
                <b>{maxCr}</b>
              </div>
              {offeredSet.size > 0 && (
                <label className="check">
                  <input type="checkbox" checked={onlyOffered} onChange={(e) => setOnlyOffered(e.target.checked)} />
                  <span>Only courses offered this trimester</span>
                </label>
              )}
              <p className="muted small">
                Selected: {sel.length} courses · {selCr} credits. Running courses are treated as passed.
              </p>

              {clash.length > 0 && (
                <div className="alert inline" role="alert">
                  <Icon name="warn" />
                  <div>
                    {clash.map((x, i) => (
                      <div key={i}>
                        {x.a} and {x.b} clash · {slotLabel(x.day, x.slot)} ({x.mid ? "mid + final" : "final"})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <h4>Eligible courses · tap to select</h4>
              {list.length === 0 && (
                <div className="empty">
                  <b>Nothing eligible yet</b>
                  <p className="muted small">Add the courses you have completed so prerequisites can be checked.</p>
                </div>
              )}
              {list.map((c) => {
                const s = slotOf(c.code);
                const on = sel.includes(c.code);
                const off = isOffered(c);
                return (
                  <div className={"gt-row gt-pick" + (on ? " on" : "")} key={c.code} onClick={() => toggle(c.code)}>
                    <div className="gt-info">
                      <b>
                        {c.code} {off && <em className="gt-tag">Offered</em>}
                      </b>
                      <span>
                        {c.title} · {s ? slotLabel(s.day, s.slot) + (s.fo ? " · final only" : "") : "no exam slot in template"}
                      </span>
                    </div>
                    <span className="gt-cr">{c.credit} cr</span>
                    {off && onAddToPlanner && (
                      <button
                        className="btn ghost sm"
                        disabled={addedSet.has(norm(c.code))}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToPlanner(c.code);
                        }}
                      >
                        {addedSet.has(norm(c.code)) ? "✓ In routine" : "+ Routine"}
                      </button>
                    )}
                    <span className="gt-tick">{on ? "✓" : "+"}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}