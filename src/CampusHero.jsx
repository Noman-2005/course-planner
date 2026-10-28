
import { useMemo } from "react";

const random = (seed) => {
  let s = seed;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
};

const FLOORS = 10;

function Tree({ x, y, scale = 1, seed = 1 }) {
  const r = random(seed);

  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-3 0 L-2 -28 L3 -28 L4 0Z" fill="#65503a" />
      <path d="M0 -16 L-13 -30 M1 -20 L14 -36" stroke="#65503a" strokeWidth="3" />
      {Array.from({ length: 10 }, (_, i) => (
        <circle
          key={i}
          cx={(r() - 0.5) * 38}
          cy={-24 - r() * 19}
          r={7 + r() * 7}
          fill={["#246c32", "#31833a", "#439342", "#65a746"][i % 4]}
        />
      ))}
    </g>
  );
}

function CampusBuilding() {
  const towers = [
    { x: 190, w: 48, top: 98, brick: false },
    { x: 240, w: 38, top: 81, brick: true },
    { x: 278, w: 52, top: 67, brick: false },
    { x: 330, w: 40, top: 48, brick: true, sign: true },
    { x: 370, w: 44, top: 67, brick: false },
    { x: 414, w: 42, top: 78, brick: true },
    { x: 456, w: 54, top: 64, brick: false },
    { x: 510, w: 37, top: 76, brick: true },
    { x: 547, w: 42, top: 91, brick: false },
    { x: 589, w: 34, top: 104, brick: true },
    { x: 623, w: 43, top: 113, brick: false },
  ];

  return (
    <g>
      {/* Rear campus wings */}
      {towers.map((t, i) => (
        <g key={i}>
          <rect
            x={t.x}
            y={t.top}
            width={t.w}
            height={235 - t.top}
            fill={t.brick ? "#a94f3b" : "#d4c6ad"}
            stroke="#f2e4cf"
            strokeWidth="1.4"
          />

          <rect
            x={t.x + (t.brick ? 5 : 3)}
            y={t.top + 5}
            width={t.w - (t.brick ? 10 : 6)}
            height={230 - t.top}
            fill={t.brick ? "#a94f3b" : "#d7c9b5"}
          />

          {Array.from({ length: Math.ceil((235 - t.top) / 15) }, (_, f) => (
            <g key={f}>
              {!t.brick && (
                <rect
                  x={t.x + 4}
                  y={t.top + 5 + f * 15}
                  width={t.w - 8}
                  height="8"
                  fill="#24618a"
                  stroke="#b8d2dd"
                  strokeWidth="1"
                />
              )}

              {t.brick && (
                <rect
                  x={t.x + 4}
                  y={t.top + 5 + f * 15}
                  width={t.w - 8}
                  height="8"
                  fill="#d9c6aa"
                  opacity="0.85"
                />
              )}

              <path
                d={`M${t.x} ${t.top + 15 + f * 15} h${t.w}`}
                stroke="#e6d9c7"
                strokeWidth="1.5"
              />
            </g>
          ))}

          {t.sign && (
            <g>
              <rect
                x={t.x + 3}
                y={t.top + 6}
                width={t.w - 6}
                height="39"
                fill="#30313b"
                stroke="#c5a68a"
                strokeWidth="2"
              />
              <text
                x={t.x + t.w / 2}
                y={t.top + 34}
                fill="#ff6a00"
                textAnchor="middle"
                fontSize="23"
                fontWeight="800"
                letterSpacing="1"
                className="campus-sign"
              >
                UIU
              </text>
            </g>
          )}

          <rect
            x={t.x}
            y={t.top}
            width={t.w}
            height="4"
            fill="#eee1cf"
          />
        </g>
      ))}

      {/* Entrance and front structure */}
      <rect x="245" y="196" width="300" height="39" fill="#5c5146" />
      <rect x="252" y="201" width="286" height="5" fill="#d6c4aa" />
      {Array.from({ length: 13 }, (_, i) => (
        <rect
          key={i}
          x={260 + i * 21}
          y="211"
          width="14"
          height="24"
          fill="#8ba9b4"
          stroke="#d8d3c8"
          strokeWidth="1"
        />
      ))}
    </g>
  );
}

