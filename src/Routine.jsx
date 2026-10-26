import { DAYS, toMin, hourLabel, layoutDay } from "./utils.js";

const PPH = 88; // Pixels per hour

// Convert time to a readable format, e.g. 8:30 AM
function short(t) {
  const m = toMin(t);

  let h = Math.floor(m / 60);
  const mm = m % 60;

  const ap = h >= 12 ? "PM" : "AM";

  h = h % 12 || 12;

  return mm
    ? `${h}:${String(mm).padStart(2, "0")} ${ap}`
    : `${h} ${ap}`;
}

export default function Routine({
  items,
  conflictIds,
  title,
  onSelect,
}) {
  const today = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ][new Date().getDay()];

  // Determine routine start and end times
  const startTimes = items.map((i) => toMin(i.start));
  const endTimes = items.map((i) => toMin(i.end));

  const from =
    Math.floor(Math.min(480, ...startTimes) / 60) * 60;

  const to =
    Math.ceil(Math.max(1020, ...endTimes) / 60) * 60;

  // Timeline height
  const height = ((to - from) * PPH) / 60;

  // Convert time to vertical position
  const y = (min) => ((min - from) * PPH) / 60;

  const credits = items.reduce(
    (sum, item) => sum + (Number(item.credit) || 0),
    0
  );

  // Unique course legend
  const legend = [];

  items.forEach((item) => {
    if (!legend.some((entry) => entry.code === item.code)) {
      legend.push(item);
    }
  });

  // Half-hour grid lines
  const lines = [];

  for (let m = from + 30; m <= to; m += 30) {
    lines.push(m);
  }

  // Hour labels
  const hours = [];

  for (let m = from + 60; m <= to; m += 60) {
    hours.push(m);
  }

  const select = (item) => {
    if (onSelect) {
      onSelect(item);
    }
  };

  return (
    <div className="capture">
      <div className="cap-head">
        <h2>{title || "My Semester Routine"}</h2>

        <span>
          {items.length}{" "}
          {items.length === 1 ? "course" : "courses"}{" "}
          · {credits} credits
        </span>
      </div>

      {legend.length > 0 && (
        <div className="rt-legend">
          <span className="rt-legend-l">Courses</span>

          {legend.map((course) => (
            <span
              className="rt-pill"
              key={course.code}
              style={{ "--h": course.hue }}
            >
              <i />
              {course.code}
            </span>
          ))}
        </div>
      )}

      <div
        className="rt-grid"
        style={{
          gridTemplateColumns: `56px repeat(${DAYS.length}, minmax(0, 1fr))`,
        }}
      >
        <div className="rt-corner" />

        {DAYS.map((day) => (
          <div
            className={
              "rt-dayhead" + (day === today ? " today" : "")
            }
            key={day}
          >
            {day}
          </div>
        ))}

        {/* Time labels */}
        <div className="rt-times" style={{ height }}>
          {hours.map((minute) => (
            <span
              key={minute}
              style={{ top: y(minute) }}
            >
              {hourLabel(minute)}
            </span>
          ))}
        </div>

        {/* Daily routine columns */}
        {DAYS.map((day) => (
          <div
            className="rt-col"
            style={{ height }}
            key={day}
          >
            {/* Timeline grid */}
            {lines.map((minute) => (
              <i
                className={
                  "rt-line" +
                  (minute % 60 === 0 ? "" : " half")
                }
                key={minute}
                style={{ top: y(minute) }}
              />
            ))}

            {/* Classes */}
            {layoutDay(items, day).map(
              ({ c, lane, lanes }) => {
                const start = toMin(c.start);
                const end = toMin(c.end);

                // Calculate height from actual class duration
                const duration = Math.max(0, end - start);
                const blockHeight = (duration * PPH) / 60;

                // Calculate horizontal position
                const blockLeft =
                  `calc(${lane} * 100% / ${lanes} + 2px)`;

                const blockWidth =
                  `calc(100% / ${lanes} - 4px)`;

                return (
                  <div
                    key={c.id + day}
                    role="button"
                    tabIndex={0}
                    className={
                      "rt-block" +
                      (conflictIds.has(c.id) ? " bad" : "")
                    }
                    aria-label={`${c.code} section ${c.section}, ${day} ${short(c.start)} to ${short(c.end)}`}
                    style={{
                      "--h": c.hue,
                      top: y(start),
                      height: blockHeight,
                      left: blockLeft,
                      width: blockWidth,
                      boxSizing: "border-box",
                      minWidth: 0,
                    }}
                    onClick={() => select(c)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        select(c);
                      }
                    }}
                  >
                    {/* Course title and section */}
                    <div className="rt-title">
                      <span className="rt-sec">
                        Sec {c.section}
                      </span>

                      {c.title}
                    </div>

                    {/* Class time */}
                    <div className="rt-time">
                      {short(c.start)} – {short(c.end)}
                    </div>

                    {/* Room */}
                    {c.room && (
                      <div className="rt-room">
                        {c.room}
                      </div>
                    )}

                    {/* Faculty initial and name */}
                    <div className="rt-fac">
                      {c.facultyInitial ? (
                        <span className="rt-av">
                          {c.facultyInitial}
                        </span>
                      ) : null}

                      <span className="rt-fn">
                        {c.faculty || "TBA"}
                      </span>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        ))}
      </div>
    </div>
  );
}