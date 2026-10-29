import { useMemo } from "react";

import "./CampusHero.css";

import lightImg from "./assets/uiu-light.jpg";

import nightImg from "./assets/uiu-night.jpg";

/*
 * UIU campus hero.
 *
 * The two pictures (light / dark) are used as-is; everything that moves is drawn on top in SVG:
 * - day   : drifting clouds, flying birds
 * - night : twinkling stars, meteors, flickering UIU neon, windows turning on/off, pulsing street lamps
 *
 * All coordinates are in the picture's own space (1376 x 768).
 */

const W = 1376;

const H = 768;

// Building windows found in the night picture: [x, y, w, h]

const LIT = [
  [941, 244, 39, 17],
  [1253, 244, 103, 7],
  [869, 252, 38, 14],
  [1105, 262, 14, 10],
  [1020, 273, 15, 15],
  [763, 296, 47, 28],
  [1290, 299, 67, 9],
  [942, 302, 30, 16],
  [667, 306, 28, 22],
  [716, 309, 19, 11],
  [1095, 313, 25, 17],
  [985, 325, 43, 13],
  [1249, 333, 25, 23],
  [762, 337, 47, 10],
  [1333, 341, 39, 14],
  [1261, 371, 34, 22],
  [1235, 372, 27, 11],
  [598, 376, 16, 7],
  [1235, 403, 26, 9],
  [871, 405, 37, 27],
  [1001, 411, 27, 11],
  [1296, 411, 28, 12],
  [646, 419, 47, 20],
  [703, 422, 32, 18],
  [1318, 438, 44, 9],
  [823, 440, 27, 9],
  [956, 450, 28, 18],
  [1285, 474, 37, 30],
  [1340, 474, 23, 7],
  [847, 475, 58, 7],
];

const DARK = [
  [1018, 245, 42, 14],
  [1092, 249, 20, 17],
  [1128, 264, 58, 18],
  [1072, 286, 24, 15],
  [1233, 292, 52, 23],
  [1000, 298, 59, 18],
  [1358, 299, 18, 18],
  [593, 303, 21, 17],
  [812, 307, 94, 15],
  [1174, 326, 14, 18],
  [1277, 326, 99, 28],
  [844, 337, 62, 19],
  [653, 340, 38, 17],
  [811, 340, 25, 8],
  [985, 352, 76, 18],
  [709, 368, 15, 12],
  [650, 374, 34, 28],
  [1151, 374, 37, 20],
  [943, 384, 14, 11],
  [1024, 384, 36, 11],
  [1326, 401, 50, 28],
  [784, 419, 24, 14],
  [871, 451, 34, 15],
];

// Exact sky silhouette (traced from the picture):
// anything clipped to it passes BEHIND buildings and trees

const SKY_PATH =
  "M-300 -300 L-300 190 L15 199 L30 196 L39 205 L43 216 L47 220 L47 225 L43 229 L45 233 L49 229 L59 228 L64 223 L70 222 L77 227 L87 227 L103 244 L100 254 L104 265 L96 273 L101 277 L110 277 L126 294 L125 297 L127 299 L132 295 L138 301 L152 329 L162 380 L172 396 L408 396 L410 394 L410 376 L416 370 L578 370 L580 368 L580 286 L586 280 L635 281 L637 279 L637 263 L643 257 L653 263 L687 263 L701 249 L705 251 L748 250 L750 248 L752 142 L758 136 L788 136 L796 127 L816 127 L824 136 L856 136 L864 127 L878 127 L888 136 L934 135 L941 144 L943 176 L945 178 L1061 177 L1067 183 L1065 188 L1068 191 L1069 217 L1071 219 L1122 218 L1128 224 L1127 229 L1133 235 L1185 234 L1187 232 L1191 207 L1197 201 L1220 201 L1227 195 L1247 195 L1251 192 L1268 191 L1274 195 L1363 195 L1700 191 L1700 -300 L1700 -300 L-300 -300Z";

// Meteors always fall the same way: from upper right toward lower left.

const METEOR_ANGLE = 158; // degrees, same for every meteor

const METEOR_SPEED = 550; // changed from 850 to 550

const METEORS = [
  { x: 1560, y: -40, len: 160, t: 15, d: 2 },
  { x: 1100, y: -25, len: 150, t: 22, d: 7 },
  { x: 1450, y: -10, len: 180, t: 29, d: 14 },
  { x: 900, y: -30, len: 140, t: 36, d: 21 },
].map((m) => {
  const dist = Math.round(
    (m.x + m.len + 40) /
      Math.abs(Math.cos((METEOR_ANGLE * Math.PI) / 180))
  );

  const p0 = Math.max(
    0,
    100 - (dist / METEOR_SPEED / m.t) * 100
  );

  return { ...m, dist, p0 };
});

