import { DAYS, toMin, hourLabel, layoutDay } from "./utils.js";

const PPH = 88; // pixels per hour

// "8:30 AM", "11 AM"
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

  const from =
    Math.floor(
      Math.min(480, ...items.map((i) => toMin(i.start))) / 60
    ) * 60;

  const to =
    Math.ceil(
      Math.max(1020, ...items.map((i) => toMin(i.end))) / 60
    ) * 60;

  // Timeline height follows the time range.
  const height = ((to - from) * PPH) / 60;

  // Convert a time into a vertical pixel position.
  const y = (min) => ((min - from) * PPH) / 60;

  const credits = items.reduce(
    (sum, item) => sum + (Number(item.credit) || 0),
    0
  );

  const legend = [];

  items.forEach((item) => {
    if (!legend.some((entry) => entry.code === item.code)) {
      legend.push(item);
    }
  });

  const lines = [];

  for (let m = from + 30; m <= to; m += 30) {
    lines.push(m);
  }

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
          {items.length === 1 ? "course" : "courses"}
          {" · "}
          {credits} credits
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

        {DAYS.map((day) => (
          <div
            className="rt-col"
            style={{ height }}
            key={day}
          >
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

            {layoutDay(items, day).map(
              ({ c, lane, lanes }) => {
                const start = toMin(c.start);
                const end = toMin(c.end);
                const duration = Math.max(0, end - start);

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

                      // Box height matches the actual class duration.
                      height: (duration * PPH) / 60,

                      left: `calc(${lane} * 100% / ${lanes} + 4px)`,

                      width: `calc(100% / ${lanes} - 8px)`,
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
                    <div className="rt-title">
                      <span className="rt-sec">
                        Sec {c.section}
                      </span>

                      {c.title}
                    </div>

                    <div className="rt-time">
                      {short(c.start)} – {short(c.end)}
                    </div>

                    {c.room && (
                      <div className="rt-room">
                        {c.room}
                      </div>
                    )}

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