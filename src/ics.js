import { pad, toMin } from "./utils.js";

const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

function fold(line) {
  const out = [];
  let l = line;
  while (l.length > 75) {
    out.push(l.slice(0, 75));
    l = " " + l.slice(75);
  }
  out.push(l);
  return out.join("\r\n");
}

export const toInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const parseYmd = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const hms = (t) => {
  const m = toMin(t);
  return `${pad(Math.floor(m / 60))}${pad(m % 60)}00`;
};
const utcStamp = () => {
  const n = new Date();
  return `${n.getUTCFullYear()}${pad(n.getUTCMonth() + 1)}${pad(n.getUTCDate())}T${pad(n.getUTCHours())}${pad(n.getUTCMinutes())}${pad(n.getUTCSeconds())}Z`;
};

export function buildIcs(items, { start, end, reminder, title }) {
  const s = parseYmd(start);
  const e = parseYmd(end);
  const until = ymd(e);
  const stamp = utcStamp();
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Course Planner//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:" + esc(title)];

  for (const it of items) {
    for (const day of it.days) {
      const first = new Date(s);
      first.setDate(first.getDate() + ((DOW[day] - first.getDay() + 7) % 7));
      if (first > e) continue;
      const ds = ymd(first);
      L.push("BEGIN:VEVENT");
      L.push(`UID:${String(it.id).replace(/\s+/g, "")}-${day}-${ds}@course-planner`);
      L.push("DTSTAMP:" + stamp);
      L.push(`DTSTART:${ds}T${hms(it.start)}`);
      L.push(`DTEND:${ds}T${hms(it.end)}`);
      L.push(`RRULE:FREQ=WEEKLY;UNTIL=${until}T235959`);
      L.push(`SUMMARY:${esc(`${it.code} (${it.section}) ${it.title}`)}`);
      L.push("LOCATION:" + esc(it.room));
      L.push("DESCRIPTION:" + esc(`Faculty: ${it.faculty}\nCredit: ${it.credit}`));
      if (reminder > 0) {
        L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc(`${it.code} starts soon`), `TRIGGER:-PT${reminder}M`, "END:VALARM");
      }
      L.push("END:VEVENT");
    }
  }
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(text, filename) {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}