const METEOR_CSS = METEORS.map(
  (m, i) =>
    `@keyframes uh-m${i}{0%,${m.p0.toFixed(2)}%{opacity:0;transform:translateX(0)}${(
      m.p0 + 0.2
    ).toFixed(2)}%{opacity:1}100%{opacity:1;transform:translateX(${m.dist}px)}}`
).join("");

const LAMPS = [
  { x: 396, y: 488, r: 46 },
  { x: 601, y: 526, r: 24 },
  { x: 913, y: 526, r: 24 },
  { x: 55, y: 549, r: 24 },
  { x: 1363, y: 526, r: 24 },
];

const rng = (seed) => {
  let s = seed;

  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
};

// Stars are placed with a rough test;
// exact clipping is done by the sky clipPath.

function inSky(x, y) {
  if (x < 600 && y > 285) return false;

  return y < 380;
}

function Cloud({ s = 1, y = 0, t = 110, d = 0, o = 0.92 }) {
  return (
    <g transform={`translate(0 ${y}) scale(${s})`}>
      <g
        className="uh-cloud"
        style={{ "--t": t + "s", "--d": d + "s" }}
      >
        <g fill="url(#uh-cloudfill)" opacity={o}>
          <ellipse cx="0" cy="12" rx="92" ry="15" />

          <circle cx="-34" cy="2" r="22" />

          <circle cx="-4" cy="-10" r="30" />

          <circle cx="30" cy="-2" r="24" />

          <circle cx="56" cy="6" r="16" />
        </g>
      </g>
    </g>
  );
}

