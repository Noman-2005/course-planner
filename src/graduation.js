export const TOTAL_CREDITS = 141;
export const RUNNING = "RUNNING";

export const GRADES = [
  { l: "A", gp: 4.0, m: "90–100" },
  { l: "A-", gp: 3.67, m: "86–89" },
  { l: "B+", gp: 3.33, m: "82–85" },
  { l: "B", gp: 3.0, m: "78–81" },
  { l: "B-", gp: 2.67, m: "74–77" },
  { l: "C+", gp: 2.33, m: "70–73" },
  { l: "C", gp: 2.0, m: "66–69" },
  { l: "C-", gp: 1.67, m: "62–65" },
  { l: "D+", gp: 1.33, m: "58–61" },
  { l: "D", gp: 1.0, m: "55–57" },
  { l: "F", gp: 0, m: "0–54" },
];

// trimester|code|title|credit|prerequisites
const CORE = `
1|ENG 1011|English I|3|
1|BDS 1201|History of the Emergence of Bangladesh|2|
1|CSE 1110|Introduction to Computer Systems|1|
1|MATH 1151|Fundamental Calculus|3|
2|ENG 1013|English II|3|ENG 1011
2|CSE 1111|Structured Programming Language|3|CSE 1110
2|CSE 1112|Structured Programming Language Laboratory|1|CSE 1110
2|CSE 2213|Discrete Mathematics|3|
3|MATH 2183|Calculus and Linear Algebra|3|MATH 1151
3|PHY 2105|Physics|3|
3|PHY 2106|Physics Laboratory|1|
3|CSE 2215|Data Structure and Algorithms I|3|CSE 1111
3|CSE 2216|Data Structure and Algorithms I Laboratory|1|CSE 1112
4|MATH 2201|Coordinate Geometry and Vector Analysis|3|MATH 1151
4|CSE 1325|Digital Logic Design|3|
4|CSE 1326|Digital Logic Design Laboratory|1|
4|CSE 1115|Object Oriented Programming|3|CSE 2215
4|CSE 1116|Object Oriented Programming Laboratory|1|CSE 2216
5|MATH 2205|Probability and Statistics|3|MATH 1151
5|SOC 2101|Society, Environment and Engineering Ethics|3|
5|CSE 2217|Data Structure and Algorithms II|3|CSE 2215
5|CSE 2218|Data Structure and Algorithms II Laboratory|1|CSE 2216
5|EEE 2113|Electrical Circuits|3|
6|CSE 3521|Database Management Systems|3|CSE 2215
6|CSE 3522|Database Management Systems Laboratory|1|CSE 2216
6|CSE 4165|Web Programming|3|CSE 1115,CSE 1116
6|EEE 2123|Electronics|3|EEE 2113
6|EEE 2124|Electronics Laboratory|1|
7|CSE 3313|Computer Architecture|3|CSE 1325
7|CSE 2118|Advanced Object Oriented Programming Laboratory|1|CSE 1116
7|BIO 3105|Biology for Engineers|3|
7|CSE 3411|System Analysis and Design|3|CSE 3521
7|CSE 3412|System Analysis and Design Laboratory|1|CSE 3522
8|CSE 4325|Microprocessors and Microcontrollers|3|CSE 3313
8|CSE 4326|Microprocessors and Microcontrollers Laboratory|1|EEE 2124
8|CSE 3421|Software Engineering|3|CSE 3411
8|CSE 3422|Software Engineering Laboratory|1|CSE 3412
8|CSE 3811|Artificial Intelligence|3|MATH 2205,CSE 2217
8|CSE 3812|Artificial Intelligence Laboratory|1|MATH 2205,CSE 2218
9|CSE 2233|Theory of Computation|3|
9|PMG 4101|Project Management|3|CSE 3411
9|CSE 3711|Computer Networks|3|CSE 2217
9|CSE 3712|Computer Networks Laboratory|1|
9|CSE 4889|Machine Learning|3|CSE 3811,CSE 3812,MATH 2183
10|CSE 4000A|Final Year Design Project – I|2|
10|CSE 4509|Operating Systems|3|CSE 2217,CSE 3313
10|CSE 4510|Operating Systems Laboratory|1|CSE 2218
11|CSE 4000B|Final Year Design Project – II|2|CSE 4000A
11|CSE 4531|Computer Security|3|CSE 3711,CSE 4509
12|CSE 4000C|Final Year Design Project – III|2|CSE 4000A,CSE 4000B
12|EEE 4261|Green Computing|3|
`;