export default function CampusHero() {
  const stars = useMemo(() => {
    const r = random(31);
    return Array.from({ length: 65 }, (_, i) => ({
      x: r() * 1000,
      y: r() * 190,
      radius: 0.5 + r() * 1.3,
      delay: `${r() * 5}s`,
      key: i,
    }));
  }, []);

  const birds = [
    { x: 300, y: 45 },
    { x: 327, y: 58 },
    { x: 349, y: 39 },
  ];

  const startPlanning = () => {
    document.querySelector(".layout")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <section className="hero" aria-label="UIU Course Planner campus">
      <svg
        className="hero-art"
        viewBox="0 0 1000 310"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="Illustrated UIU campus with trees and a glass-fronted academic building"
      >
        <defs>
          <linearGradient id="campusSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#83c4f1" />
            <stop offset="65%" stopColor="#f5dfc4" />
            <stop offset="100%" stopColor="#f7cba3" />
          </linearGradient>

          <linearGradient id="campusNight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#08132c" />
            <stop offset="65%" stopColor="#172849" />
            <stop offset="100%" stopColor="#473448" />
          </linearGradient>

          <linearGradient id="campusGlass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#438ab9" />
            <stop offset="55%" stopColor="#a6d2e7" />
            <stop offset="100%" stopColor="#23618a" />
          </linearGradient>
        </defs>

        <g className="campus-day">
          <rect width="1000" height="310" fill="url(#campusSky)" />

          <circle cx="820" cy="48" r="27" fill="#ffe1a1" opacity="0.65" />

          {[90, 190, 690, 870].map((x, i) => (
            <g key={i} className="campus-cloud" style={{ animationDelay: `${i * -8}s` }}>
              <ellipse cx={x} cy={53 + (i % 2) * 28} rx="48" ry="13" fill="#fff6eb" />
              <circle cx={x - 17} cy={44 + (i % 2) * 28} r="17" fill="#fff6eb" />
              <circle cx={x + 7} cy={39 + (i % 2) * 28} r="23" fill="#fff6eb" />
              <circle cx={x + 28} cy={48 + (i % 2) * 28} r="14" fill="#fff6eb" />
            </g>
          ))}

          {birds.map((b, i) => (
            <path
              key={i}
              className="campus-bird"
              style={{ animationDelay: `${i * -3}s` }}
              d={`M${b.x} ${b.y} q7 -7 14 0 q7 -7 14 0`}
              fill="none"
              stroke="#394d5c"
              strokeWidth="2"
            />
          ))}
        </g>

        <g className="campus-night">
          <rect width="1000" height="310" fill="url(#campusNight)" />

          {stars.map((s) => (
            <circle
              key={s.key}
              className="campus-star"
              cx={s.x}
              cy={s.y}
              r={s.radius}
              fill="#fff"
              style={{ animationDelay: s.delay }}
            />
          ))}

          <circle cx="833" cy="48" r="20" fill="#f3eddb" />
          <circle cx="824" cy="41" r="4" fill="#d1c7b0" />
          <circle cx="840" cy="55" r="3" fill="#d1c7b0" />

          <path className="campus-shooting-star" d="M750 38 l-42 20" />
          <path className="campus-shooting-star second" d="M520 23 l-36 18" />
        </g>

        <rect x="0" y="230" width="1000" height="80" fill="#6e9d50" className="campus-ground" />

        <CampusBuilding />

        {/* Night-time illuminated windows */}
        <g className="campus-night campus-windows">
          {Array.from({ length: 45 }, (_, i) => (
            <rect
              key={i}
              x={205 + (i % 9) * 48}
              y={116 + Math.floor(i / 9) * 21}
              width="27"
              height="9"
              fill="#ffc66d"
              opacity={0.55 + (i % 3) * 0.15}
            />
          ))}
        </g>

        {/* Campus lawn and foreground trees */}
        <rect x="0" y="269" width="1000" height="41" fill="#315c30" />
        <path d="M0 278 Q250 258 500 278 T1000 274" fill="none" stroke="#b9a88b" strokeWidth="4" />

        {Array.from({ length: 18 }, (_, i) => (
          <Tree
            key={i}
            x={i * 61 - 8}
            y={281 + (i % 3) * 6}
            scale={0.65 + (i % 4) * 0.13}
            seed={i + 7}
          />
        ))}
      </svg>

      <div className="hero-copy">
        <p className="hero-eyebrow">YOUR UIU EXPERIENCE STARTS HERE</p>
        <h2>
          Plan Your
          <span>Academic Journey</span>
        </h2>
        <p className="hero-description">
          Explore courses, build your ideal schedule,
          <br className="hero-break" /> and make the most of your UIU experience.
        </p>
        <button className="hero-cta" onClick={startPlanning}>
          Get Started <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}