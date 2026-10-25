import { joinFaculty, parseHeader, parseSchedToken, postWarnings, resolveSchedule, SCHED_SRC } from "./utils.js";
import { parseUiuTable } from "./uiuTable.js";

const NUM = /^\d+$/;
const SECTION = /^[A-Z]{1,3}$/;
const DAY_ONLY = /^(Sat|Sun|Mon|Tue|Wed|Thu|Fri)$/i;
const TIME_ONLY = /^\d{1,2}[:.;]\d{2}\s*[-–—~]\s*\d{1,2}[:.;]\d{2}$/;
const COURSE_RE = /^([A-Z]{2,5})\s*(\d{3,4}[A-Z]?)\s+(\d+(?:\.\d+)?)\s*(?:cr|er)\b\s*(.*)$/i;

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[s.length >> 1] : 0;
};

async function loadPdf(file) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

/* ---------- PDF text items with positions (no OCR) ---------- */
async function pdfTextPages(file, report) {
  const pdf = await loadPdf(file);
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    if (p === 1 || p % 6 === 0) report(`${file.name}: reading page ${p}/${pdf.numPages}…`);
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    pages.push({
      items: tc.items
        .filter((it) => typeof it.str === "string" && it.str.trim())
        .map((it) => ({ s: it.str, x: it.transform[4], y: vp.height - it.transform[5], w: it.width })),
    });
  }
  if (pdf.destroy) await pdf.destroy();
  return pages;
}

/* ---------- words from PDF (generic path, OCR for pages without text) ---------- */
async function pdfWords(file, report, ocr) {
  const pdf = await loadPdf(file);
  const words = [];
  let offset = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    report(`${file.name}: reading page ${p}/${pdf.numPages}…`);
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    offset += vp.height;
    const tc = await page.getTextContent();
    const items = tc.items.filter((it) => typeof it.str === "string" && it.str.trim());
    if (items.length < 8) {
      const vp2 = page.getViewport({ scale: 2.5 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp2.width);
      canvas.height = Math.ceil(vp2.height);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp2 }).promise;
      words.push(...(await ocr(canvas, offset - vp.height, 2.5)));
    } else {
      for (const it of items) {
        const x0 = it.transform[4];
        words.push({
          s: it.str.trim(),
          x0,
          x1: x0 + (it.width || 0),
          y: -it.transform[5] + offset,
          h: it.height || Math.abs(it.transform[3]) || 10,
        });
      }
    }
  }
  if (pdf.destroy) await pdf.destroy();
  return words;
}

/* ---------- words from image (OCR in strips) ---------- */
async function imageWords(file, report, ocr) {
  const bmp = await createImageBitmap(file);
  let scale = bmp.width < 1800 ? Math.min(3, 1800 / bmp.width) : 1;
  if (bmp.height * scale > 15000) scale = 15000 / bmp.height;
  const W = Math.max(1, Math.round(bmp.width * scale));
  const H = Math.max(1, Math.round(bmp.height * scale));
  const full = document.createElement("canvas");
  full.width = W;
  full.height = H;
  const fx = full.getContext("2d", { willReadFrequently: true });
  fx.imageSmoothingQuality = "high";
  fx.drawImage(bmp, 0, 0, W, H);
  if (bmp.close) bmp.close();

  // row variance (for clean cuts) and average brightness (dark mode detection)
  const rowVar = new Float32Array(H);
  let total = 0;
  for (let y0 = 0; y0 < H; y0 += 400) {
    const h = Math.min(400, H - y0);
    const d = fx.getImageData(0, y0, W, h).data;
    for (let r = 0; r < h; r++) {
      let s = 0,
        s2 = 0;
      for (let x = 0, i = r * W * 4; x < W; x++, i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        s += g;
        s2 += g * g;
      }
      const m = s / W;
      rowVar[y0 + r] = s2 / W - m * m;
      total += m;
    }
  }
  const dark = total / H < 110;

  const STRIP = 2200;
  const cuts = [0];
  let y = 0;
  while (H - y > STRIP * 1.1) {
    const target = y + STRIP;
    let best = target,
      bv = Infinity;
    for (let r = Math.max(y + 1000, target - 150); r <= Math.min(H - 1, target + 150); r++) {
      if (rowVar[r] < bv) {
        bv = rowVar[r];
        best = r;
      }
    }
    cuts.push(best);
    y = best;
  }
  cuts.push(H);

  const words = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    const y0 = cuts[k];
    const sh = cuts[k + 1] - y0;
    report(`${file.name}: reading strip ${k + 1}/${cuts.length - 1}…`);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = sh;
    const cx = c.getContext("2d", { willReadFrequently: true });
    cx.drawImage(full, 0, y0, W, sh, 0, 0, W, sh);
    const img = cx.getImageData(0, 0, W, sh);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (dark) g = 255 - g;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    cx.putImageData(img, 0, 0);
    words.push(...(await ocr(c, y0, 1)));
    c.width = 1;
  }
  full.width = 1;
  return words;
}

