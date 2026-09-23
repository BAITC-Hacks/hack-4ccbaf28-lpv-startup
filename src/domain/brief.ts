import { querySchema } from "./schema";
import type { SearchQuery } from "./types";

/** Missing values stay missing: a demo must never become an implicit user choice. */
export type Brief = Partial<SearchQuery>;
export const briefSchema = querySchema.partial();
export const requiredFields = [
  "city",
  "category",
  "event_format",
  "date",
  "budget_kzt",
] as const;
export type RequiredField = (typeof requiredFields)[number];
export const fieldLabels: Record<RequiredField, string> = {
  city: "город",
  category: "категория",
  event_format: "формат события",
  date: "дата",
  budget_kzt: "бюджет",
};
export function missingFields(brief: Brief): RequiredField[] {
  return requiredFields.filter((field) => !brief[field]);
}
export function briefQuestion(brief: Brief): string {
  const missing = missingFields(brief);
  if (!missing.length)
    return "Заявка заполнена. Проверьте параметры и подтвердите подбор.";
  const prompts: Record<RequiredField, string> = {
    city: "В каком городе пройдёт событие?",
    category: "Какого подрядчика ищем?",
    event_format: "Какой формат события планируете?",
    date: "На какую дату ищем подрядчика?",
    budget_kzt: "Какой бюджет на одного подрядчика?",
  };
  return `${prompts[missing[0]]} Можно выбрать ниже или продолжить голосом.`;
}

/** Ignore stale assistant responses when the user has edited their brief meanwhile. */
export function canApplyBrief(
  requestRevision: number,
  currentRevision: number,
): boolean {
  return requestRevision === currentRevision;
}