// General Education optional (any 3)
const GED = `
ECO 4101|Economics
SOC 4101|Introduction to Sociology
ACT 2111|Financial and Managerial Accounting
IPE 3401|Industrial and Operational Management
GED 4003|Technology Entrepreneurship
PSY 2101|Psychology
BDS 2201|Bangladesh Studies
BAN 2501|Bangla
SOC 4301|Introduction to Anthropology
FLN 1101|Introduction to a Foreign Language
SWL 4101|Software and Law
BHV 2101|Introduction to Behavioral Science
URC 1101|Life Skill for Success
GED 1005|AI Literacy and Prompt Engineering
`;

// Electives (any 5), unique across all 5 groups
const ELECTIVE = `
CSE 4121|Security Monitoring
CSE 4759|Wireless and Cellular Communication
CSE 4123|Software and Application Security
CSE 4125|Ethical Hacking and Network Defense
CSE 4127|Cloud Security
CSE 4129|Digital Forensics
CSE 4131|Internet of Things (IoT) Security
CSE 3715|Data Communication
CSE 4199|Special Topics (Network & Cyber Security)
CSE 4793|Advanced Network Services and Management
CSE 4783|Cryptography
CSE 4777|Network Security
CSE 4943|Web Application Security
CSE 4949|IT Audit: Concepts and Practice
CSE 3542|Industry Internship
CSE 4435|Software Architecture
CSE 4181|Mobile Application Development
CSE 4495|Software Testing and Quality Assurance
CSE 4587|Cloud Computing
CSE 4567|Advanced Database Management Systems
CSE 4413|Virtual Reality/Augmented Reality System Design
CSE 4611|Compiler Design
CSE 4945|UI: Concepts and Design
CSE 4871|Data Analytics
CSE 4299|Special Topics (Software Engineering)
CSE 4133|Business Intelligence
CSE 4451|Human Computer Interaction
CSE 4485|Game Design and Development
CSE 4519|Distributed Systems
CSE 4523|Simulation and Modeling
CSE 4621|Computer Graphics
CSE 4601|Mathematical Analysis for Computer Science
CSE 4633|Basic Graph Theory
CSE 4655|Algorithm Engineering
CSE 4547|Multimedia Systems Design
CSE 4613|Computational Geometry
CSE 4379|Real-time Embedded Systems
CSE 4337|Robotics
CSE 4399|Special Topics (Embedded Systems & Robotics)
CSE 4327|VLSI Design
CSE 4853|Internet of Things (IoT)
CSE 4819|AI for Autonomous Systems
CSE 4813|Deep Learning
CSE 4815|Large Language Model and Generative AI
CSE 4329|Digital System Design
CSE 4397|Interfacing
CSE 4891|Data Mining
CSE 4823|Data Driven Decision Making
CSE 4817|Big Data Analytics
CSE 4821|Digital Marketing
CSE 4941|Enterprise Systems: Concepts and Practice
CSE 4765|Electronic Commerce
CSE 4499|Special Topics (Business System Engineering)
CSE 4811|Natural Language Processing
CSE 4893|Introduction to Bioinformatics
CSE 4883|Digital Image Processing
CSE 4825|Speech Processing and Recognition
CSE 4599|Special Topics (AI and Data Science)
`;

const lines = (t) => t.trim().split("\n");
const simple = (t, type) =>
  lines(t).map((l) => {
    const [code, title] = l.split("|");
    return { code, title, credit: 3, tri: 0, type, pre: [] };
  });

export const COURSES = [
  ...lines(CORE).map((l) => {
    const [tri, code, title, cr, pre] = l.split("|");
    return { code, title, credit: +cr, tri: +tri, type: "core", pre: pre ? pre.split(",") : [] };
  }),
  ...simple(GED, "ged"),
  ...simple(ELECTIVE, "elective"),
];
export const BY = Object.fromEntries(COURSES.map((c) => [c.code, c]));