/* ---------- words -> rows -> cells ---------- */
function splitCell(c) {
  const ms = [...c.s.matchAll(new RegExp(SCHED_SRC, "gi"))];
  if (!ms.length) return [c];
  const L = c.s.length;
  const w = c.x1 - c.x0;
  const segs = [];
  const push = (a, b) => {
    const t = c.s.slice(a, b).trim();
    if (t) segs.push({ s: t, x0: c.x0 + (w * a) / L, x1: c.x0 + (w * b) / L });
  };
  let pos = 0;
  for (const m of ms) {
    push(pos, m.index);
    push(m.index, m.index + m[0].length);
    pos = m.index + m[0].length;
  }
  push(pos, L);
  return segs;
}

function buildRows(words) {
  const H = median(words.map((w) => w.h).filter((h) => h > 0)) || 10;
  const sorted = [...words].sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const rows = [];
  let cur = null;
  for (const w of sorted) {
    if (cur && Math.abs(w.y - cur.y) <= 0.6 * H) {
      cur.words.push(w);
      cur.y += (w.y - cur.y) / cur.words.length;
    } else {
      cur = { y: w.y, words: [w] };
      rows.push(cur);
    }
  }
  const out = rows.map((r) => {
    const ws = [...r.words].sort((a, b) => a.x0 - b.x0);
    let cells = [];
    for (const w of ws) {
      const last = cells[cells.length - 1];
      if (last && w.x0 - last.x1 < 0.9 * H) {
        last.s += " " + w.s;
        last.x1 = Math.max(last.x1, w.x1);
      } else cells.push({ s: w.s, x0: w.x0, x1: w.x1 });
    }
    cells = cells
      .flatMap(splitCell)
      .map((c) => ({ ...c, s: c.s.replace(/\s+/g, " ").trim() }))
      .filter((c) => c.s);
    const merged = [];
    for (let i = 0; i < cells.length; i++) {
      if (DAY_ONLY.test(cells[i].s) && cells[i + 1] && TIME_ONLY.test(cells[i + 1].s)) {
        merged.push({ s: cells[i].s + " " + cells[i + 1].s, x0: cells[i].x0, x1: cells[i + 1].x1 });
        i++;
      } else merged.push(cells[i]);
    }
    return { y: r.y, cells: merged };
  });
  return { rows: out, H };
}

/* ---------- row parser (content based) ---------- */
function parseRows(rows, H, warnings) {
  const courses = [];
  const byCode = new Map();
  const headerParts = [];
  let cur = null,
    curSec = null,
    pendingTitle = false,
    lastY = null,
    sectionX = null;

  const finishSec = () => {
    if (!curSec) return;
    const sch = resolveSchedule(`${cur.code} section ${curSec.sec}`, curSec.entries, warnings);
    if (!sch) warnings.push(`${cur.code} section ${curSec.sec}: no readable schedule, skipped`);
    else if (cur.sections.some((s) => s.sec === curSec.sec)) warnings.push(`${cur.code}: duplicate section ${curSec.sec} ignored`);
    else
      cur.sections.push({
        sec: curSec.sec,
        faculty: joinFaculty(curSec.fac),
        days: sch.days,
        start: sch.start,
        end: sch.end,
        room: curSec.room,
        seats: curSec.seats,
      });
    curSec = null;
  };

  for (const r of rows) {
    const text = r.cells.map((c) => c.s).join(" ");
    const upper = text.toUpperCase();
    if (upper.includes("SECTION") && upper.includes("SCHEDULE")) continue;

    const ch = text.match(COURSE_RE);
    if (ch) {
      finishSec();
      const code = `${ch[1].toUpperCase()} ${ch[2].toUpperCase()}`;
      cur = byCode.get(code);
      if (!cur) {
        cur = { code, title: ch[4].trim(), credit: parseFloat(ch[3]), sections: [] };
        byCode.set(code, cur);
        courses.push(cur);
      }
      pendingTitle = !cur.title;
      lastY = null;
      sectionX = null;
      continue;
    }
    if (!cur) {
      headerParts.push(text);
      continue;
    }

    const schedIdx = r.cells.map((c, i) => (parseSchedToken(c.s) ? i : -1)).filter((i) => i >= 0);
    if (pendingTitle && !schedIdx.length) {
      cur.title = text;
      pendingTitle = false;
      continue;
    }

    const first = r.cells[0];
    const startsSection =
      first && SECTION.test(first.s) && schedIdx.length > 0 && (sectionX == null || Math.abs(first.x0 - sectionX) <= 2 * H);

    if (startsSection) {
      finishSec();
      pendingTitle = false;
      if (sectionX == null) sectionX = first.x0;
      const firstSched = schedIdx[0];
      const lastSched = schedIdx[schedIdx.length - 1];
      const facCells = r.cells.slice(1, firstSched).filter((c) => !parseSchedToken(c.s));
      const tail = r.cells.slice(lastSched + 1);
      let room = "",
        seats = null;
      if (tail.length >= 2 && NUM.test(tail[tail.length - 1].s)) {
        seats = parseInt(tail[tail.length - 1].s, 10);
        room = tail.slice(0, -1).map((c) => c.s).join(" ");
      } else room = tail.map((c) => c.s).join(" ");
      curSec = {
        sec: first.s,
        fac: facCells.length ? [facCells.map((c) => c.s).join(" ")] : [],
        facX: facCells.length ? facCells[0].x0 : null,
        entries: schedIdx.flatMap((i) => parseSchedToken(r.cells[i].s)),
        room,
        seats,
      };
      lastY = r.y;
      continue;
    }

    // continuation row of the current section
    if (curSec && lastY != null && r.y - lastY <= 4.5 * H) {
      let used = false;
      for (const i of schedIdx) {
        curSec.entries.push(...parseSchedToken(r.cells[i].s));
        used = true;
      }
      if (curSec.facX != null) {
        const parts = r.cells.filter(
          (c) => !parseSchedToken(c.s) && Math.abs(c.x0 - curSec.facX) <= 2 * H && !/^\d/.test(c.s)
        );
        if (parts.length) {
          curSec.fac.push(parts.map((c) => c.s).join(" "));
          used = true;
        }
      }
      if (used) lastY = r.y;
    }
  }
  finishSec();
  return { courses, header: parseHeader(headerParts.join(" ")) };
}

