import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import Routine from "./Routine.jsx";
import CourseForm from "./CourseForm.jsx";
import CatalogModal from "./CatalogModal.jsx";
import ClassDetail from "./ClassDetail.jsx";
import PlansModal from "./PlansModal.jsx";
import IcsDialog from "./IcsDialog.jsx";
import { META, CATALOG } from "./catalog.js";
import { itemsFor } from "./plans.js";
import { encodeShare, decodeShare } from "./share.js";
import { findConflicts, overlaps, useLocalStorage, uid, fmt, slug, HUES } from "./utils.js";

function CourseCard({ c, hue, open, onToggle, picked, clashOf, hideClash, onPick, onEdit, onRemove }) {
  return (
    <div className={"course" + (open ? " open" : "")} style={{ "--h": hue }}>
      <button className="course-head" onClick={onToggle} aria-expanded={open}>
        <span className="bar" />
        <span className="c-main">
          <span className="c-top">
            <b>{c.code}</b>
            <em>{c.credit} cr</em>
          </span>
          <span className="c-title">{c.title}</span>
        </span>
        <span className={"pill" + (picked ? " on" : "")}>{picked ? `Sec ${picked}` : "Choose"}</span>
        <span className="chev" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="sec-list">
          {c.sections.map((s) => {
            const sel = picked === s.sec;
            const clash = clashOf(c, s);
            if (hideClash && clash.length && !sel) return null;
            return (
              <button
                key={s.sec}
                className={"sec" + (sel ? " sel" : "") + (clash.length && !sel ? " dim" : "")}
                onClick={() => onPick(c.code, s.sec)}
                aria-pressed={sel}
              >
                <span className="sec-letter">{s.sec}</span>
                <span className="sec-info">
                  <span className="sec-fac">
                    {s.faculty || "TBA"}
                    {s.seats != null && <span className="seats">{s.seats} seats</span>}
                  </span>
                  <span className="sec-time">
                    {s.days.join(" ")} · {fmt(s.start)}–{fmt(s.end)}
                    {s.room ? ` · ${s.room}` : ""}
                  </span>
                  {clash.length > 0 && <span className="sec-clash">Clashes with {clash.join(", ")}</span>}
                </span>
              </button>
            );
          })}
          {c.custom && (
            <div className="c-actions">
              <button className="btn ghost sm" onClick={() => onEdit(c)}>
                <Icon name="edit" size={14} /> Edit
              </button>
              <button className="btn ghost sm danger" onClick={() => onRemove(c)}>
                <Icon name="trash" size={14} /> Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [catalogRaw, setCatalog] = useLocalStorage("cp-catalog", null);
  const [customRaw, setCustom] = useLocalStorage("cp-custom", []);
  const [picksRaw, setPicks] = useLocalStorage("cp-picks", {});
  const [plansRaw, setPlans] = useLocalStorage("cp-plans", []);
  const [titleRaw, setTitle] = useLocalStorage("cp-title", "My Semester Routine");

  const custom = Array.isArray(customRaw) ? customRaw : [];
  const picks = picksRaw && typeof picksRaw === "object" && !Array.isArray(picksRaw) ? picksRaw : {};
  const plans = Array.isArray(plansRaw) ? plansRaw : [];
  const title = typeof titleRaw === "string" ? titleRaw : "My Semester Routine";

  const base = useMemo(
    () =>
      catalogRaw && Array.isArray(catalogRaw.courses)
        ? catalogRaw
        : { program: META.program, term: META.term, courses: CATALOG },
    [catalogRaw]
  );
  const courses = useMemo(() => [...base.courses, ...custom], [base, custom]);
  const items = useMemo(() => itemsFor(courses, picks), [courses, picks]);

  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "dark");
  const [shared, setShared] = useState(null);
  const [open, setOpen] = useState(null);
  const [hideClash, setHideClash] = useState(false);
  const [formFor, setFormFor] = useState(undefined); // undefined closed, null new, course edit
  const [showCatalog, setShowCatalog] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [showIcs, setShowIcs] = useState(false);
  const [detail, setDetail] = useState(null);
  const [toastMsg, setToastMsg] = useState("");
  const tRef = useRef(0);

  const toast = useCallback((m) => {
    setToastMsg(m);
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToastMsg(""), 2300);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("cp-theme", next);
    } catch {}
    setTheme(next);
  }

  // shared routine from URL hash
  useEffect(() => {
    let alive = true;
    const read = async () => {
      const m = window.location.hash.match(/^#r=(.+)$/);
      if (!m) {
        setShared(null);
        return;
      }
      const r = await decodeShare(m[1]);
      if (!alive) return;
      if (r) setShared(r);
      else {
        setShared(null);
        toast("This shared link is invalid");
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => {
      alive = false;
      window.removeEventListener("hashchange", read);
    };
  }, [toast]);

  const shownItems = shared ? shared.items : items;
  const shownTitle = shared ? shared.title : title;
  const conf = useMemo(() => findConflicts(shownItems), [shownItems]);
  const pickedCredits = shownItems.reduce((s, i) => s + (Number(i.credit) || 0), 0);
  const totalCredits = courses.reduce((s, c) => s + (Number(c.credit) || 0), 0);

  const clashOf = (c, s) => {
    const codes = [];
    for (const it of items) if (it.code !== c.code && overlaps(it, s) && !codes.includes(it.code)) codes.push(it.code);
    return codes;
  };

  function pick(code, sec) {
    setPicks((p) => {
      const n = { ...(p && typeof p === "object" ? p : {}) };
      if (n[code] === sec) delete n[code];
      else n[code] = sec;
      return n;
    });
  }

  function autoPlan() {
    const order = courses.filter((c) => c.sections.length).sort((a, b) => a.sections.length - b.sections.length);
    const chosen = [];
    const result = {};
    let steps = 0;
    const bt = (i) => {
      if (i === order.length) return true;
      if (++steps > 600000) return false;
      const c = order[i];
      for (const s of c.sections) {
        if (chosen.every((o) => !overlaps(o, s))) {
          chosen.push(s);
          result[c.code] = s.sec;
          if (bt(i + 1)) return true;
          chosen.pop();
          delete result[c.code];
        }
      }
      return false;
    };
    if (bt(0)) {
      setPicks(result);
      toast("Auto plan ready");
    } else {
      window.alert("No conflict-free combination exists for all courses.");
    }
  }

  function saveCustom(course, oldCode) {
    setCustom((list) => {
      const arr = Array.isArray(list) ? list : [];
      const i = arr.findIndex((x) => x.id === course.id);
      if (i >= 0) {
        const n = [...arr];
        n[i] = course;
        return n;
      }
      return [...arr, course];
    });
    setPicks((p) => {
      const n = { ...(p || {}) };
      if (oldCode && oldCode !== course.code) delete n[oldCode];
      n[course.code] = course.sections[0].sec;
      return n;
    });
    setFormFor(undefined);
    toast("Course saved");
  }

  function removeCustom(c) {
    setCustom((list) => (Array.isArray(list) ? list : []).filter((x) => x.id !== c.id));
    setPicks((p) => {
      const n = { ...(p || {}) };
      delete n[c.code];
      return n;
    });
  }

  function onCatalogSave(cat) {
    setCatalog({ program: cat.program, term: cat.term, courses: cat.courses });
    const all = [...cat.courses, ...custom];
    setPicks((p) => {
      const n = {};
      for (const [k, v] of Object.entries(p || {})) {
        const c = all.find((x) => x.code === k);
        if (c && c.sections.some((s) => s.sec === v)) n[k] = v;
      }
      return n;
    });
    setShowCatalog(false);
    toast("Catalog saved");
  }

  function onCatalogReset() {
    setCatalog(null);
    setPicks({});
    setShowCatalog(false);
    toast("Default catalog restored");
  }

  async function share() {
    try {
      const payload = await encodeShare(shownTitle, shownItems);
      const url = `${window.location.origin}${window.location.pathname}#r=${payload}`;
      try {
        await navigator.clipboard.writeText(url);
        toast("Share link copied");
      } catch {
        window.prompt("Copy this link", url);
      }
    } catch {
      toast("Could not create the link");
    }
  }

  async function savePng() {
    const node = document.querySelector(".capture");
    if (!node) return;
    try {
      const { toPng } = await import("html-to-image");
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--card").trim() || "#ffffff";
      const url = await toPng(node, { pixelRatio: 2, backgroundColor: bg, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = slug(shownTitle) + ".png";
      a.click();
    } catch {
      toast("Could not create the PNG");
    }
  }

  function closeShared() {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setShared(null);
  }

  function adoptShared() {
    if (!shared) return;
    const nextCustom = [...custom];
    const nextPicks = {};
    const all = () => [...base.courses, ...nextCustom];
    const sameSec = (it) => (s) =>
      s.sec === it.section &&
      [...s.days].sort().join() === [...it.days].sort().join() &&
      s.start === it.start &&
      s.end === it.end;
    for (const it of shared.items) {
      const find = (code) => all().find((c) => c.code === code && c.sections.some(sameSec(it)));
      let c = find(it.code) || find(it.code + " (shared)");
      if (c) {
        nextPicks[c.code] = it.section;
        continue;
      }
      let code = it.code;
      if (all().some((x) => x.code === code)) {
        code = it.code + " (shared)";
        let n = 2;
        while (all().some((x) => x.code === code)) code = `${it.code} (shared ${n++})`;
      }
      nextCustom.push({
        id: uid(),
        code,
        title: it.title,
        credit: it.credit,
        custom: true,
        sections: [{ sec: it.section, faculty: it.faculty, days: it.days, start: it.start, end: it.end, room: it.room, seats: null }],
      });
      nextPicks[code] = it.section;
    }
    setCustom(nextCustom);
    setPicks(nextPicks);
    setTitle(shared.title);
    closeShared();
    toast("Routine copied to your planner");
  }

  const hueOf = (code) => HUES[Math.max(0, courses.findIndex((c) => c.code === code)) % 8];

  return (
    <div className="app">
      <header className="hdr">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            <Icon name="calendar" size={22} />
          </div>
          <div className="brand-t">
            <h1>Course Planner</h1>
            <p>
              {base.program} · {base.term} · routine maker
            </p>
          </div>
        </div>
        <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle light and dark theme">
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>
      </header>

      <section className="stats" aria-label="Summary">
        <div className="stat card">
          <span className="stat-l">Credits</span>
          <span className="stat-v">
            {pickedCredits} / {totalCredits}
          </span>
        </div>
        <div className="stat card">
          <span className="stat-l">Courses picked</span>
          <span className="stat-v">
            {shownItems.length} / {courses.length}
          </span>
        </div>
        <div className={"stat card " + (conf.pairs.length ? "bad" : "good")}>
          <span className="stat-l">Conflicts</span>
          <span className="stat-v">{conf.pairs.length}</span>
        </div>
      </section>

      {conf.pairs.length > 0 && (
        <div className="alert" role="alert">
          <Icon name="warn" />
          <div>
            {conf.pairs.map((p, i) => (
              <div key={i}>
                {p.a.code} overlaps with {p.b.code} on {p.shared.join(", ")}
              </div>
            ))}
          </div>
        </div>
      )}

      {shared && (
        <div className="banner">
          <div>
            <b>Shared routine</b> — You are viewing “{shared.title}”. Your own planner is unchanged.
          </div>
          <div className="banner-btns">
            <button className="btn primary sm" onClick={adoptShared}>
              Use as my routine
            </button>
            <button className="btn ghost sm" onClick={closeShared}>
              Close
            </button>
          </div>
        </div>
      )}

      <main className="layout">
        <aside className="card sidebar">
          <div className="sb-head">
            <h2>Courses</h2>
            <button className="btn primary" onClick={autoPlan}>
              ✦ Auto plan
            </button>
          </div>
          <div className="sb-row">
            <label className="check">
              <input type="checkbox" checked={hideClash} onChange={(e) => setHideClash(e.target.checked)} />
              <span>Hide clashing sections</span>
            </label>
          </div>
          <div className="sb-row">
            <button className="btn ghost sm" onClick={() => setFormFor(null)}>
              <Icon name="plus" size={14} /> Custom
            </button>
            <button className="btn ghost sm" onClick={() => setPicks({})}>
              Reset
            </button>
            <button className="btn ghost sm" onClick={() => setShowCatalog(true)}>
              ⚙ Manage
            </button>
          </div>
          <div className="course-list">
            {courses.map((c, i) => (
              <CourseCard
                key={(c.id || "") + c.code}
                c={c}
                hue={HUES[i % 8]}
                open={open === c.code}
                onToggle={() => setOpen(open === c.code ? null : c.code)}
                picked={picks[c.code]}
                clashOf={clashOf}
                hideClash={hideClash}
                onPick={pick}
                onEdit={(course) => setFormFor(course)}
                onRemove={removeCustom}
              />
            ))}
            {courses.length === 0 && <p className="muted">No courses yet. Use “Manage” to add some.</p>}
          </div>
        </aside>

        <section className="card routine-card">
          <div className="toolbar">
            <input
              className="title-input"
              value={shownTitle}
              readOnly={!!shared}
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Routine title"
              placeholder="My Semester Routine"
            />
            <div className="tb-btns">
              <button className="btn ghost sm" onClick={() => setShowPlans(true)}>
                <Icon name="bookmark" size={14} /> Routines ({plans.length})
              </button>
              <button className="btn ghost sm" onClick={share} disabled={!shownItems.length}>
                <Icon name="link" size={14} /> Share
              </button>
              <button className="btn ghost sm" onClick={() => setShowIcs(true)} disabled={!shownItems.length}>
                <Icon name="calendar" size={14} /> .ics
              </button>
              <button className="btn ghost sm" onClick={() => window.print()}>
                <Icon name="printer" size={14} /> PDF
              </button>
              <button className="btn primary sm" onClick={savePng}>
                <Icon name="download" size={14} /> PNG
              </button>
            </div>
          </div>
          <div className="rt-scroll">
            <Routine items={shownItems} conflictIds={conf.ids} title={shownTitle} onSelect={setDetail} />
          </div>
        </section>
      </main>

      {formFor !== undefined && (
        <CourseForm courses={courses} editing={formFor} onSave={saveCustom} onClose={() => setFormFor(undefined)} />
      )}
      {showCatalog && (
        <CatalogModal base={base} onSave={onCatalogSave} onReset={onCatalogReset} onClose={() => setShowCatalog(false)} />
      )}
      {showPlans && (
        <PlansModal
          courses={courses}
          picks={picks}
          plans={plans}
          setPlans={setPlans}
          readOnly={!!shared}
          currentTitle={title}
          onLoad={(p) => {
            setPicks({ ...p.picks });
            setTitle(p.name);
            if (shared) closeShared();
            setShowPlans(false);
            toast("Routine loaded");
          }}
          toast={toast}
          onClose={() => setShowPlans(false)}
        />
      )}
      {showIcs && <IcsDialog items={shownItems} title={shownTitle} onClose={() => setShowIcs(false)} />}
      {detail && (
        <ClassDetail
          item={detail}
          courses={courses}
          items={shownItems}
          readOnly={!!shared}
          hueOf={hueOf}
          onSwap={(code, sec) => {
            setPicks((p) => ({ ...(p || {}), [code]: sec }));
            setDetail(null);
          }}
          onRemove={(code) => {
            pick(code, picks[code]);
            setDetail(null);
          }}
          onClose={() => setDetail(null)}
        />
      )}
      {toastMsg && (
        <div className="toast" role="status" key={toastMsg}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}