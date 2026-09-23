import data from "../../data/contractors.json";
import added from "../../data/contractors.synthetic.json";
import type { Contractor, SearchQuery } from "../domain/types";
import type { CatalogMeta } from "../domain/api";

export const officialCatalog: Contractor[] = data;
export const teamCatalog: Contractor[] = added;
export const catalog: Contractor[] = [...officialCatalog, ...teamCatalog];
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
  const date = initialQuery.date;
  const when = "15 октября 2026";
  const base: SearchQuery = {
    city: "Алматы",
    date,
    category: "Ведущий",
    event_format: "корпоратив",
    budget_kzt: 1000000,
  };
  return {
    count: catalog.length,
    officialCount: officialCatalog.length,
    teamSyntheticCount: teamCatalog.length,
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
