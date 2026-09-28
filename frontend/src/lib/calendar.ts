/**
 * Date helpers for the calendar.
 *
 * The calendar used to render a hardcoded "Sep 1" through "Sep 28" and place
 * events with `event.date.endsWith(...)` plus a hand-written map of day numbers
 * to event titles, because the backend only sent "Sep 15" with no year. These
 * build the grid from the real current date and locate events by comparing
 * calendar days, so nothing has to be hardcoded.
 *
 * Everything works in local time. The backend sends an ISO timestamp, which
 * `new Date` reads as UTC; converting that to a local day is what puts an event
 * on the day the user entered, rather than the day before it for anyone east of
 * Greenwich.
 */

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** yyyy-mm-dd in local time, which is the key events are grouped by. */
export const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date: Date, count: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);

/** Midnight on the first of the given month. Month is 0-indexed, as in Date. */
export const startOfMonth = (year: number, month: number): Date => new Date(year, month, 1);

export const addMonths = (date: Date, count: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + count, 1);

export const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

/** The day an ISO timestamp falls on, in local time. Null if unparseable. */
export const localDay = (iso: string | null | undefined): Date | null => {
  if (!iso) {
    return null;
  }

  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return startOfDay(parsed);
};

/** Start of the week containing `date`, Sunday first. */
export const startOfWeek = (date: Date): Date => addDays(date, -date.getDay());

/** Start of the week `days` from the one containing `date`. */
export const startOfRelativeWeek = (date: Date, days: number): Date =>
  addDays(startOfWeek(date), days);

export const endOfWeek = (date: Date): Date => addDays(startOfWeek(date), 6);

/**
 * Whether a timestamp falls before today. A task with no due date is not
 * overdue; one due today is not yet either.
 */
export const isOverdue = (iso: string | null | undefined, now = new Date()): boolean => {
  const due = localDay(iso);

  return due !== null && due.getTime() < startOfDay(now).getTime();
};

export const isDueToday = (iso: string | null | undefined, now = new Date()): boolean => {
  const due = localDay(iso);

  return due !== null && isSameDay(due, now);
};

/** Within the current week, today included. */
export const isDueThisWeek = (iso: string | null | undefined, now = new Date()): boolean => {
  const due = localDay(iso);

  if (!due) {
    return false;
  }

  const from = startOfWeek(startOfDay(now)).getTime();
  const to = addDays(startOfWeek(startOfDay(now)), 6).getTime();

  return due.getTime() >= from && due.getTime() <= to;
};

/** Not overdue and due on or after today. */
export const isUpcoming = (iso: string | null | undefined, now = new Date()): boolean => {
  const due = localDay(iso);

  return due !== null && due.getTime() >= startOfDay(now).getTime();
};

/**
 * The six-week grid a month view needs: the month, padded to whole weeks so
 * every row is seven days and the leading and trailing blanks still line up
 * with the right weekday.
 */
export const monthGrid = (anchor: Date): Date[] => {
  const first = startOfMonth(anchor.getFullYear(), anchor.getMonth());
  const gridStart = startOfWeek(first);
  // Day 0 of the next month, so the last day of this one.
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  // Counted from the padded start, not from the first of the month, or the
  // leading blanks would be missing from the total.
  const span = Math.round((startOfDay(last).getTime() - gridStart.getTime()) / 86400000) + 1;
  const days = Math.max(7, Math.ceil(span / 7) * 7);

  return Array.from({ length: days }, (_, index) => addDays(gridStart, index));
};

export const weekDays = (anchor: Date): Date[] =>
  Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchor), index));

/** "September 2026" */
export const monthLabel = (date: Date): string =>
  `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;

/** "Sun 15" — or just "15" inside the month being shown. */
export const dayLabel = (date: Date, anchor?: Date): string =>
  anchor && anchor.getMonth() === date.getMonth() && anchor.getFullYear() === date.getFullYear()
    ? String(date.getDate())
    : `${WEEKDAY_SHORT[date.getDay()]} ${date.getDate()}`;

export const isToday = (date: Date, now = new Date()): boolean => isSameDay(date, now);

/**
 * Events grouped by local day, ignoring any without a usable timestamp.
 * Anything the backend could not date is left out rather than dropped onto an
 * arbitrary square.
 */
export const groupByDay = <T extends { startAt: string | null }>(events: T[]): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();

  for (const event of events) {
    const day = localDay(event.startAt);

    if (!day) {
      continue;
    }

    const key = dayKey(day);
    const bucket = grouped.get(key);

    if (bucket) {
      bucket.push(event);
    } else {
      grouped.set(key, [event]);
    }
  }

  return grouped;
};
