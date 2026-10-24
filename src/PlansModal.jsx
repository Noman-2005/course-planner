import { useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import { itemsFor, stats } from "./plans.js";
import { fmt, fmtDur, uid, useEscape } from "./utils.js";

export default function PlansModal({ courses, picks, plans, setPlans, readOnly, currentTitle, onLoad, toast, onClose }) {
  useEscape(onClose);
  const [name, setName] = useState(currentTitle || "My Routine");
  const [sel, setSel] = useState([]);
  const nothing = Object.keys(picks).length === 0;

  const infoFor = (p) => {
    const items = itemsFor(courses, p.picks);
    return { items, st: stats(items) };
  };
  const infos = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, infoFor(p)])), [plans, courses]); // eslint-disable-line

  function save() {
    if (nothing || readOnly) return;
    const plan = { id: uid(), name: name.trim() || "Untitled routine", picks: { ...picks }, savedAt: Date.now() };
    setPlans([plan, ...plans]);
    toast("Routine saved");
  }
  function del(id) {
    setPlans(plans.filter((p) => p.id !== id));
    setSel((s) => s.filter((x) => x !== id));
  }
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-2)));

  const A = plans.find((p) => p.id === sel[0]);
  const B = plans.find((p) => p.id === sel[1]);
  const rows = [];
  if (A && B) {
    const a = infos[A.id].st,
      b = infos[B.id].st;
    const t = (v) => (v ? fmt(v) : "—");
    rows.push(["Credits", a.credits, b.credits]);
    rows.push(["Courses", a.courses, b.courses]);
    rows.push(["Conflicts", a.conflicts, b.conflicts]);
    rows.push(["Class days", a.classDays, b.classDays]);
    rows.push(["Free days (Sat–Thu)", a.freeDays, b.freeDays]);
    rows.push(["Weekly class hours", a.hours, b.hours]);
    rows.push(["Earliest start", t(a.earliest), t(b.earliest)]);
    rows.push(["Latest end", t(a.latest), t(b.latest)]);
    rows.push(["Longest gap", a.maxGap ? fmtDur(a.maxGap) : "—", b.maxGap ? fmtDur(b.maxGap) : "—"]);
    const codes = courses.map((c) => c.code).filter((code) => A.picks[code] || B.picks[code]);
    const cell = (items, code) => {
      const i = items.find((x) => x.code === code);
      return i ? `Sec ${i.section} · ${i.days.join(" ")} · ${fmt(i.start)}–${fmt(i.end)}` : "—";
    };
    codes.forEach((code) => rows.push([code, cell(infos[A.id].items, code), cell(infos[B.id].items, code)]));
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Saved routines">
        <div className="m-head">
          <h3>Saved routines</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="m-body">
          <div className="save-row">
            <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Routine name" placeholder="Routine name" maxLength={60} />
            <button className="btn primary" onClick={save} disabled={nothing || readOnly}>
              Save current
            </button>
          </div>
          {readOnly && <p className="muted small">You are viewing a shared routine, so saving is disabled.</p>}
          {plans.length === 0 && <p className="muted">No saved routines yet.</p>}
          <div className="plan-list">
            {plans.map((p) => {
              const st = infos[p.id].st;
              return (
                <div className="plan" key={p.id}>
                  <input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} aria-label={`Compare ${p.name}`} />
                  <div className="plan-info">
                    <b>{p.name}</b>
                    <span>
                      {st.courses} courses · {st.credits} cr · {st.conflicts ? `${st.conflicts} conflicts` : "no conflicts"} ·{" "}
                      {new Date(p.savedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button className="btn ghost sm" onClick={() => onLoad(p)}>
                    Load
                  </button>
                  <button className="icon-btn" aria-label={`Delete ${p.name}`} onClick={() => del(p.id)}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          {plans.length >= 2 && !(A && B) && <p className="muted small">Tick two routines to compare them side by side.</p>}
          {A && B && (
            <div className="rv-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th />
                    <th>A · {A.name}</th>
                    <th>B · {B.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, x, y], i) => (
                    <tr key={i} className={String(x) !== String(y) ? "diff" : ""}>
                      <th>{label}</th>
                      <td>{x}</td>
                      <td>{y}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="m-foot">
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}