export default function CampusHero() {
  const D = useMemo(() => {
    const r = rng(23);

    const stars = [];

    while (stars.length < 120) {
      const x = r() * W;

      const y = r() * 420;

      if (inSky(x, y)) {
        stars.push({
          x,
          y,
          s: 0.6 + r() * 1.5,
          t: 2 + r() * 4,
          d: -r() * 6,
        });
      }
    }

    const winOff = [];

    LIT.forEach((w, i) => {
      if (r() < 0.65) {
        winOff.push({
          w,
          t: 7 + r() * 11,
          d: -r() * 16,
          k: "off" + i,
        });
      }
    });

    const winOn = [];

    DARK.forEach((w, i) => {
      if (r() < 0.6) {
        winOn.push({
          w,
          t: 8 + r() * 12,
          d: -r() * 18,
          k: "on" + i,
        });
      }
    });

    const birds = [
      { y: 96, s: 0.8, t: 62, d: -10 },
      { y: 128, s: 0.6, t: 78, d: -45 },
      { y: 62, s: 1.1, t: 52, d: -30 },
      { y: 232, s: 0.7, t: 70, d: -55 },
      { y: 160, s: 0.5, t: 90, d: -20 },
    ];

    return { stars, winOff, winOn, birds };
  }, []);

  return (
    <div
      className="uh"
      role="img"
      aria-label="United International University campus, animated"
    >
      <style>{METEOR_CSS}</style>

      <img
        className="uh-img"
        src={lightImg}
        alt=""
        draggable="false"
      />

      {/* Permanent patch: hides birds baked into the light picture.
          It stays between the light and night pictures. */}

      <svg
        className="uh-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient
            id="uh-skypatch"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="158"
            x2="0"
            y2="236"
          >
            <stop offset="0.000" stopColor="#b8ddf8" />

            <stop offset="0.077" stopColor="#b8ddf8" />

            <stop offset="0.154" stopColor="#b9def9" />

            <stop offset="0.231" stopColor="#bbdff9" />

            <stop offset="0.308" stopColor="#bbdff9" />

            <stop offset="0.385" stopColor="#bce0f8" />

            <stop offset="0.462" stopColor="#bee0f9" />

            <stop offset="0.538" stopColor="#c1e1fa" />

            <stop offset="0.615" stopColor="#c2e2f9" />

            <stop offset="0.692" stopColor="#c3e3f8" />

            <stop offset="0.769" stopColor="#c4e4f8" />

            <stop offset="0.846" stopColor="#c5e4f8" />

            <stop offset="0.923" stopColor="#c6e5f9" />

            <stop offset="1.000" stopColor="#c9e6f8" />
          </linearGradient>
        </defs>

        <rect
          x="380"
          y="158"
          width="180"
          height="78"
          fill="url(#uh-skypatch)"
        />
      </svg>

      <img
        className="uh-img uh-img-night"
        src={nightImg}
        alt=""
        draggable="false"
      />

      {/* Normal-blend layer */}

      <svg
        className="uh-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient
            id="uh-tail"
            x1="1"
            y1="0"
            x2="0"
            y2="0"
          >
            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />

            <stop
              offset="0.35"
              stopColor="#cfe0ff"
              stopOpacity="0.45"
            />

            <stop
              offset="1"
              stopColor="#9db8ff"
              stopOpacity="0"
            />
          </linearGradient>

          <radialGradient id="uh-head">
            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />

            <stop
              offset="0.4"
              stopColor="#dbe7ff"
              stopOpacity="0.4"
            />

            <stop
              offset="1"
              stopColor="#bcd0ff"
              stopOpacity="0"
            />
          </radialGradient>

          <linearGradient
            id="uh-cloudfill"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0" stopColor="#ffffff" />

            <stop offset="1" stopColor="#dbe9f6" />
          </linearGradient>

          <filter
            id="uh-soft"
            x="-10%"
            y="-30%"
            width="120%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
                    <clipPath id="uh-sky">
            <path d={SKY_PATH} />
          </clipPath>
        </defs>

        {/* ---------- DAY ---------- */}

        <g className="uh-d">
          {/* Clouds + birds: visible only against the sky,
              hidden behind buildings and trees. */}

          <g clipPath="url(#uh-sky)">
            <Cloud s={1.35} y={46} t={120} d={-30} />

            <Cloud s={0.9} y={98} t={95} d={-70} o={0.85} />

            <Cloud s={1.1} y={28} t={150} d={-110} o={0.8} />

            <Cloud s={0.7} y={128} t={85} d={-15} o={0.8} />

            {D.birds.map((b, i) => (
              <g
                key={i}
                transform={`translate(0 ${b.y}) scale(${b.s})`}
              >
                <g
                  className="uh-bird"
                  style={{ "--t": b.t + "s", "--d": b.d + "s" }}
                >
                  <path
                    className="uh-wing"
                    d="M0 0 q6 -7 12 0 q6 -7 12 0"
                    fill="none"
                    stroke="#1f2833"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </g>
              </g>
            ))}
          </g>
        </g>

        {/* ---------- NIGHT ---------- */}

        <g className="uh-n">
          <g clipPath="url(#uh-sky)">
            {D.stars.map((s, i) => (
              <circle
                key={i}
                className="uh-star"
                cx={s.x}
                cy={s.y}
                r={s.s}
                fill="#fff"
                style={{ "--t": s.t + "s", "--d": s.d + "s" }}
              />
            ))}

            {METEORS.map((m, i) => (
              <g
                key={i}
                transform={`translate(${m.x} ${m.y}) rotate(${METEOR_ANGLE})`}
              >
                <g
                  className="uh-meteor"
                  style={{
                    animation: `uh-m${i} ${m.t}s linear ${m.d}s infinite`,
                  }}
                >
                  <path
                    d={`M0 -1.7 L0 1.7 L${-m.len} 0 Z`}
                    fill="url(#uh-tail)"
                  />

                  <circle r="6" fill="url(#uh-head)" />

                  <circle r="1.7" fill="#fff" />
                </g>
              </g>
            ))}
          </g>

          {/* Windows switching off */}

          <g filter="url(#uh-soft)">
            {D.winOff.map(({ w, t, d, k }) => (
              <rect
                key={k}
                className="uh-off"
                x={w[0]}
                y={w[1]}
                width={w[2]}
                height={w[3]}
                rx="1.5"
                style={{ "--t": t + "s", "--d": d + "s" }}
              />
            ))}
          </g>

          {/* UIU neon dims for a moment */}

          <g filter="url(#uh-soft)">
            <rect
              className="uh-neon-off"
              x="775"
              y="158"
              width="122"
              height="64"
              rx="8"
            />
          </g>
        </g>
      </svg>

      {/* Light-adding layer: glows, lit windows, lamps */}

      <svg
        className="uh-svg uh-fx"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="uh-neon">
            <stop
              offset="0"
              stopColor="#ff7a1a"
              stopOpacity="0.75"
            />

            <stop
              offset="0.55"
              stopColor="#ff5a00"
              stopOpacity="0.28"
            />

            <stop
              offset="1"
              stopColor="#ff5a00"
              stopOpacity="0"
            />
          </radialGradient>

          <radialGradient id="uh-lamp">
            <stop
              offset="0"
              stopColor="#ffd98a"
              stopOpacity="0.85"
            />

            <stop
              offset="0.45"
              stopColor="#ffc25a"
              stopOpacity="0.3"
            />

            <stop
              offset="1"
              stopColor="#ffb040"
              stopOpacity="0"
            />
          </radialGradient>

          <filter
            id="uh-soft3"
            x="-10%"
            y="-30%"
            width="120%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>

        <g className="uh-n">
          <ellipse
            className="uh-neon-glow"
            cx="835"
            cy="190"
            rx="135"
            ry="78"
            fill="url(#uh-neon)"
          />

          <g filter="url(#uh-soft3)">
            {D.winOn.map(({ w, t, d, k }) => (
              <rect
                key={k}
                className="uh-on"
                x={w[0]}
                y={w[1]}
                width={w[2]}
                height={w[3]}
                rx="1.5"
                style={{ "--t": t + "s", "--d": d + "s" }}
              />
            ))}
          </g>

          {LAMPS.map((l, i) => (
            <circle
              key={i}
              className="uh-lamp"
              cx={l.x}
              cy={l.y}
              r={l.r}
              fill="url(#uh-lamp)"
              style={{ "--d": -i * 1.3 + "s" }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}