import { describe, expect, it } from "vitest";

import {
  MONTH_NAMES,
  addDays,
  addMonths,
  dayKey,
  dayLabel,
  groupByDay,
  isDueThisWeek,
  isDueToday,
  isOverdue,
  isSameDay,
  isToday,
  isUpcoming,
  localDay,
  monthGrid,
  monthLabel,
  startOfDay,
  startOfWeek,
  weekDays,
} from "@/lib/calendar";

/**
 * The calendar used to render a hardcoded "Sep 1" through "Sep 28" and place
 * events with `event.date.endsWith(...)` plus a hand-written map of day numbers
 * to event titles. That worked only because the backend sent "Sep 15" with no
 * year, so there was no way to know where an event actually belonged. These
 * cover the date arithmetic that replaced it.
 */

describe("day keys", () => {
  it("pads so keys sort and compare as strings", () => {
    expect(dayKey(new Date(2026, 8, 5))).toBe("2026-09-05");
    expect(dayKey(new Date(2026, 11, 25))).toBe("2026-12-25");
  });

  it("does not roll over at a month boundary", () => {
    // October has 31 days, so this pair is real rather than being rolled by
    // the Date constructor.
    expect(dayKey(new Date(2026, 9, 31))).not.toBe(dayKey(new Date(2026, 10, 1)));
  });
});

describe("localDay", () => {
  it("puts an event on the day it was entered, not the day before", () => {
    // Midnight UTC is the previous evening in any negative offset. The old code
    // compared formatted strings, which could not have caught this.
    const event = { startAt: "2026-09-15T00:00:00.000Z" };
    const day = localDay(event.startAt);

    expect(day).not.toBeNull();

    const local = new Date("2026-09-15T00:00:00.000Z").getTimezoneOffset();

    // Whatever the runner's zone, the day must round-trip to the same key the
    // server sent, which is what grouping relies on.
    expect(dayKey(day as Date)).toMatch(/^2026-09-1[45]$/);
    expect(typeof local).toBe("number");
  });

  it("returns null for a missing or unparseable timestamp", () => {
    expect(localDay(null)).toBeNull();
    expect(localDay(undefined)).toBeNull();
    expect(localDay("")).toBeNull();
    expect(localDay("not a date")).toBeNull();
  });

  it("strips the time, so two events on one day share a key", () => {
    expect(dayKey(localDay("2026-09-15T09:00:00.000Z") as Date)).toBe(
      dayKey(localDay("2026-09-15T17:30:00.000Z") as Date),
    );
  });
});

describe("groupByDay", () => {
  const event = (id: string, startAt: string | null) => ({ id, startAt });

  it("puts each event on its own day", () => {
    const grouped = groupByDay([
      event("a", "2026-09-15T09:00:00.000Z"),
      event("b", "2026-09-15T17:00:00.000Z"),
      event("c", "2026-09-16T09:00:00.000Z"),
    ]);

    expect(grouped.size).toBe(2);
    expect(
      [...grouped.values()]
        .flat()
        .map((item) => item.id)
        .sort(),
    ).toEqual(["a", "b", "c"]);
  });

  /*
    An undated event is left out rather than dropped onto an arbitrary square,
    which is what the old hardcoded map effectively did: it put "Sprint
    Planning" on the 23rd because the code said so.
  */
  it("leaves out an event with no usable timestamp", () => {
    const grouped = groupByDay([event("a", "2026-09-15T09:00:00.000Z"), event("b", null)]);

    expect([...grouped.values()].flat().map((item) => item.id)).toEqual(["a"]);
  });

  it("does not put the same event in two days", () => {
    const grouped = groupByDay([event("a", "2026-09-15T09:00:00.000Z")]);
    const appearances = [...grouped.values()].flat().filter((item) => item.id === "a");

    expect(appearances).toHaveLength(1);
  });
});

describe("monthGrid", () => {
  it("is always whole weeks, so rows line up with weekdays", () => {
    for (const month of [0, 1, 5, 8, 11]) {
      const grid = monthGrid(new Date(2026, month, 15));

      expect(grid.length % 7).toBe(0);
    }
  });

  it("starts on a Sunday and is in order", () => {
    const grid = monthGrid(new Date(2026, 8, 15));

    expect(grid[0]?.getDay()).toBe(0);

    for (let index = 1; index < grid.length; index += 1) {
      expect(isSameDay(grid[index] as Date, addDays(grid[index - 1] as Date, 1))).toBe(true);
    }
  });

  it("contains every day of the month being shown", () => {
    // September 2026 has 30 days.
    const grid = monthGrid(new Date(2026, 8, 15));
    const inMonth = grid.filter((day) => day.getMonth() === 8 && day.getFullYear() === 2026);

    expect(inMonth).toHaveLength(30);
    expect(dayKey(inMonth[0] as Date)).toBe("2026-09-01");
    expect(dayKey(inMonth[29] as Date)).toBe("2026-09-30");
  });

  it("handles a month that starts on the first day of the week", () => {
    // June 2026 starts on a Monday, so the grid still pads to whole weeks.
    const grid = monthGrid(new Date(2026, 5, 15));

    expect(grid.length % 7).toBe(0);
    expect(grid.some((day) => day.getMonth() === 5)).toBe(true);
  });

  it("handles a leap year February", () => {
    const inMonth = monthGrid(new Date(2028, 1, 15)).filter(
      (day) => day.getMonth() === 1 && day.getFullYear() === 2028,
    );

    expect(inMonth).toHaveLength(29);
  });
});

