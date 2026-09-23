/** Official Firebird hackathon catalog; prices are starting prices, not quotes. */
export interface Contractor {
  id: string;
  anon_name: string;
  categories: string[];
  city: string;
  price_from_kzt: number;
  event_formats: string[];
  languages: string[];
  max_hours: number | null;
  busy_dates: string[];
  description: string;
  synthetic: boolean;
  city_imputed: boolean;
  price_imputed: boolean;
}

/** Dates use YYYY-MM-DD. Budget is in KZT. */
export interface SearchQuery {
  city: string;
  date: string;
  category: string;
  event_format: string;
  budget_kzt: number;
  language?: string;
  hours?: number;
  preferences?: string;
}

export type RejectionReason =
  "busy_date" | "over_budget" | "event_format" | "language" | "duration";

export interface MatchEvidence {
  criterion: string;
  fact: string;
}

export interface RankedMatch {
  contractor: Contractor;
  score: number;
  evidence: MatchEvidence[];
}

/** The UI must distinguish absent supply from existing but unsuitable supply. */
export type SearchResult =
  | { status: "no_category"; matches: []; city: string; category: string }
  | {
      status: "no_matches";
      matches: [];
      candidatesInCity: number;
      rejected: Record<RejectionReason, number>;
    }
  | {
      status: "matched";
      matches: RankedMatch[];
      totalEligible: number;
      candidatesInCity: number;
      rejected: Record<RejectionReason, number>;
    };

export interface ModelUsage {
  purpose: "parse_request" | "explain_matches" | "transcribe";
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cached: boolean;
  /** An estimate, not an invoice. Null when model pricing is unknown. */
  estimatedCostUsd: number | null;
}
