import data from "../../data/contractors.json";
import type { Contractor, SearchQuery } from "../domain/types";
import type { CatalogMeta } from "../domain/api";
import { almatyDate } from "../domain/dates";
import { CALENDAR_START, CALENDAR_END } from "../domain/schema";

export const catalog: Contractor[] = data;
const unique = (values: string[]) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b, "ru"));
export const initialQuery: SearchQuery = {
  city: "Алматы",
  date: "2026-10-15",
  category: "Ведущий",
  event_format: "корпоратив",
  budget_kzt: 1000000,
  language: "русский",
  hours: 6,
  preferences: "Интеллигентная, ненавязчивая подача и живой юмор",
};
export function getMeta(now = new Date()): CatalogMeta {
  const today = almatyDate(now);
  const inCalendar = today >= CALENDAR_START && today <= CALENDAR_END;
  const date = inCalendar ? today : initialQuery.date;
  const dateText = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    ...(!inCalendar ? { year: "numeric" as const } : {}),
    timeZone: "Asia/Almaty",
  }).format(new Date(`${date}T12:00:00Z`));
  const when = `${inCalendar ? "Сегодня, " : "Пример: "}${dateText}`;
  const base: SearchQuery = {
    city: "Алматы",
    date,
    category: "Ведущий",
    event_format: "корпоратив",
    budget_kzt: 1000000,
  };
  return {
    count: catalog.length,
    synthetic: catalog.filter((c) => c.synthetic).length,
    cities: unique(catalog.map((c) => c.city)),
    categories: unique(catalog.flatMap((c) => c.categories)),
    formats: unique(catalog.flatMap((c) => c.event_formats)),
    languages: unique(catalog.flatMap((c) => c.languages)),
    aiAvailable: !!process.env.OPENAI_API_KEY,
    demos: [
      {
        label: "Ведущий на корпоратив",
        detail: `${when} · Алматы · до 1 млн ₸`,
        query: base,
      },
      {
        label: "Флорист на корпоратив",
        detail: `${when} · Алматы · до 400 тыс. ₸`,
        query: {
          ...base,
          category: "Флорист",
          budget_kzt: 400000,
        },
      },
      {
        label: "Ведущий до 100 тыс. ₸",
        detail: `${when} · Алматы · корпоратив`,
        query: { ...base, budget_kzt: 100000 },
      },
    ],
  };
}
