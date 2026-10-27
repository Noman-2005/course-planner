import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import Routine from "./Routine.jsx";
import CourseForm from "./CourseForm.jsx";
import ClassDetail from "./ClassDetail.jsx";
import PlansModal from "./PlansModal.jsx";
import IcsDialog from "./IcsDialog.jsx";
import { itemsFor } from "./plans.js";
import { encodeShare, decodeShare } from "./share.js";
import { findConflicts, overlaps, useLocalStorage, uid, fmt, fmtDur, toMin, slug, HUES } from "./utils.js";

const AdminModal = lazy(() => import("./AdminModal.jsx"));
const EMPTY = { program: "", term: "", courses: [] };

/* ---------- Auto plan helpers ---------- */

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Builds conflict-free section combinations, ranked by smallest total gap between classes.
// Uses forward checking + a time limit so it never freezes the page.
function buildAutoCombos(courses, maxCombos = 20000, timeMs = 600) {
  const base = courses
    .filter((c) => c.sections.length)
    .map((c) => ({
      code: c.code,
      secs: shuffleArr(
        c.sections.map((s) => ({ sec: s.sec, days: s.days, a: toMin(s.start), b: toMin(s.end) }))
      ),
    }));

  const clash = (x, y) => x.a < y.b && y.a < x.b && x.days.some((d) => y.days.includes(d));

  const gapScore = (chosen) => {
    const byDay = {};
    for (const { s } of chosen) for (const d of s.days) (byDay[d] = byDay[d] || []).push(s);
    let total = 0;
    for (const d in byDay) {
      const list = byDay[d].sort((p, q) => p.a - q.a);
      for (let i = 1; i < list.length; i++) total += Math.max(0, list[i].a - list[i - 1].b);
    }
    return total;
  };

  const results = [];
  const chosen = [];
  const t0 = performance.now();
  let tick = 0;
  let timedOut = false;

  const bt = (remaining) => {
    if (timedOut || results.length >= maxCombos) return;
    if ((++tick & 255) === 0 && performance.now() - t0 > timeMs) {
      timedOut = true;
      return;
    }
    if (!remaining.length) {
      const picks = {};
      for (const { code, s } of chosen) picks[code] = s.sec;
      results.push({ picks, score: gapScore(chosen) });
      return;
    }

    // pick the most constrained course first (fewest options left)
    let bi = 0;
    for (let k = 1; k < remaining.length; k++) {
      if (remaining[k].secs.length < remaining[bi].secs.length) bi = k;
    }
    const cur = remaining[bi];
    const rest = remaining.filter((_, k) => k !== bi);

    for (const s of cur.secs) {
      // forward check: every other course must still have at least one usable section
      const next = [];
      let ok = true;
      for (const r of rest) {
        const secs = r.secs.filter((x) => !clash(x, s));
        if (!secs.length) {
          ok = false;
          break;
        }
        next.push({ code: r.code, secs });
      }
      if (!ok) continue;

      chosen.push({ code: cur.code, s });
      bt(next);
      chosen.pop();
      if (timedOut || results.length >= maxCombos) return;
    }
  };

  if (base.length) bt(base);
  results.sort((p, q) => p.score - q.score);
  return { list: results, timedOut };
}


const comboKey = (picks, codes) => codes.map((c) => c + ":" + (picks ? picks[c] : "")).join("|");

