import { toMin } from "./utils.js";

const isCode = (s) => /^\S+$/.test(s) && (s.match(/[A-Z]/g) || []).length >= 2;
const hasNum = (v) => v !== null && v !== undefined && v !== "" && !isNaN(Number(v));

export function sectionIssues(course, s) {
  const out = [];
  const others = course.sections.filter((x) => x !== s);
  const idx = course.sections.indexOf(s);

  if (!/^[A-Z]{1,3}$/.test(String(s.sec || "").trim())) out.push("unusual section name");
  if (!s.days || !s.days.length) out.push("no days");

  const timeOk = /^\d{1,2}:\d{2}$/.test(s.start || "") && /^\d{1,2}:\d{2}$/.test(s.end || "");
  const a = toMin(s.start);
  const b = toMin(s.end);
  if (!timeOk || !(b > a)) out.push("end is not after start");
  else {
    if (a < 360 || b > 1320) out.push("unusual time of day");
    const len = b - a;
    if (len < 30 || len > 240) out.push(`unusual class length (${len} min)`);
  }

  const fac = String(s.faculty || "").trim();
  if (!fac) out.push("faculty missing");
  else if (fac !== "TBA" && isCode(fac)) out.push("looks like a short code, full name may be missing");

  const seatVals = others.filter((x) => hasNum(x.seats)).map((x) => Number(x.seats));
  if (!hasNum(s.seats)) {
    if (seatVals.length) out.push("seats missing");
  } else if (seatVals.length >= 2) {
    const sorted = [...seatVals].sort((x, y) => x - y);
    const med = sorted[sorted.length >> 1];
    const v = Number(s.seats);
    if (med > 0 && (v > med * 3 || v < med / 3)) out.push("seats look unusual");
  }

  if (!String(s.room || "").trim() && others.some((x) => String(x.room || "").trim())) out.push("room missing");

  const key = (x) => [(x.days || []).join(","), x.start, x.end, x.faculty, x.room].join("|");
  const dup = course.sections.slice(0, idx).find((x) => key(x) === key(s));
  if (dup) out.push(`same days, time, faculty and room as section ${dup.sec}`);
  return out;
}

export function courseIssues(c) {
  const out = [];
  if (!String(c.code || "").trim()) out.push("course code missing");
  if (!String(c.title || "").trim()) out.push("title missing");
  const cr = Number(c.credit);
  if (!(cr > 0) || cr > 6) out.push("unusual credit");
  if (!c.sections.length) out.push("no sections");
  return out;
}

export function summarize(courses, expected, warnings) {
  const credits = Math.round(courses.reduce((s, c) => s + (Number(c.credit) || 0), 0) * 10) / 10;
  const sectionCount = courses.reduce((n, c) => n + c.sections.length, 0);
  const checks = [];
  const exp = expected || {};
  let any = false;
  if (exp.sections != null) {
    any = true;
    checks.push(
      sectionCount === exp.sections
        ? { level: "ok", text: `All ${exp.sections} rows of the sheet were read (${courses.length} courses)` }
        : { level: "bad", text: `The sheet has ${exp.sections} rows, but ${sectionCount} sections are in the list` }
    );
  }
  if (exp.courses != null) {
    any = true;
    checks.push(
      courses.length === exp.courses
        ? { level: "ok", text: `Course count matches the page header (${exp.courses})` }
        : { level: "bad", text: `Header says ${exp.courses} courses, but ${courses.length} were read` }
    );
  }
  if (exp.credits != null) {
    any = true;
    checks.push(
      credits === exp.credits
        ? { level: "ok", text: `Total credits match the page header (${exp.credits})` }
        : { level: "bad", text: `Header says ${exp.credits} credits, but ${credits} were read` }
    );
  }
  if (!any) checks.push({ level: "warn", text: "No course or credit totals found in the page header, so please check the counts yourself" });
  (warnings || []).forEach((w) => checks.push({ level: "warn", text: w }));

  let flagged = 0;
  for (const c of courses) {
    if (courseIssues(c).length) flagged++;
    for (const s of c.sections) if (sectionIssues(c, s).length) flagged++;
  }
  return { checks, credits, flagged };
}