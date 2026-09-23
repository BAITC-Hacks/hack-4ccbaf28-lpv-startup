import { z } from "zod";

export const CALENDAR_START = "2026-09-23";
export const CALENDAR_END = "2026-12-31";
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const date = new Date(`${s}T12:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === s
    );
  }, "Некорректная дата");

export const querySchema = z
  .object({
    city: z.string().trim().min(1).max(80),
    date: isoDate.refine(
      (d) => d >= CALENDAR_START && d <= CALENDAR_END,
      "Каталог содержит календарь с 23 сентября по 31 декабря 2026 года",
    ),
    category: z.string().trim().min(1).max(100),
    event_format: z.string().trim().min(1).max(80),
    budget_kzt: z.number().int().min(1).max(100_000_000),
    language: z.string().trim().max(80).optional(),
    hours: z.number().positive().max(24).optional(),
    preferences: z.string().trim().max(1200).optional(),
  })
  .strict();

export const contractorSchema = z
  .object({
    id: z.string().min(1),
    anon_name: z.string().min(1),
    categories: z.array(z.string().min(1)).min(1),
    city: z.string().min(1),
    price_from_kzt: z.number().int().nonnegative(),
    event_formats: z.array(z.string().min(1)).min(1),
    languages: z.array(z.string().min(1)).min(1),
    max_hours: z.number().positive().nullable(),
    busy_dates: z.array(isoDate),
    description: z.string().min(1),
    synthetic: z.boolean(),
    city_imputed: z.boolean(),
    price_imputed: z.boolean(),
  })
  .strict();
