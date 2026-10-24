import { DAYS, parseDays, parseRange, toMin } from "./utils.js";

// Text format:
//   # PROGRAM | term
//   CODE | Title | credit
//   SEC | Faculty | Days | HH:MM-HH:MM | Room | Seats      (Room, Seats optional)
export function parseCatalog(text) {
  const errors = [];
  const courses = [];
  let program = "";
  let term = "";
  let headerSeen = false;
  let cur = null;
  let curLine = 0;

  const finish = () => {
    if (cur && !cur.sections.length) errors.push(`Line ${curLine}: course ${cur.code} has no sections`);
  };

  String(text)
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const n = i + 1;
      const line = raw.trim();
      if (!line) return;
      if (line.startsWith("#")) {
        if (!headerSeen) {
          headerSeen = true;
          const p = line.replace(/^#\s*/, "").split("|").map((s) => s.trim());
          program = p[0] || "";
          term = p[1] || "";
        }
        return;
      }
      const f = line.split("|").map((s) => s.trim());

      if (f.length === 3) {
        finish();
        const code = f[0].replace(/\s+/g, " ");
        const credit = /^\d+(\.\d+)?$/.test(f[2]) ? parseFloat(f[2]) : NaN;
        cur = null;
        curLine = n;
        if (!code) return errors.push(`Line ${n}: course code is empty`);
        if (isNaN(credit)) errors.push(`Line ${n}: invalid credit "${f[2]}"`);
        if (courses.some((c) => c.code.toLowerCase() === code.toLowerCase())) {
          errors.push(`Line ${n}: duplicate course ${code}`);
          cur = { code, title: f[1], credit: credit || 0, sections: [], dup: true };
          return;
        }
        cur = { code, title: f[1], credit: isNaN(credit) ? 0 : credit, sections: [] };
        courses.push(cur);
        return;
      }

      if (f.length >= 4 && f.length <= 6) {
        if (!cur) return errors.push(`Line ${n}: section before any course`);
        const [sec, faculty, daysTxt, timeTxt, room = "", seatsTxt = ""] = f;
        let ok = true;
        if (!sec) {
          errors.push(`Line ${n}: section name is empty`);
          ok = false;
        }
        const { days, bad } = parseDays(daysTxt);
        if (!days.length || bad.length) {
          errors.push(`Line ${n}: invalid days "${daysTxt}" (use ${DAYS.join(", ")})`);
          ok = false;
        }
        const range = parseRange(timeTxt);
        if (!range) {
          errors.push(`Line ${n}: invalid time "${timeTxt}" (use HH:MM-HH:MM)`);
          ok = false;
        } else if (toMin(range.end) <= toMin(range.start)) {
          errors.push(`Line ${n}: end time must be after start time`);
          ok = false;
        }
        let seats = null;
        if (seatsTxt !== "") {
          if (/^\d+$/.test(seatsTxt)) seats = parseInt(seatsTxt, 10);
          else {
            errors.push(`Line ${n}: invalid seats "${seatsTxt}"`);
            ok = false;
          }
        }
        if (sec && cur.sections.some((s) => s.sec === sec)) {
          errors.push(`Line ${n}: duplicate section ${sec} in ${cur.code}`);
          ok = false;
        }
        if (ok && !cur.dup) cur.sections.push({ sec, faculty, days, start: range.start, end: range.end, room, seats });
        else if (ok && cur.dup) cur.sections.push({ sec });
        return;
      }

      errors.push(`Line ${n}: invalid line (a course has 3 fields, a section has 4 to 6 fields separated by |)`);
    });

  finish();
  return { program, term, courses: courses.filter((c) => !c.dup), errors };
}

export function toText(catalog) {
  const out = [`# ${catalog.program} | ${catalog.term}`];
  for (const c of catalog.courses) {
    out.push("");
    out.push(`${c.code} | ${c.title} | ${c.credit}`);
    for (const s of c.sections) {
      const parts = [s.sec, s.faculty || "", s.days.join(" "), `${s.start}-${s.end}`];
      const hasSeats = s.seats !== null && s.seats !== undefined && s.seats !== "";
      if (s.room || hasSeats) parts.push(s.room || "");
      if (hasSeats) parts.push(String(s.seats));
      out.push(parts.join(" | "));
    }
  }
  return out.join("\n") + "\n";
}