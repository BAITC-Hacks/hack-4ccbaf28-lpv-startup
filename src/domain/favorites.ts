import { z } from "zod";
import { contractorSchema, querySchema } from "./schema";
import type { RankedMatch, SearchQuery } from "./types";
export interface Favorite {
  match: RankedMatch;
  query: SearchQuery;
  explanation: string;
  savedAt: string;
}
export const FAVORITES_KEY = "lpv-favorites-v1";
const favoriteSchema = z.object({
  match: z.object({
    contractor: contractorSchema,
    score: z.number(),
    evidence: z
      .array(
        z.object({ criterion: z.string().max(100), fact: z.string().max(500) }),
      )
      .max(20),
  }),
  query: querySchema,
  explanation: z.string().max(1800),
  savedAt: z.iso.datetime(),
});
/** Validate browser storage before rendering; one favorite per catalog identity. */
export function readFavorites(raw: string | null): Favorite[] {
  if (!raw || raw.length > 500_000) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: Favorite[] = [];
    for (const value of parsed.slice(0, 66)) {
      const item = favoriteSchema.safeParse(value);
      if (
        item.success &&
        !result.some(
          (f) => f.match.contractor.id === item.data.match.contractor.id,
        )
      )
        result.push(item.data);
    }
    return result;
  } catch {
    return [];
  }
}
