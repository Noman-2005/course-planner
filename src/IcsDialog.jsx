import { useState } from "react";
import Icon from "./Icon.jsx";
import { buildIcs, downloadIcs, toInput } from "./ics.js";
import { slug, useEscape } from "./utils.js";

export default function IcsDialog({ items, title, onClose }) {
  useEscape(onClose);
  const today = new Date();
  const later = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 16 * 7);
  const [start, setStart] = useState(toInput(today));
  const [end, setEnd] = useState(toInput(later));
  const [rem, setRem] = useState("15");
  const [err, setErr] = useState("");

  function go(e) {
    e.preventDefault();
    if (!start || !end || end < start) return setErr("End date must be on or after the start date.");
    setErr("");
    downloadIcs(buildIcs(items, { start, end, reminder: Number(rem), title }), slug(title) + ".ics");
    onClose();
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-label="Export to calendar" onSubmit={go}>
        <div className="m-head">
          <h3>Export to calendar (.ics)</h3>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="m-body">
          <div className="row2">
            <label className="field">
              <span>Semester start</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="field">
              <span>Semester end</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Reminder</span>
            <select value={rem} onChange={(e) => setRem(e.target.value)}>
              <option value="0">None</option>
              <option value="10">10 minutes before</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">60 minutes before</option>
            </select>
          </label>
          {err && <small className="err">{err}</small>}
          <p className="muted small">Each class becomes a weekly repeating event until the end date.</p>
        </div>
        <div className="m-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            <Icon name="download" size={14} /> Download .ics
          </button>
        </div>
      </form>
    </div>
  );
}