function CourseCard({ c, hue, open, onToggle, picked, clashOf, hideClash, onPick, onEdit, onRemove, onDrop }) {
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
          <div className="c-actions">
            {c.custom && (
              <button className="btn ghost sm" onClick={() => onEdit(c)}>
                <Icon name="edit" size={14} /> Edit
              </button>
            )}
            <button className="btn ghost sm danger" onClick={() => (c.custom ? onRemove(c) : onDrop(c))}>
              <Icon name="trash" size={14} /> Remove course
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [catalogRaw, setCatalog] = useLocalStorage("cp-catalog", null); // cache of the selected department
  const [deptRaw, setDeptId] = useLocalStorage("cp-dept", "");
  const [addedRaw, setAdded] = useLocalStorage("cp-added", []); // course codes the student added
  const [customRaw, setCustom] = useLocalStorage("cp-custom", []);
  const [picksRaw, setPicks] = useLocalStorage("cp-picks", {});
  const [plansRaw, setPlans] = useLocalStorage("cp-plans", []);
  const [titleRaw, setTitle] = useLocalStorage("cp-title", "My Semester Routine");

  const deptId = typeof deptRaw === "string" ? deptRaw : "";
  const added = Array.isArray(addedRaw) ? addedRaw.filter((x) => typeof x === "string") : [];
  const custom = Array.isArray(customRaw) ? customRaw : [];
  const picks = picksRaw && typeof picksRaw === "object" && !Array.isArray(picksRaw) ? picksRaw : {};
  const plans = Array.isArray(plansRaw) ? plansRaw : [];
  const title = typeof titleRaw === "string" ? titleRaw : "My Semester Routine";

  const base = useMemo(
    () => (catalogRaw && Array.isArray(catalogRaw.courses) && catalogRaw.program === deptId ? catalogRaw : EMPTY),
    [catalogRaw, deptId]
  );
  const courses = useMemo(() => [...base.courses, ...custom], [base, custom]); // everything that exists
  // "my courses" = the ones the student added (+ own custom courses); the routine is built from these only
  const myCourses = useMemo(() => {
    const byCode = new Map(base.courses.map((c) => [c.code, c]));
    return [...added.map((code) => byCode.get(code)).filter(Boolean), ...custom];
  }, [added, base, custom]);
  const items = useMemo(() => itemsFor(myCourses, picks), [myCourses, picks]);
    const autoRef = useRef({ sig: "", list: [], i: 0 });

  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "dark");
  const [shared, setShared] = useState(null);
  const [open, setOpen] = useState(null);
  const [hideClash, setHideClash] = useState(false);
  const [query, setQuery] = useState("");
  const [formFor, setFormFor] = useState(undefined); // undefined closed, null new, course edit
  const [showPlans, setShowPlans] = useState(false);
  const [showIcs, setShowIcs] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [detail, setDetail] = useState(null);
  const [toastMsg, setToastMsg] = useState("");
  const [depts, setDepts] = useState(null); // null = loading
  const [loadingCat, setLoadingCat] = useState(false);
  const [netErr, setNetErr] = useState("");
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

  /* ---------- department list from the server ---------- */
  const loadList = useCallback(async () => {
    try {
      const r = await fetch("/api/catalog", { cache: "no-store" });
      if (!r.ok) throw new Error("bad");
      const d = await r.json();
      setDepts(Array.isArray(d.departments) ? d.departments : []);
      setNetErr("");
    } catch {
      setDepts((p) => p || []);
      setNetErr("Could not reach the server. Showing the last saved list.");
    }
  }, []);
  useEffect(() => {
    loadList();
  }, [loadList]);

  // load the selected department's courses (cached until the admin publishes a new version)
  useEffect(() => {
    if (!depts || !depts.length) return;
    if (!depts.some((d) => d.id === deptId)) {
      setDeptId(depts.length === 1 ? depts[0].id : "");
      return;
    }
    const meta = depts.find((d) => d.id === deptId);
    if (catalogRaw && catalogRaw.program === deptId && catalogRaw.updatedAt === meta.updatedAt) return;
    let alive = true;
    setLoadingCat(true);
    fetch(`/api/catalog?dept=${encodeURIComponent(deptId)}&v=${meta.updatedAt}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((cat) => {
        if (!alive) return;
        setCatalog({ program: cat.program, term: cat.term, courses: cat.courses, updatedAt: cat.updatedAt });
        const codes = new Set(cat.courses.map((c) => c.code));
        setAdded((a) => (Array.isArray(a) ? a : []).filter((code) => codes.has(code)));
        const all = [...cat.courses, ...custom];
        setPicks((p) => {
          const n = {};
          for (const [k, v] of Object.entries(p || {})) {
            const c = all.find((x) => x.code === k);
            if (c && c.sections.some((s) => s.sec === v)) n[k] = v;
          }
          return n;
        });
        setNetErr("");
      })
      .catch(() => alive && setNetErr("Could not load this department's list."))
      .finally(() => alive && setLoadingCat(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depts, deptId]);

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
  const totalCredits = myCourses.reduce((s, c) => s + (Number(c.credit) || 0), 0);
  const meta = depts && depts.find((d) => d.id === deptId);

  const addedSet = useMemo(() => new Set(added), [added]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, " ");
    if (!q) return [];
    const qn = q.replace(/\s/g, "");
    return base.courses
      .filter((c) => c.code.toLowerCase().replace(/\s/g, "").includes(qn) || c.title.toLowerCase().includes(q))
      .slice(0, 30);
  }, [query, base]);

  const clashOf = (c, s) => {
    const codes = [];
    for (const it of items) if (it.code !== c.code && overlaps(it, s) && !codes.includes(it.code)) codes.push(it.code);
    return codes;
  };

  function addCourse(code) {
    setAdded((a) => {
      const list = Array.isArray(a) ? a : [];
      return list.includes(code) ? list : [...list, code];
    });
    setOpen(code);
    toast(`${code} added`);
  }

  function dropCourse(c) {
    setAdded((a) => (Array.isArray(a) ? a : []).filter((x) => x !== c.code));
    setPicks((p) => {
      const n = { ...(p || {}) };
      delete n[c.code];
      return n;
    });
    if (open === c.code) setOpen(null);
  }

  function pick(code, sec) {
    setPicks((p) => {
      const n = { ...(p && typeof p === "object" ? p : {}) };
      if (n[code] === sec) delete n[code];
      else n[code] = sec;
      return n;
    });
  }

      function autoPlan() {
    const valid = myCourses.filter((c) => c.sections.length);
    if (!valid.length) return;

    const codes = valid.map((c) => c.code).sort();
    const sig = valid
      .map((c) => c.code + "[" + c.sections.map((s) => `${s.sec}@${s.days.join("")}${s.start}-${s.end}`).join(",") + "]")
      .sort()
      .join("|");

    const st = autoRef.current;
    if (st.sig !== sig) {
      const built = buildAutoCombos(myCourses);
      if (!built.list.length) {
        st.sig = ""; // don't cache a failed search
        window.alert(
          built.timedOut
            ? "Too many courses to check quickly. Try removing a course or two and run Auto plan again."
            : "No slot available. The courses you added can't fit together without a time clash. Remove a course or change a section and try again."
        );
        return;
      }
      st.sig = sig;
      st.list = built.list;
      st.i = 0;
    }

    const curKey = comboKey(picks, codes);
    let next = null;
    let wrapped = false;

    for (let tries = 0; tries < st.list.length; tries++) {
      if (st.i >= st.list.length) {
        st.i = 0;
        wrapped = true;
      }
      const cand = st.list[st.i++];
      if (comboKey(cand.picks, codes) !== curKey) {
        next = cand;
        break;
      }
    }

    if (!next) {
      toast("This is the only possible combination");
      return;
    }

    setPicks(next.picks);
    toast(
      (wrapped ? "All combinations shown, starting over · " : "Auto plan ready · ") +
        (next.score === 0 ? "no gaps" : `total gap ${fmtDur(next.score)}`)
    );
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

  async function savePng(mode) {
    const node = document.querySelector(".capture");
    if (!node) return;
    const themeName = mode || document.documentElement.dataset.theme || "light";
    let clone;
    try {
      const { toPng } = await import("html-to-image");
      clone = node.cloneNode(true);
      clone.classList.remove("theme-light", "theme-dark");
      clone.classList.add("theme-" + themeName);
      Object.assign(clone.style, { position: "fixed", left: "-10000px", top: "0", width: node.offsetWidth + "px" });
      document.body.appendChild(clone);
      const bg = getComputedStyle(clone).getPropertyValue("--card").trim() || (themeName === "dark" ? "#12152a" : "#ffffff");
      const url = await toPng(clone, {
        pixelRatio: 2,
        backgroundColor: bg,
        cacheBust: true,
        style: { position: "static", left: "auto", top: "auto", margin: "0" },
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug(shownTitle)}-${themeName}.png`;
      a.click();
    } catch {
      toast("Could not create the PNG");
    } finally {
      if (clone) clone.remove();
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
    const nextAdded = [];
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
        if (!c.custom && !nextAdded.includes(c.code)) nextAdded.push(c.code);
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
        sections: [
  {
    sec: it.section,
    faculty: it.faculty,
    facultyInitial: it.facultyInitial || "",
    days: it.days,
    start: it.start,
    end: it.end,
    room: it.room,
    seats: null,
  },
],
      });
      nextPicks[code] = it.section;
    }
    setCustom(nextCustom);
    setAdded(nextAdded);
    setPicks(nextPicks);
    setTitle(shared.title);
    closeShared();
    toast("Routine copied to your planner");
  }

  const hueOf = (code) => HUES[Math.max(0, myCourses.findIndex((c) => c.code === code)) % 8];

  const emptyTitle =
    loadingCat || depts === null
      ? "Loading course list…"
      : !depts.length
      ? "No course list yet"
      : !deptId
      ? "Choose your department"
      : "Add your courses";
  const emptyText =
    !depts || loadingCat
      ? ""
      : !depts.length
      ? "The course list has not been published yet. Please check back later."
      : !deptId
      ? "Select your department from the menu above."
      : "Search a course above (for example “CSE 3521” or “database”) and press + Add. Your routine is built from the courses you add.";

  return (
    <div className="app">
      <header className="hdr">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            <Icon name="calendar" size={22} />
          </div>
          <div className="brand-t">
            <h1>Course Planner</h1>
            <p>{base.program ? `${base.program} · ${base.term} · routine maker` : "routine maker"}</p>
          </div>
        </div>
        <div className="hdr-actions">
         <button className="btn primary sm" onClick={() => setShowAdmin(true)}>
  Admin
</button>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle light and dark theme">
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
        </div>
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
            {shownItems.length} / {myCourses.length}
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
            <button className="btn primary" onClick={autoPlan} disabled={!myCourses.length}>
              ✦ Auto plan
            </button>
          </div>

          <div className="sb-dept">
            <select
              aria-label="Department"
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              disabled={!depts || !depts.length}
            >
              <option value="">
                {depts === null ? "Loading…" : depts.length ? "Select your department…" : "No lists published yet"}
              </option>
              {(depts || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id}
                  {d.term ? ` · ${d.term}` : ""}
                </option>
              ))}
            </select>
            {meta && (
              <p className="muted small" style={{ marginTop: 6 }}>
                Updated {new Date(meta.updatedAt).toLocaleDateString()} · {meta.count} courses
              </p>
            )}
          </div>
          {netErr && (
            <div className="notice" style={{ marginBottom: 10 }}>
              {netErr}
            </div>
          )}

          {base.courses.length > 0 && (
            <div className="finder">
              <input
                type="search"
                className="finder-input"
                placeholder="Search a course to add (code or name)…"
                aria-label="Search courses to add"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query.trim() && (
                <div className="results">
                  {results.length === 0 && <p className="muted small" style={{ padding: 8 }}>No course found.</p>}
                  {results.map((c) => {
                    const isAdded = addedSet.has(c.code);
                    return (
                      <div className="result" key={c.code}>
                        <div className="result-info">
                          <b>{c.code}</b>
                          <span>{c.title}</span>
                          <em>
                            {c.credit} cr · {c.sections.length} sections
                          </em>
                        </div>
                        <button className="btn primary sm" onClick={() => addCourse(c.code)} disabled={isAdded}>
                          {isAdded ? "✓ Added" : "+ Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
          </div>

          {myCourses.length > 0 && <h3 className="my-head">My courses ({myCourses.length})</h3>}
          <div className="course-list">
            {myCourses.map((c, i) => (
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
                onDrop={dropCourse}
              />
            ))}
            {myCourses.length === 0 && (
              <div className="empty">
                <b>{emptyTitle}</b>
                {emptyText && <p className="muted small">{emptyText}</p>}
              </div>
            )}
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
              <button className="btn primary sm" onClick={() => savePng("light")}>
                <Icon name="sun" size={14} /> PNG Light
              </button>
              <button className="btn primary sm" onClick={() => savePng("dark")}>
                <Icon name="moon" size={14} /> PNG Dark
              </button>
            </div>
          </div>
          <div className="rt-scroll">
            <Routine items={shownItems} conflictIds={conf.ids} title={shownTitle} onSelect={setDetail} />
          </div>
        </section>
      </main>

     <footer
  className="foot"
  style={{
    marginTop: "50px",
    paddingTop: "20px",
    paddingBottom: "8px",
    transform: "translateY(20px)",
    fontSize: "10px",
  }}
>
  <p style={{ margin: 0, lineHeight: 1.4 }}>
    Developed by{" "}
    <a
      href="https://my-portfolio-eta-seven-hrcv9gnzaf.vercel.app/"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "var(--accent)",
        textDecoration: "none",
        fontWeight: 600,
        whiteSpace: "nowrap",
        fontSize: "10px",
      }}
    >
      Shibli Noman Arnob
    </a>
  </p>
</footer>

      {formFor !== undefined && (
        <CourseForm courses={courses} editing={formFor} onSave={saveCustom} onClose={() => setFormFor(undefined)} />
      )}
      {showAdmin && (
        <Suspense fallback={null}>
          <AdminModal departments={depts || []} onClose={() => setShowAdmin(false)} onPublished={loadList} />
        </Suspense>
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
            const codes = Object.keys(p.picks || {});
            setAdded(codes.filter((code) => base.courses.some((c) => c.code === code)));
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