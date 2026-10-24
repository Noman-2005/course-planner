import { useMemo, useState } from "react";
import { courseIssues, sectionIssues, summarize } from "./verify.js";
import { parseDays, toMin, uid, useEscape } from "./utils.js";
import Icon from "./Icon.jsx";

export default function ReviewPanel({ result, onApply, onCancel }) {
  useEscape(onCancel);
  const [courses, setCourses] = useState(() =>
    result.courses.map((c) => ({
      ...c,
      k: uid(),
      sections: c.sections.map((s) => ({ ...s, k: uid(), daysText: s.days.join(" ") })),
    }))
  );
  const [error, setError] = useState("");

  const upC = (k, patch) => setCourses((cs) => cs.map((c) => (c.k === k ? { ...c, ...patch } : c)));
  const upS = (ck, sk, patch) =>
    setCourses((cs) =>
      cs.map((c) => (c.k !== ck ? c : { ...c, sections: c.sections.map((s) => (s.k === sk ? { ...s, ...patch } : s)) }))
    );
  const delC = (k) => setCourses((cs) => cs.filter((c) => c.k !== k));
  const delS = (ck, sk) =>
    setCourses((cs) => cs.map((c) => (c.k !== ck ? c : { ...c, sections: c.sections.filter((s) => s.k !== sk) })));

  const summary = useMemo(() => summarize(courses, result.expected, result.warnings), [courses, result]);
  const totalSections = courses.reduce((n, c) => n + c.sections.length, 0);

  function apply() {
    const clean = courses.map((c) => ({
      code: String(c.code).trim().replace(/\s+/g, " "),
      title: String(c.title || "").trim() || String(c.code).trim(),
      credit: Number(c.credit) || 0,
      sections: c.sections.map((s) => ({
        sec: String(s.sec).trim(),
        faculty: String(s.faculty || "").trim(),
        days: parseDays(s.daysText).days,
        start: s.start,
        end: s.end,
        room: String(s.room || "").trim(),
        seats: s.seats === "" || s.seats == null || isNaN(Number(s.seats)) ? null : Number(s.seats),
      })),
    }));
    const bad = [];
    for (const c of clean) {
      if (!c.code) bad.push("A course has no code.");
      if (!c.sections.length) bad.push(`${c.code || "A course"} has no sections.`);
      for (const s of c.sections) {
        if (!s.sec) bad.push(`${c.code}: a section has no name.`);
        if (!s.days.length) bad.push(`${c.code} ${s.sec}: no days.`);
        if (!(toMin(s.end) > toMin(s.start))) bad.push(`${c.code} ${s.sec}: end must be after start.`);
      }
    }
    if (bad.length) return setError(bad.slice(0, 4).join(" ") + (bad.length > 4 ? ` (+${bad.length - 4} more)` : ""));
    if (!clean.length) return setError("Nothing to apply.");
    const e = onApply(clean);
    if (e) setError(e);
  }

  return (
    <div className="overlay top">
      <div className="modal xl" role="dialog" aria-modal="true" aria-label="Review import">
        <div className="m-head">
          <h3>Review import</h3>
          <button className="icon-btn" aria-label="Close review" onClick={onCancel}>
            <Icon name="close" />
          </button>
        </div>
        <div className="m-body">
          <p className="rv-sum">
            {courses.length} courses · {totalSections} sections · {summary.credits} credits · {summary.flagged} rows need a look
          </p>
          <ul className="checks">
            {summary.checks.map((c, i) => (
              <li key={i} className={c.level}>
                <span className="dot" aria-hidden="true" />
                {c.text}
              </li>
            ))}
          </ul>

          {result.sources && result.sources.length > 0 && (
            <details className="src">
              <summary>Show original image{result.sources.length > 1 ? "s" : ""}</summary>
              <div className="src-box">
                {result.sources.map((s) => (
                  <img key={s.url} src={s.url} alt={s.name} />
                ))}
              </div>
            </details>
          )}

          {courses.map((c) => {
            const ci = courseIssues(c);
            return (
              <div className={"rv-course" + (ci.length ? " warn" : "")} key={c.k}>
                <div className="rv-chead">
                  <input aria-label="Course code" className="w-code" value={c.code} onChange={(e) => upC(c.k, { code: e.target.value })} />
                  <input aria-label="Course title" className="w-title" value={c.title} onChange={(e) => upC(c.k, { title: e.target.value })} />
                  <input aria-label="Credit" className="w-cr" type="number" step="0.5" min="0" value={c.credit} onChange={(e) => upC(c.k, { credit: e.target.value })} />
                  <button className="icon-btn" aria-label={`Remove course ${c.code}`} onClick={() => delC(c.k)}>
                    <Icon name="trash" />
                  </button>
                </div>
                {ci.length > 0 && <div className="why">{ci.join(" · ")}</div>}
                <div className="rv-scroll">
                  <table className="rv-table">
                    <thead>
                      <tr>
                        <th>Sec</th>
                        <th>Faculty</th>
                        <th>Days</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Room</th>
                        <th>Seats</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {c.sections.map((s) => {
                        const issues = sectionIssues(c, s);
                        return (
                          <tr key={s.k} className={issues.length ? "warn" : ""}>
                            <td>
                              <input aria-label="Section" className="w-sec" value={s.sec} onChange={(e) => upS(c.k, s.k, { sec: e.target.value })} />
                            </td>
                            <td>
                              <input aria-label="Faculty" className="w-fac" value={s.faculty} onChange={(e) => upS(c.k, s.k, { faculty: e.target.value })} />
                            </td>
                            <td>
                              <input
                                aria-label="Days"
                                className="w-days"
                                value={s.daysText}
                                onChange={(e) => upS(c.k, s.k, { daysText: e.target.value, days: parseDays(e.target.value).days })}
                                onBlur={(e) => {
                                  const { days } = parseDays(e.target.value);
                                  upS(c.k, s.k, { days, daysText: days.join(" ") });
                                }}
                              />
                            </td>
                            <td>
                              <input aria-label="Start time" type="time" value={s.start} onChange={(e) => upS(c.k, s.k, { start: e.target.value })} />
                            </td>
                            <td>
                              <input aria-label="End time" type="time" value={s.end} onChange={(e) => upS(c.k, s.k, { end: e.target.value })} />
                            </td>
                            <td>
                              <input aria-label="Room" className="w-room" value={s.room} onChange={(e) => upS(c.k, s.k, { room: e.target.value })} />
                            </td>
                            <td>
                              <input
                                aria-label="Seats"
                                className="w-seats"
                                type="number"
                                min="0"
                                value={s.seats == null ? "" : s.seats}
                                onChange={(e) => upS(c.k, s.k, { seats: e.target.value === "" ? null : Number(e.target.value) })}
                              />
                            </td>
                            <td>
                              <button className="icon-btn" aria-label={`Remove section ${s.sec}`} onClick={() => delS(c.k, s.k)}>
                                <Icon name="trash" size={16} />
                              </button>
                              {issues.length > 0 && <div className="why row">{issues.join(" · ")}</div>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {error && (
            <div className="errors" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="m-foot">
          <button className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={apply}>
            Apply {totalSections} sections
          </button>
        </div>
      </div>
    </div>
  );
}