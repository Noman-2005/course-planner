import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import ReviewPanel from "./ReviewPanel.jsx";
import { parseCatalog, toText } from "./catalogText.js";
import { parseUcamText } from "./ucamText.js";
import { importFiles } from "./importer.js";
import { useEscape } from "./utils.js";

function PasteDialog({ onReview, onClose }) {
  useEscape(onClose);
  const [t, setT] = useState("");
  return (
    <div className="overlay top" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Paste page text">
        <div className="m-head">
          <h3>Paste page text</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="m-body">
          <p className="muted">Open the university page, press Ctrl+A then Ctrl+C, and paste everything here.</p>
          <textarea className="mono" rows={12} value={t} onChange={(e) => setT(e.target.value)} placeholder="Paste copied page text…" autoFocus />
        </div>
        <div className="m-foot">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!t.trim()} onClick={() => onReview(t)}>
            Review
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CatalogModal({ base, onSave, onReset, onClose }) {
  useEscape(onClose);
  const [text, setText] = useState(() => toText(base));
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [review, setReview] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  const txtRef = useRef(null);
  const reviewRef = useRef(null);
  const runRef = useRef(null);
  reviewRef.current = review;

  useEffect(
    () => () => {
      const r = reviewRef.current;
      if (r && r.sources) r.sources.forEach((s) => URL.revokeObjectURL(s.url));
    },
    []
  );

  async function runImport(files) {
    if (busy || reviewRef.current || !files.length) return;
    setNotice("");
    setBusy("Starting import…");
    try {
      const res = await importFiles(files, setBusy);
      if (!res.courses.length) {
        res.sources.forEach((s) => URL.revokeObjectURL(s.url));
        setNotice("No courses were found. " + (res.warnings.length ? res.warnings.join(" ") : "Try a clearer file."));
      } else setReview(res);
    } catch (e) {
      setNotice("Import failed: " + (e && e.message ? e.message : "unknown error"));
    } finally {
      setBusy("");
    }
  }
  runRef.current = runImport;

  useEffect(() => {
    const onPaste = (e) => {
      const files = Array.from((e.clipboardData && e.clipboardData.files) || []).filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        runRef.current(files);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  function reviewText(t) {
    const r = parseUcamText(t);
    setPasteOpen(false);
    if (!r.courses.length) {
      setNotice("No courses could be read from the pasted text. " + r.warnings.join(" "));
      return;
    }
    setReview({ ...r, sources: [] });
  }

  function closeReview() {
    const r = reviewRef.current;
    if (r && r.sources) r.sources.forEach((s) => URL.revokeObjectURL(s.url));
    setReview(null);
  }

  function apply(incoming) {
    const cur = parseCatalog(text);
    if (cur.errors.length) return "The catalog text has errors. Fix them first, then apply again.";
    const map = new Map(cur.courses.map((c) => [c.code, c]));
    const order = cur.courses.map((c) => c.code);
    incoming.forEach((c) => {
      if (!map.has(c.code)) order.push(c.code);
      map.set(c.code, c);
    });
    setText(
      toText({
        program: cur.program || review.program || base.program,
        term: cur.term || review.term || base.term,
        courses: order.map((k) => map.get(k)),
      })
    );
    closeReview();
    setErrors([]);
    setNotice(`Applied ${incoming.length} course(s). Press Save to store the catalog.`);
    return "";
  }

  function save() {
    const p = parseCatalog(text);
    if (p.errors.length) return setErrors(p.errors);
    if (!p.courses.length) return setErrors(["Add at least one course."]);
    onSave({ program: p.program || base.program, term: p.term || base.term, courses: p.courses });
  }

  function loadTxt(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      setText(String(r.result || ""));
      setErrors([]);
    };
    r.readAsText(file);
  }

  function downloadTxt() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `catalog-${base.program}-${base.term}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="overlay">
      <div
        className={"modal xl" + (drag ? " dragging" : "")}
        role="dialog"
        aria-modal="true"
        aria-label="Manage courses"
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          runImport(Array.from(e.dataTransfer.files));
        }}
      >
        <div className="m-head">
          <h3>Manage courses</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="m-body">
          <div className="cat-tools">
            <button className="btn ghost sm" onClick={() => setPasteOpen(true)} disabled={!!busy}>
              Paste page text
            </button>
            <button className="btn ghost sm" onClick={() => fileRef.current.click()} disabled={!!busy}>
              Import PDF / Image
            </button>
            <button className="btn ghost sm" onClick={() => txtRef.current.click()}>
              Load .txt
            </button>
            <button className="btn ghost sm" onClick={downloadTxt}>
              <Icon name="download" size={14} /> Download .txt
            </button>
            <button
              className="btn ghost sm danger"
              onClick={() => window.confirm("Restore the built-in catalog and clear your picks?") && onReset()}
            >
              Reset default
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              multiple
              accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => {
                runImport(Array.from(e.target.files));
                e.target.value = "";
              }}
            />
            <input
              ref={txtRef}
              type="file"
              hidden
              accept=".txt,text/plain"
              onChange={(e) => {
                loadTxt(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </div>
          <p className="muted small">
            Tip: drop PDF/image files here or press Ctrl+V to paste a screenshot. Every import opens a review screen first.
          </p>
          {busy && (
            <div className="busy" role="status">
              <span className="spinner" aria-hidden="true" /> {busy}
            </div>
          )}
          {notice && <div className="notice">{notice}</div>}
          <textarea
            className="mono big"
            value={text}
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
            aria-label="Catalog text"
          />
          {errors.length > 0 && (
            <ul className="errors" role="alert">
              {errors.map((er, i) => (
                <li key={i}>{er}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="m-foot">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
      {pasteOpen && <PasteDialog onReview={reviewText} onClose={() => setPasteOpen(false)} />}
      {review && <ReviewPanel result={review} onApply={apply} onCancel={closeReview} />}
    </div>
  );
}