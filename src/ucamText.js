import { joinFaculty, pad, parseHeader, parseSchedToken, postWarnings, resolveSchedule } from "./utils.js";

const HEADER_WORDS = new Set(["section", "faculty", "schedule", "room", "seats"]);
const DAY_TOK = /^(Sat|Sun|Mon|Tue|Wed|Thu|Fri)$/i;
const TIME_TOK = /^\d{1,2}[:.;]\d{2}\s*[-–—~]\s*\d{1,2}[:.;]\d{2}$/;
const COURSE1 = /^([A-Z]{2,5})\s?(\d{3,4}[A-Z]?)\s+(\d+(?:\.\d+)?)\s*(?:cr|credits?)\b\s*(.*)$/i;
const COURSE_CODE = /^([A-Z]{2,5})\s?(\d{3,4}[A-Z]?)$/;
const CREDIT = /^(\d+(?:\.\d+)?)\s*(?:cr|credits?)$/i;
const SECTION = /^[A-Z]{1,3}$/;
const NUM = /^\d+$/;

function tokenize(raw) {
  const parts = String(raw)
    .replace(/\r/g, "")
    .replace(/\n|\t| {2,}/g, "\u0001")
    .split("\u0001")
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    if (DAY_TOK.test(parts[i]) && i + 1 < parts.length && TIME_TOK.test(parts[i + 1])) {
      out.push(parts[i] + " " + parts[i + 1]);
      i++;
    } else out.push(parts[i]);
  }
  return out;
}

export function parseUcamText(rawText) {
  const toks = tokenize(rawText);
  const warnings = [];

  const courseAt = (i) => {
    const t = toks[i];
    if (t == null) return null;
    let m = t.match(COURSE1);
    if (m) return { code: `${m[1].toUpperCase()} ${m[2].toUpperCase()}`, credit: parseFloat(m[3]), title: m[4].trim(), n: 1 };
    m = t.match(COURSE_CODE);
    if (m && toks[i + 1] != null) {
      const c = toks[i + 1].match(CREDIT);
      if (c) return { code: `${m[1].toUpperCase()} ${m[2].toUpperCase()}`, credit: parseFloat(c[1]), title: "", n: 2 };
    }
    return null;
  };
  const isHeaderWord = (t) => HEADER_WORDS.has(String(t).toLowerCase());
  const isSched = (t) => !!parseSchedToken(t);

  // a single-letter-ish token is a section only if a schedule follows soon
  const isSectionStart = (i) => {
    if (toks[i] == null || !SECTION.test(toks[i])) return false;
    for (let j = i + 1; j < Math.min(toks.length, i + 9); j++) {
      const t = toks[j];
      if (isSched(t)) return true;
      if (NUM.test(t) || isHeaderWord(t) || courseAt(j)) return false;
    }
    return false;
  };

  // header = everything before the first course header
  let firstCourse = toks.findIndex((_, i) => courseAt(i));
  if (firstCourse < 0) firstCourse = toks.length;
  const header = parseHeader(toks.slice(0, firstCourse).join(" "));

  const courses = [];
  const byCode = new Map();
  let cur = null;
  let i = 0;
  while (i < toks.length) {
    const ch = courseAt(i);
    if (ch) {
      cur = byCode.get(ch.code);
      if (!cur) {
        cur = { code: ch.code, title: ch.title, credit: ch.credit, sections: [] };
        byCode.set(ch.code, cur);
        courses.push(cur);
      }
      i += ch.n;
      if (!cur.title) {
        let j = i;
        while (j < toks.length && isHeaderWord(toks[j])) j++;
        if (j < toks.length && !courseAt(j) && !SECTION.test(toks[j]) && !isSched(toks[j])) {
          cur.title = toks[j];
          i = j + 1;
        }
      }
      continue;
    }
    if (isHeaderWord(toks[i])) {
      i++;
      continue;
    }
    if (cur && isSectionStart(i)) {
      const sec = toks[i];
      i++;
      const fac = [];
      while (i < toks.length && !isSched(toks[i]) && !courseAt(i) && fac.length < 8) {
        fac.push(toks[i]);
        i++;
      }
      const entries = [];
      while (i < toks.length && isSched(toks[i])) {
        entries.push(...parseSchedToken(toks[i]));
        i++;
      }
      // tail: room, seats
      let room = "",
        seats = null;
      const free = (j) => j < toks.length && !isSectionStart(j) && !courseAt(j) && !isHeaderWord(toks[j]);
      if (free(i)) {
        if (!NUM.test(toks[i])) {
          room = toks[i];
          i++;
          if (free(i) && NUM.test(toks[i])) {
            seats = parseInt(toks[i], 10);
            i++;
          }
        } else if (free(i + 1) && NUM.test(toks[i + 1])) {
          room = toks[i];
          seats = parseInt(toks[i + 1], 10);
          i += 2;
        } else {
          seats = parseInt(toks[i], 10);
          i++;
        }
      }
      const sch = resolveSchedule(`${cur.code} section ${sec}`, entries, warnings);
      if (!sch) {
        warnings.push(`${cur.code} section ${sec}: no readable schedule, skipped`);
        continue;
      }
      if (cur.sections.some((s) => s.sec === sec)) {
        warnings.push(`${cur.code}: duplicate section ${sec} ignored`);
        continue;
      }
      cur.sections.push({ sec, faculty: joinFaculty(fac), days: sch.days, start: sch.start, end: sch.end, room, seats });
      continue;
    }
    i++;
  }

  postWarnings(courses, warnings);
  return { program: header.program, term: header.term, courses, warnings, expected: header.expected };
}

export { pad };