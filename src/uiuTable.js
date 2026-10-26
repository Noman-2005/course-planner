const DAY_RE = /^(Sat|Sun|Mon|Tue|Wed|Thu|Fri)$/i;
const DAY_ORDER = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

const cap = (s) =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const pad2 = (n) => String(n).padStart(2, "0");

export function parseAmPmRange(s) {
  const m = String(s || "").match(
    /(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*:?\s*(AM|PM)\s*[-–—~to]+\s*(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*:?\s*(AM|PM)/i
  );

  if (!m) return null;

  const to24 = (h, mi, ap) => {
    h = +h;
    mi = +mi;
    ap = ap.toUpperCase();

    if (h < 1 || h > 12 || mi > 59) return null;

    if (ap === "AM") {
      h = h === 12 ? 0 : h;
    } else {
      h = h === 12 ? 12 : h + 12;
    }

    return `${pad2(h)}:${pad2(mi)}`;
  };

  const start = to24(m[1], m[2], m[3]);
  const end = to24(m[4], m[5], m[6]);

  if (!start || !end || end <= start) return null;

  return { start, end };
}

const HEADER_KEYS = [
  ["sl", /^sl\.?$/i],
  ["program", /^program$/i],
  ["code", /^course\s*code$/i],
  ["title", /^title$/i],
  ["section", /^section$/i],
  ["room1", /^room\s*1$/i],
  ["room2", /^room\s*2$/i],
  ["day1", /^day\s*1$/i],
  ["day2", /^day\s*2$/i],
  ["time1", /^time\s*1$/i],
  ["time2", /^time\s*2$/i],
  ["fname", /^faculty\s*name$/i],
  [
    "finit",
    /^(?:faculty\s*initials?|faculty\s*initial|initials?|initial)$/i,
  ],
  ["credit", /^credit$/i],
];

const REQUIRED = [
  "program",
  "code",
  "title",
  "section",
  "day1",
  "time1",
  "fname",
  "credit",
];

function findHeader(items) {
  const cols = {};
  let y = null;

  for (const it of items) {
    const t = it.s.trim();

    for (const [key, re] of HEADER_KEYS) {
      if (re.test(t) && !(key in cols)) {
        cols[key] = it.x;

        if (key === "section" || key === "code") {
          y = it.y;
        }
      }
    }
  }

  if (!REQUIRED.every((k) => k in cols) || y == null) {
    return null;
  }

  const ys = items
    .filter(
      (it) =>
        Math.abs(it.y - y) < 14 &&
        HEADER_KEYS.some(([, re]) => re.test(it.s.trim()))
    )
    .map((it) => it.y);

  return {
    cols,
    bottom: Math.max(y, ...ys) + 3,
  };
}

function colOf(x, cols) {
  if (x < cols.program - 1) return "sl";

  if ("credit" in cols && x >= cols.credit - 6) {
    return "credit";
  }

  let best = "program";
  let bx = -Infinity;

  const keys = [
    "program",
    "code",
    "title",
    "section",
    "room1",
    "room2",
    "day1",
    "day2",
    "time1",
    "time2",
    "fname",
    "finit",
  ];

  for (const k of keys) {
    if (
      k in cols &&
      cols[k] <= x + 2 &&
      cols[k] > bx
    ) {
      best = k;
      bx = cols[k];
    }
  }

  return best;
}

const ALIGN = 2.6;
const CHAIN = 13.5;

export function parseUiuTable(pages) {
  let cols = null;

  const rows = [];
  let meta = { dept: "", term: "" };

  for (const page of pages) {
    const items = (page.items || [])
      .filter((it) => it.s && it.s.trim())
      .map((it) => ({
        ...it,
        s: it.s.replace(/\s+/g, " ").trim(),
      }));

    const hdr = findHeader(items);
    let bottom = 0;

    if (hdr) {
      cols = hdr.cols;
      bottom = hdr.bottom;
    }

    if (!cols) continue;

    for (const it of items) {
      if (!meta.term) {
        const m = it.s.match(
          /Course Offerings\s*:?\s*([A-Za-z]+)\s+(\d{4})/i
        );

        if (m) {
          meta.term =
            m[1].toLowerCase() + m[2].slice(2);
        }
      }

      if (!meta.dept) {
        const m = it.s.match(
          /Dept\.?\s*of\s+([A-Za-z]+)/i
        );

        if (m) {
          meta.dept = m[1].toUpperCase();
        }
      }
    }

    const body = items.filter(
      (it) =>
        it.y > bottom &&
        !/uiu\.ac\.bd|United International University|Course Offerings/i.test(
          it.s
        )
    );

    const anchors = body
      .filter(
        (it) =>
          colOf(it.x, cols) === "sl" &&
          /^\d+$/.test(it.s)
      )
      .sort((a, b) => a.y - b.y)
      .map((it) => ({
        sl: +it.s,
        y: it.y,
        cells: {},
      }));

    if (!anchors.length) continue;

    const nearest = (y) => {
      let bi = -1;
      let bd = Infinity;

      anchors.forEach((a, i) => {
        const d = Math.abs(a.y - y);

        if (d < bd) {
          bd = d;
          bi = i;
        }
      });

      return { i: bi, d: bd };
    };

    const byCol = {};

    for (const it of body) {
      const c = colOf(it.x, cols);

      if (c === "sl") continue;

      (byCol[c] = byCol[c] || []).push(it);
    }

    for (const [c, list] of Object.entries(byCol)) {
      list.sort((a, b) => b.y - a.y);

      let chain = null;
      let chainY = 0;

      for (const it of list) {
        const n = nearest(it.y);

        if (n.d <= ALIGN) {
          (
            anchors[n.i].cells[c] =
              anchors[n.i].cells[c] || []
          ).push(it);

          chain = n.i;
          chainY = it.y;
        } else if (
          chain != null &&
          chainY - it.y <= CHAIN
        ) {
          (
            anchors[chain].cells[c] =
              anchors[chain].cells[c] || []
          ).push(it);

          chainY = it.y;
        } else {
          chain = null;
        }
      }
    }

    rows.push(...anchors);
  }

  if (!rows.length) return null;

  const warnings = [];
  const courses = [];
  const byCode = new Map();

  let read = 0;
  let maxSl = 0;

  const text = (cell) =>
    (cell || [])
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((i) => i.s)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

  for (const r of rows) {
    maxSl = Math.max(maxSl, r.sl);

    const code = text(r.cells.code).toUpperCase();

    let sec = text(r.cells.section);

    const ifRequired =
      /\(\s*if\s*required\s*\)/i.test(sec);

    sec = sec.replace(/\(.*?\)/g, "").trim();

    const label =
      `Row ${r.sl}` +
      (code ? ` (${code}${sec ? " " + sec : ""})` : "");

    if (!/^[A-Z]{2,5}\s?\d{3,4}[A-Z]?$/.test(code)) {
      warnings.push(
        `${label}: course code not readable, skipped`
      );
      continue;
    }

    if (!sec) {
      warnings.push(`${label}: section missing, skipped`);
      continue;
    }

    const days = [
      text(r.cells.day1),
      text(r.cells.day2),
    ]
      .filter((d) => DAY_RE.test(d))
      .map(cap);

    const t1 = parseAmPmRange(text(r.cells.time1));
    const t2 = parseAmPmRange(text(r.cells.time2));

    if (!days.length || !t1) {
      warnings.push(
        `${label}: day or time not readable, skipped`
      );
      continue;
    }

    if (
      t2 &&
      days.length > 1 &&
      (t2.start !== t1.start || t2.end !== t1.end)
    ) {
      warnings.push(
        `${label}: the two days have different times, kept ${t1.start}–${t1.end}`
      );
    }

    const uniqDays = DAY_ORDER.filter((d) =>
      days.includes(d)
    );

    const r1 = text(r.cells.room1);
    const r2 = text(r.cells.room2);

    const room =
      r1 && r2 && r1 !== r2
        ? `${r1} / ${r2}`
        : r1 || r2;

    const credit = parseFloat(text(r.cells.credit));

    let c = byCode.get(code);

    if (!c) {
      c = {
        code: code.replace(/^([A-Z]+)(\d)/, "$1 $2"),
        title: text(r.cells.title),
        credit: isNaN(credit) ? 0 : credit,
        sections: [],
      };

      byCode.set(code, c);
      courses.push(c);
    }

    if (c.sections.some((s) => s.sec === sec)) {
      warnings.push(`${label}: duplicate section ignored`);
      continue;
    }

    if (ifRequired) {
      warnings.push(
        `${c.code} section ${sec}: marked "if required" in the sheet`
      );
    }

    const faculty = text(r.cells.fname) || "TBA";

    // Preserve the initial exactly as read from the source.
    const facultyInitial = text(r.cells.finit);

    c.sections.push({
      sec,
      faculty,
      facultyInitial: facultyInitial || "",
      days: uniqDays,
      start: t1.start,
      end: t1.end,
      room,
      seats: null,
    });

    read++;
  }

  return {
    program: meta.dept,
    term: meta.term,
    courses,
    warnings,
    expected: {
      courses: null,
      credits: null,
      sections: maxSl,
    },
    read,
    rowsSeen: rows.length,
  };
}