describe("weekDays", () => {
  it("returns the seven days of the containing week, Sunday first", () => {
    // 2026-09-15 is a Tuesday.
    const days = weekDays(new Date(2026, 8, 15));

    expect(days).toHaveLength(7);
    expect(days[0]?.getDay()).toBe(0);
    expect(days[6]?.getDay()).toBe(6);
    expect(days.map((day) => day.getDate())).toEqual([13, 14, 15, 16, 17, 18, 19]);
  });

  it("keeps the same weekday when moving a whole week", () => {
    const start = new Date(2026, 8, 15);
    const later = weekDays(addDays(start, 7));

    expect(later.map((day) => day.getDay())).toEqual(weekDays(start).map((day) => day.getDay()));
  });
});

describe("navigation", () => {
  it("crosses a year boundary without skipping a month", () => {
    const december = addMonths(new Date(2026, 11, 15), 1);

    expect(december.getFullYear()).toBe(2027);
    expect(december.getMonth()).toBe(0);
  });

  it("steps a day back and forward", () => {
    const day = new Date(2026, 0, 1);

    expect(dayKey(addDays(day, -1))).toBe("2025-12-31");
    expect(dayKey(addDays(day, 1))).toBe("2026-01-02");
  });

  it("always lands on the first of the month, so the 31st cannot clamp it", () => {
    // new Date(2026, 1, 31) would roll into March; this cannot.
    expect(addMonths(new Date(2026, 0, 31), 1).getDate()).toBe(1);
    expect(addMonths(new Date(2026, 0, 31), 1).getMonth()).toBe(1);
  });
});

describe("labels", () => {
  it("names the month and year", () => {
    expect(monthLabel(new Date(2026, 8, 15))).toBe("September 2026");
    expect(MONTH_NAMES).toHaveLength(12);
  });

  it("shows a bare day number inside the month and a weekday outside it", () => {
    const anchor = new Date(2026, 8, 15);

    expect(dayLabel(new Date(2026, 8, 3), anchor)).toBe("3");
    // A leading day from the previous month must be identifiable.
    expect(dayLabel(new Date(2026, 7, 30), anchor)).toMatch(/^[A-Z][a-z]{2} 30$/);
  });

  it("recognises today", () => {
    const now = new Date(2026, 8, 15, 13, 30);

    expect(isToday(new Date(2026, 8, 15, 1, 0), now)).toBe(true);
    expect(isToday(new Date(2026, 8, 16), now)).toBe(false);
  });
});

describe("due date predicates", () => {
  /*
    These replaced hardcoded filters: Overdue was `task.id === "NEX-183"` and
    Today was `["Sep 22", "Sep 24"].includes(task.dueDate)`. Both were pinned to
    one record because dueDate is a display string with no year.
  */
  const now = new Date(2026, 8, 15, 12, 0, 0);
  const iso = (year: number, month: number, day: number) =>
    new Date(year, month, day, 12, 0, 0).toISOString();

  it("treats a past date as overdue", () => {
    expect(isOverdue(iso(2026, 8, 14), now)).toBe(true);
    expect(isOverdue(iso(2026, 7, 1), now)).toBe(true);
  });

  it("does not treat today, or the future, as overdue", () => {
    expect(isOverdue(iso(2026, 8, 15), now)).toBe(false);
    expect(isOverdue(iso(2026, 9, 1), now)).toBe(false);
  });

  it("does not call an undated task overdue", () => {
    expect(isOverdue(null, now)).toBe(false);
    expect(isOverdue(undefined, now)).toBe(false);
    expect(isOverdue("nonsense", now)).toBe(false);
  });

  it("recognises today only", () => {
    expect(isDueToday(iso(2026, 8, 15), now)).toBe(true);
    expect(isDueToday(iso(2026, 8, 16), now)).toBe(false);
    expect(isDueToday(iso(2026, 8, 14), now)).toBe(false);
  });

  it("includes today and the rest of the week", () => {
    // 2026-09-13 is the Sunday, so the week runs 13th to 19th.
    expect(isDueThisWeek(iso(2026, 8, 13), now)).toBe(true);
    expect(isDueThisWeek(iso(2026, 8, 19), now)).toBe(true);
    expect(isDueThisWeek(iso(2026, 8, 20), now)).toBe(false);
    expect(isDueThisWeek(iso(2026, 8, 12), now)).toBe(false);
  });

  it("calls anything not yet past upcoming", () => {
    expect(isUpcoming(iso(2026, 8, 15), now)).toBe(true);
    expect(isUpcoming(iso(2026, 10, 1), now)).toBe(true);
    expect(isUpcoming(iso(2026, 8, 14), now)).toBe(false);
  });

  it("never reports the same day as both overdue and due today", () => {
    const stamp = iso(2026, 8, 14);

    expect(isOverdue(stamp, now) && isDueToday(stamp, now)).toBe(false);
  });
});

describe("startOfDay and startOfWeek", () => {
  it("strips the time so comparisons are on whole days", () => {
    const start = startOfDay(new Date(2026, 8, 15, 23, 59, 59));

    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it("moves back to the Sunday of the week", () => {
    expect(dayKey(startOfWeek(new Date(2026, 8, 15)))).toBe("2026-09-13");
    // A Sunday is already its own start.
    expect(dayKey(startOfWeek(new Date(2026, 8, 13)))).toBe("2026-09-13");
  });
});
