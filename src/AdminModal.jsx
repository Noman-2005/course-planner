import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import ReviewPanel from "./ReviewPanel.jsx";
import { useEscape } from "./utils.js";

const normId = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9_-]+/g, "").slice(0, 20);
// default list name = department + term, so different terms / batches never overwrite each other
const listId = (program, term) => normId([program, term].filter(Boolean).join("-"));
const fileKey = (f) => `${f.name}|${f.size}|${f.lastModified}`;
const UNAVAILABLE = "The server API is not available here. Use the deployed site (or set VITE_API_PROXY for local testing).";

async function api(body) {
  let res;
  try {
    res = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the server. Check your internet connection.");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    if (data && data.error) throw new Error(data.error);
    throw new Error(res.status === 404 ? UNAVAILABLE : `Server error (${res.status})`);
  }
  if (!data) throw new Error(UNAVAILABLE);
  return data;
}

function PublishDialog({ pub, setPub, existing, pos, total, busy, err, onPublish, onBack }) {
  useEscape(onBack);
  const id = normId(pub.dept);
  const clash = existing.find((d) => d.id === id);
  const sections = pub.courses.reduce((n, c) => n + c.sections.length, 0);
  return (
    <div className="overlay top">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Publish list">
        <div className="m-head">
          <h3>Publish for everyone{total > 1 ? ` · list ${pos} of ${total}` : ""}</h3>
        </div>
        <div className="m-body">
          <p className="muted">
            {pub.courses.length} courses · {sections} sections
          </p>
          <div className="row2">
            <label className="field">
              <span>List name (students pick this)</span>
              <input value={pub.dept} onChange={(e) => setPub({ ...pub, dept: e.target.value })} placeholder="e.g. BSCSE-FALL26" autoFocus />
            </label>
            <label className="field">
              <span>Term</span>
              <input value={pub.term} onChange={(e) => setPub({ ...pub, term: e.target.value })} placeholder="e.g. fall26" />
            </label>
          </div>
          {clash && (
            <div className="notice">
              A list named {clash.id} already exists{clash.term ? ` (${clash.term})` : ""}. Publishing will replace it. Change the list name to keep both.
            </div>
          )}
          {busy && (
            <div className="busy" role="status">
              <span className="spinner" aria-hidden="true" /> {busy}
            </div>
          )}
          {err && (
            <div className="errors" role="alert">
              {err}
            </div>
          )}
        </div>
        <div className="m-foot">
          <button className="btn ghost" onClick={onBack} disabled={!!busy}>
            Back
          </button>
          <button className="btn primary" onClick={onPublish} disabled={!!busy || !id}>
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminModal({ departments, onClose, onPublished }) {
  const [pw, setPw] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [files, setFiles] = useState([]);
  const [separate, setSeparate] = useState(true);
  const [dept, setDept] = useState("");
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState([]);
  const [queue, setQueue] = useState([]);
  const [total, setTotal] = useState(0);
  const [pub, setPub] = useState(null);
  const fileRef = useRef(null);
  const queueRef = useRef([]);
  queueRef.current = queue;
  const cur = queue[0];

  useEscape(() => {
    if (!busy) onClose();
  });
  useEffect(
    () => () => queueRef.current.forEach((r) => (r.sources || []).forEach((s) => URL.revokeObjectURL(s.url))),
    []
  );

  async function unlock() {
    setErr("");
    setMsg("");
    if (!pw) return setErr("Enter the admin password.");
    try {
      setBusy("Checking password…");
      await api({ action: "verify", password: pw });
      setUnlocked(true);
    } catch (e) {
      setErr(e.message || "Could not verify password");
    } finally {
      setBusy("");
    }
  }

  async function start() {
    setErr("");
    setMsg("");
    setDone([]);
    if (!pw) return setErr("Enter the admin password.");
    if (!files.length) return setErr("Choose at least one PDF or image.");
    try {
      setBusy("Checking password…");
      await api({ action: "verify", password: pw });
      const { importFiles } = await import("./importer.js");
      const groups = separate ? files.map((f) => [f]) : [files];
      const results = [];
      const skipped = [];
      for (let i = 0; i < groups.length; i++) {
        const names = groups[i].map((f) => f.name).join(", ");
        const res = await importFiles(groups[i], (t) =>
          setBusy(groups.length > 1 ? `File ${i + 1}/${groups.length}: ${t}` : t)
        );
        if (!res.courses.length) {
          res.sources.forEach((s) => URL.revokeObjectURL(s.url));
          skipped.push(names);
        } else results.push({ ...res, fileName: names });
      }
      if (skipped.length) setMsg(`No courses found in: ${skipped.join("; ")}`);
      if (!results.length) return setErr("No courses were found. Try a clearer file.");
      setQueue(results);
      setTotal(results.length);
    } catch (e) {
      setErr(e.message || "Something went wrong");
    } finally {
      setBusy("");
    }
  }

  function onReviewApply(courses) {
    const base = separate ? listId(cur.program, cur.term) : normId(dept || listId(cur.program, cur.term));
    let id = base;
    // never overwrite a list that was published a moment ago in this same batch of files
    for (let n = 2; id && done.includes(id) && n < 50; n++) id = normId(`${base.slice(0, 16)}-${n}`);
    setPub({
      dept: id,
      term: separate ? cur.term || "" : term || cur.term || "",
      courses,
    });
    setErr("");
    return "";
  }

  function next() {
    (cur.sources || []).forEach((s) => URL.revokeObjectURL(s.url));
    if (queue.length <= 1) setFiles([]);
    setQueue((q) => q.slice(1));
    setPub(null);
    setErr("");
  }

  async function publish() {
    const id = normId(pub.dept);
    if (!id) return setErr("Enter a department name (letters and numbers).");
    setBusy("Publishing…");
    setErr("");
    try {
      await api({ action: "publish", password: pw, department: id, term: pub.term, courses: pub.courses });
      setDone((d) => [...d, id]);
      onPublished();
      next();
    } catch (e) {
      setErr(e.message || "Publish failed");
    } finally {
      setBusy("");
    }
  }

  async function remove(id) {
    setErr("");
    if (!pw) return setErr("Enter the admin password first.");
    if (!window.confirm(`Delete the ${id} list for everyone?`)) return;
    try {
      setBusy("Deleting…");
      await api({ action: "delete", password: pw, department: id });
      onPublished();
      setMsg(`${id} deleted.`);
    } catch (e) {
      setErr(e.message || "Delete failed");
    } finally {
      setBusy("");
    }
  }

  if (!unlocked) {
    return (
      <div className="overlay">
        <div className="modal" role="dialog" aria-modal="true" aria-label="Admin password">
          <div className="m-head">
            <h3>Admin · enter password</h3>
            <button className="icon-btn" aria-label="Close" onClick={onClose} disabled={!!busy}>
              <Icon name="close" />
            </button>
          </div>
          <form
            className="m-body"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) unlock();
            }}
          >
            <p className="muted small">Enter the admin password to open the course-list management panel.</p>
            <label className="field">
              <span>Admin password</span>
              <input
                type="password"
                autoComplete="current-password"
                autoFocus
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
            </label>
            {busy && (
              <div className="busy" role="status">
                <span className="spinner" aria-hidden="true" /> {busy}
              </div>
            )}
            {err && (
              <div className="errors" role="alert">
                {err}
              </div>
            )}
            <div className="m-foot">
              <button type="button" className="btn ghost" onClick={onClose} disabled={!!busy}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={!!busy || !pw}>
                Enter
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Admin: publish course list">
        <div className="m-head">
          <h3>Admin · publish course list</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose} disabled={!!busy}>
            <Icon name="close" />
          </button>
        </div>
        <div className="m-body">
          <p className="muted small">
            Upload one or more faculty lists (PDF or image). Each file becomes its own list; students pick the list they need from the dropdown.
          </p>
          <label className="field">
            <span>Admin password</span>
            <input type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          <div className="field">
            <span>Faculty list files</span>
            <div className="cat-tools">
              <button className="btn ghost sm" onClick={() => fileRef.current.click()} disabled={!!busy}>
                {files.length ? "Add more PDF / images" : "Choose PDF / images"}
              </button>
              {files.length > 0 && (
                <button className="btn ghost sm" onClick={() => setFiles([])} disabled={!!busy}>
                  Clear all
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              hidden
              multiple
              accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const picked = Array.from(e.target.files);
                setFiles((prev) => {
                  const seen = new Set(prev.map(fileKey));
                  return [...prev, ...picked.filter((f) => !seen.has(fileKey(f)))];
                });
                e.target.value = "";
              }}
            />
            {files.length > 0 && (
              <ul className="file-list">
                {files.map((f) => (
                  <li key={fileKey(f)}>
                    {f.name}{" "}
                    <button
                      type="button"
                      className="linkbtn"
                      onClick={() => setFiles((prev) => prev.filter((x) => fileKey(x) !== fileKey(f)))}
                      disabled={!!busy}
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="check">
            <input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} />
            <span>Each file is a separate list (recommended for multiple PDFs)</span>
          </label>
          {!separate && (
            <div className="row2">
              <label className="field">
                <span>Department (optional)</span>
                <input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="read from the file if empty" />
              </label>
              <label className="field">
                <span>Term (optional)</span>
                <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. fall26" />
              </label>
            </div>
          )}
          {busy && (
            <div className="busy" role="status">
              <span className="spinner" aria-hidden="true" /> {busy}
            </div>
          )}
          {err && !pub && (
            <div className="errors" role="alert">
              {err}
            </div>
          )}
          {msg && <div className="notice">{msg}</div>}
          {done.length > 0 && <div className="notice">Published: {done.join(", ")}. Everyone can use it now.</div>}

          {departments.length > 0 && (
            <details>
              <summary>Published lists</summary>
              <div className="plan-list" style={{ marginTop: 8 }}>
                {departments.map((d) => (
                  <div className="plan" key={d.id}>
                    <div className="plan-info">
                      <b>{d.id}</b>
                      <span>
                        {d.term || "no term"} · {d.count} courses
                      </span>
                    </div>
                    <button className="btn ghost sm danger" onClick={() => remove(d.id)} disabled={!!busy}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
        <div className="m-foot">
          <button className="btn ghost" onClick={onClose} disabled={!!busy}>
            Close
          </button>
          <button className="btn primary" onClick={start} disabled={!!busy}>
            Read &amp; review
          </button>
        </div>
      </div>

      {cur && !pub && <ReviewPanel key={`${cur.fileName}-${queue.length}`} result={cur} onApply={onReviewApply} onCancel={next} />}
      {cur && pub && (
        <PublishDialog
          pub={pub}
          setPub={setPub}
          existing={[...departments, ...done.filter((id) => !departments.some((d) => d.id === id)).map((id) => ({ id, term: "" }))]}
          pos={total - queue.length + 1}
          total={total}
          busy={busy}
          err={err}
          onPublish={publish}
          onBack={() => setPub(null)}
        />
      )}
    </div>
  );
}