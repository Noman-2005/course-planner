import { useState } from "react";
import Icon from "./Icon.jsx";
import { DAYS, toMin, uid, useEscape } from "./utils.js";

const PRESETS = [
  ["Sun + Tue", ["Sun", "Tue"]],
  ["Mon + Wed", ["Mon", "Wed"]],
  ["Sat", ["Sat"]],
];

export default function CourseForm({ courses, editing, onSave, onClose }) {
  useEscape(onClose);
  const s0 = editing && editing.sections && editing.sections[0];
  const [f, setF] = useState({
    code: editing ? editing.code : "",
    sec: s0 ? s0.sec : "A",
    title: editing ? editing.title : "",
    faculty: s0 ? s0.faculty : "",
    room: s0 ? s0.room : "",
    days: s0 ? s0.days : [],
    start: s0 ? s0.start : "09:00",
    end: s0 ? s0.end : "10:20",
    credit: editing ? editing.credit : 3,
  });
  const [err, setErr] = useState({});
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (d) => set("days", DAYS.filter((x) => (x === d ? !f.days.includes(d) : f.days.includes(x))));

  function submit(e) {
    e.preventDefault();
    const er = {};
    const code = f.code.trim().replace(/\s+/g, " ").toUpperCase();
    if (!code) er.code = "Course code is required";
    else if (courses.some((c) => c.code === code && (!editing || c.id !== editing.id))) er.code = "This course code already exists";
    if (!f.days.length) er.days = "Choose at least one day";
    if (!(toMin(f.end) > toMin(f.start))) er.time = "End time must be after start time";
    setErr(er);
    if (Object.keys(er).length) return;
    onSave(
      {
        id: editing ? editing.id : uid(),
        code,
        title: f.title.trim() || code,
        credit: Number(f.credit) || 0,
        custom: true,
        sections: [
          {
            sec: f.sec.trim() || "A",
            faculty: f.faculty.trim(),
            days: f.days,
            start: f.start,
            end: f.end,
            room: f.room.trim(),
            seats: null,
          },
        ],
      },
      editing ? editing.code : null
    );
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-label="Custom course" onSubmit={submit}>
        <div className="m-head">
          <h3>{editing ? "Edit custom course" : "Add custom course"}</h3>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="m-body">
          <div className="row2">
            <label className="field">
              <span>Course code</span>
              <input value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="CSE 1234" autoFocus />
              {err.code && <small className="err">{err.code}</small>}
            </label>
            <label className="field">
              <span>Section</span>
              <input value={f.sec} onChange={(e) => set("sec", e.target.value)} maxLength={4} />
            </label>
          </div>
          <label className="field">
            <span>Title</span>
            <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Course title" />
          </label>
          <div className="row2">
            <label className="field">
              <span>Faculty</span>
              <input value={f.faculty} onChange={(e) => set("faculty", e.target.value)} />
            </label>
            <label className="field">
              <span>Room</span>
              <input value={f.room} onChange={(e) => set("room", e.target.value)} />
            </label>
          </div>
          <div className="field">
            <span>Days</span>
            <div className="chips">
              {DAYS.map((d) => (
                <button type="button" key={d} className={"chip" + (f.days.includes(d) ? " on" : "")} onClick={() => toggle(d)} aria-pressed={f.days.includes(d)}>
                  {d}
                </button>
              ))}
            </div>
            <div className="chips">
              {PRESETS.map(([label, days]) => (
                <button type="button" key={label} className="chip preset" onClick={() => set("days", days)}>
                  {label}
                </button>
              ))}
            </div>
            {err.days && <small className="err">{err.days}</small>}
          </div>
          <div className="row3">
            <label className="field">
              <span>Start</span>
              <input type="time" value={f.start} onChange={(e) => set("start", e.target.value)} />
            </label>
            <label className="field">
              <span>End</span>
              <input type="time" value={f.end} onChange={(e) => set("end", e.target.value)} />
            </label>
            <label className="field">
              <span>Credit</span>
              <input type="number" min="0" max="12" step="0.5" value={f.credit} onChange={(e) => set("credit", e.target.value)} />
            </label>
          </div>
          {err.time && <small className="err">{err.time}</small>}
        </div>
        <div className="m-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Save course
          </button>
        </div>
      </form>
    </div>
  );
}