// Fall 2026 exam template (BSCSE only). "*" = Only Final Exam.
// day|slot|codes   (slot 1 = T1, 2 = T2, 3 = T3)
const EXAM = `
1|1|CSE 4509,GED 1005,ENG 1011
1|2|ENG 1013,CSE 4945*
1|3|MATH 2183,CSE 3313,SOC 2101,CSE 4889,CSE 4813,CSE 4125
2|1|CSE 4621,CSE 3521
2|2|CSE 4325,MATH 1151
2|3|ACT 2111,MATH 2205
3|1|CSE 3811,CSE 4451*
3|2|CSE 2213,PMG 4101,TEC 2499*,GED 4003*
3|3|CSE 1325,BIO 3105,CSE 4777
4|1|CSE 4611,CSE 4883,CSE 4327,CSE 4811
4|2|CSE 1111,CSE 2215,CSE 4435
4|3|CSE 3711,CSE 4893*
5|1|MATH 2201,CSE 3411,EEE 4261*
5|2|CSE 2217
5|3|CSE 3421,CSE 4587*,CSE 4817
6|1|BDS 1201,ECO 4101
6|2|CSE 1115
6|3|EEE 2113,EEE 2123,CSE 4531*,CSE 4181*,CSE 4133
7|1|CSE 4891,CSE 4165
7|2|CSE 2233,CSE 4399
7|3|PHY 2105,CSE 4495*
`;
const SLOT = {};
lines(EXAM).forEach((l) => {
  const [day, slot, codes] = l.split("|");
  codes.split(",").forEach((c) => {
    const fo = c.endsWith("*");
    SLOT[fo ? c.slice(0, -1) : c] = { day: +day, slot: +slot, fo };
  });
});

const TIMES = ["9:00–11:00 AM", "11:30 AM–1:30 PM", "2:00–4:00 PM"];
export const slotOf = (code) => SLOT[code];
export const slotLabel = (day, slot) => `Day ${day} · T${slot} (${TIMES[slot - 1]})`;

// rec = { "CSE 1111": "A-", "CSE 2215": "RUNNING", ... }
export function calcCGPA(rec) {
  let pts = 0, graded = 0, earned = 0, running = 0;
  for (const [code, g] of Object.entries(rec)) {
    const c = BY[code];
    if (!c) continue;
    if (g === RUNNING) {
      running += c.credit;
      continue;
    }
    const p = GRADES.find((x) => x.l === g)?.gp;
    if (p == null) continue;
    pts += c.credit * p;
    graded += c.credit;
    if (g !== "F") earned += c.credit;
  }
  return { cgpa: graded ? pts / graded : 0, graded, earned, running };
}

const LIMIT = { ged: 3, elective: 5 };

// Courses whose prerequisites are all done (running counts as done for next trimester)
export function eligible(rec, includeRunning = true) {
  const ok = (g) => g && g !== "F" && (includeRunning || g !== RUNNING);
  const done = new Set(Object.keys(rec).filter((c) => ok(rec[c])));
  const used = { ged: 0, elective: 0 };
  done.forEach((c) => {
    const t = BY[c]?.type;
    if (t in used) used[t]++;
  });
  return COURSES.filter(
    (c) =>
      !done.has(c.code) &&
      !(c.type in used && used[c.type] >= LIMIT[c.type]) &&
      c.pre.every((p) => done.has(p))
  );
}

// Eligible AND sensible for the student's current stage
export function pool(rec) {
  const taken = (c) => rec[c.code] && rec[c.code] !== "F";
  const base = Math.min(12, ...COURSES.filter((c) => c.type === "core" && !taken(c)).map((c) => c.tri));
  return eligible(rec)
    .filter((c) => (c.type === "core" ? c.tri <= base + 2 : c.type === "ged" || base >= 8))
    .sort((a, b) => (a.tri || 99) - (b.tri || 99));
}

export function conflicts(codes) {
  const out = [];
  codes.forEach((a, i) =>
    codes.slice(i + 1).forEach((b) => {
      const x = SLOT[a], y = SLOT[b];
      if (x && y && x.day === y.day && x.slot === y.slot)
        out.push({ a, b, day: x.day, slot: x.slot, mid: !x.fo && !y.fo });
    })
  );
  return out;
}

// Greedy: follow the official trimester order, skip exam clashes, respect the credit cap
export function suggest(rec, maxCredit = 15, allow = () => true) {
  const picked = [];
  let cr = 0;
  for (const c of pool(rec)) {
    if (!allow(c)) continue;
    if (cr + c.credit > maxCredit) continue;
    if (conflicts([...picked, c.code]).length) continue;
    picked.push(c.code);
    cr += c.credit;
  }
  return picked;
}