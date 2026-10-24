import { DAYS, HUES, findConflicts, toMin } from "./utils.js";

export function itemsFor(courses, picks) {
  const items = [];
  courses.forEach((c, i) => {
    const sec = picks && picks[c.code];
    if (!sec) return;
    const s = c.sections.find((x) => x.sec === sec);
    if (!s) return;
    items.push({
      id: c.code + s.sec,
      code: c.code,
      title: c.title,
      credit: c.credit,
      hue: HUES[i % 8],
      section: s.sec,
      faculty: s.faculty,
      room: s.room,
      days: s.days,
      start: s.start,
      end: s.end,
    });
  });
  return items;
}

export function stats(items) {
  const { pairs } = findConflicts(items);
  const used = new Set();
  items.forEach((i) => i.days.forEach((d) => used.add(d)));
  const credits = items.reduce((s, i) => s + (Number(i.credit) || 0), 0);
  let mins = 0;
  items.forEach((i) => {
    mins += (toMin(i.end) - toMin(i.start)) * i.days.length;
  });
  const byStart = [...items].sort((a, b) => toMin(a.start) - toMin(b.start));
  const byEnd = [...items].sort((a, b) => toMin(b.end) - toMin(a.end));
  let maxGap = 0;
  for (const d of DAYS) {
    const list = items.filter((i) => i.days.includes(d)).sort((a, b) => toMin(a.start) - toMin(b.start));
    let end = -1;
    for (const i of list) {
      if (end >= 0 && toMin(i.start) > end) maxGap = Math.max(maxGap, toMin(i.start) - end);
      end = Math.max(end, toMin(i.end));
    }
  }
  return {
    credits,
    courses: items.length,
    conflicts: pairs.length,
    classDays: used.size,
    freeDays: DAYS.slice(0, 6).filter((d) => !used.has(d)).length,
    hours: Math.round((mins / 60) * 10) / 10,
    earliest: byStart.length ? byStart[0].start : null,
    latest: byEnd.length ? byEnd[0].end : null,
    maxGap,
  };
}