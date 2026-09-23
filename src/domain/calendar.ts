import { CALENDAR_END, CALENDAR_START } from "./schema";
import { briefSchema, type Brief } from "./brief";
import { normalize, rejectionReasons } from "./matching";
import type { Contractor, SearchQuery } from "./types";

export interface CalendarDay {
  date: string;
  available: number;
  withinBudget: number | null;
  minPrice: number | null;
}
export interface AvailabilityCalendar {
  ready: boolean;
  days: CalendarDay[];
}

/** Minimum fixed catalog price, NOT a date-dependent discount or booking quote. */
export function availabilityCalendar(
  catalog: readonly Contractor[],
  input: Brief,
): AvailabilityCalendar {
  const brief = briefSchema.parse(input);
  if (!brief.city || !brief.category || !brief.event_format)
    return { ready: false, days: [] };
  const pool = catalog.filter(
    (c) =>
      normalize(c.city) === normalize(brief.city!) &&
      c.categories.some((v) => normalize(v) === normalize(brief.category!)),
  );
  const days: CalendarDay[] = [];
  for (
    let day = new Date(`${CALENDAR_START}T12:00:00Z`);
    day.toISOString().slice(0, 10) <= CALENDAR_END;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const date = day.toISOString().slice(0, 10);
    const query: SearchQuery = {
      ...brief,
      city: brief.city,
      category: brief.category,
      event_format: brief.event_format,
      date,
      budget_kzt: 100_000_000,
    };
    const available = pool.filter(
      (c) => rejectionReasons(c, query).length === 0,
    );
    days.push({
      date,
      available: available.length,
      withinBudget: brief.budget_kzt
        ? available.filter((c) => c.price_from_kzt <= brief.budget_kzt!).length
        : null,
      minPrice: available.length
        ? Math.min(...available.map((c) => c.price_from_kzt))
        : null,
    });
  }
  return { ready: true, days };
}