function mergeCourses(list) {
  const map = new Map();
  for (const c of list) {
    const ex = map.get(c.code);
    if (!ex) map.set(c.code, { ...c, sections: [...c.sections] });
    else {
      if (!ex.title && c.title) ex.title = c.title;
      for (const s of c.sections) if (!ex.sections.some((x) => x.sec === s.sec)) ex.sections.push(s);
    }
  }
  return [...map.values()];
}

/* ---------- public entry ---------- */
export async function importFiles(files, report = () => {}) {
  const list = Array.from(files);
  const warnings = [];
  const sources = [];
  const parts = []; // generic (OCR / free text) results
  const tables = []; // UIU "Course Offerings" table results
  let worker = null;
  let label = "";

  const getWorker = async () => {
    if (worker) return worker;
    report("Loading OCR engine…");
    const { createWorker } = await import("tesseract.js");
    worker = await createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") report(`${label} — reading text ${Math.round((m.progress || 0) * 100)}%`);
      },
    });
    await worker.setParameters({ tessedit_pageseg_mode: "11", preserve_interword_spaces: "1" });
    return worker;
  };

  const ocr = async (canvas, offY = 0, scale = 1) => {
    const wk = await getWorker();
    const { data } = await wk.recognize(canvas);
    return (data.words || [])
      .filter((w) => w.confidence >= 15 && w.text && w.text.trim())
      .map((w) => ({
        s: w.text.trim(),
        x0: w.bbox.x0 / scale,
        x1: w.bbox.x1 / scale,
        y: w.bbox.y0 / scale + offY,
        h: (w.bbox.y1 - w.bbox.y0) / scale,
      }));
  };

  try {
    for (const file of list) {
      label = file.name;
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isImg = /^image\//.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
      if (!isPdf && !isImg) {
        warnings.push(`Unsupported file type: ${file.name}`);
        continue;
      }
      let words;
      if (isPdf) {
        // 1) the university table (Course Offerings sheet) is read by column position, no OCR needed
        const pages = await pdfTextPages(file, report);
        const table = parseUiuTable(pages);
        if (table && table.courses.length) {
          report(`${file.name}: reading table…`);
          warnings.push(...table.warnings.map((x) => (list.length > 1 ? `${file.name}: ${x}` : x)));
          tables.push(table);
          continue;
        }
        // 2) any other PDF: read words (OCR only for pages without text)
        words = await pdfWords(file, report, ocr);
      } else {
        sources.push({ name: file.name, url: URL.createObjectURL(file) });
        words = await imageWords(file, report, ocr);
      }
      if (!words.length) {
        warnings.push(`${file.name}: no text found`);
        continue;
      }
      report(`${file.name}: analysing rows…`);
      const { rows, H } = buildRows(words);
      const w = [];
      const parsed = parseRows(rows, H, w);
      warnings.push(...w.map((x) => (list.length > 1 ? `${file.name}: ${x}` : x)));
      parts.push(parsed);
    }
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {}
    }
  }

  // gap warnings only make sense for free-text/OCR results; the university table is authoritative
  const generic = mergeCourses(parts.flatMap((p) => p.courses));
  postWarnings(generic, warnings);
  const courses = mergeCourses([...generic, ...tables.flatMap((t) => t.courses)]);

  const hdr =
    tables.find((t) => t.program || t.term) || parts.map((p) => p.header).find((h) => h.program || h.term) || { program: "", term: "" };

  let expected = { courses: null, credits: null };
  if (list.length === 1) {
    if (tables[0]) expected = tables[0].expected;
    else if (parts[0]) expected = parts[0].header.expected;
  }

  return { program: hdr.program, term: hdr.term, courses, warnings, expected, sources };
}