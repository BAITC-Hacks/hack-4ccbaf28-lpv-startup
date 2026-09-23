import data from "../../data/contractors.json";
import type { Contractor, SearchQuery } from "../domain/types";
import type { CatalogMeta } from "../domain/api";

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
export function getMeta(): CatalogMeta {
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
        detail: "Алматы · до 1 млн ₸",
        query: initialQuery,
      },
      {
        label: "Камерная флористика",
        detail: "Редкая категория",
        query: {
          ...initialQuery,
          category: "Флорист",
          budget_kzt: 400000,
          date: "2026-10-15",
          language: undefined,
          hours: undefined,
          preferences: "Авторское цветочное оформление",
        },
      },
      {
        label: "Проверить ограничения",
        detail: "Что делать, если бюджет мал",
        query: { ...initialQuery, budget_kzt: 100000, preferences: "" },
      },
    ],
  };
}
