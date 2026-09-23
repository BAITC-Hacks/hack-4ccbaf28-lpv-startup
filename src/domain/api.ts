import type { Alternative } from "./matching";
import type { ModelUsage, SearchQuery, SearchResult } from "./types";

export interface TraceStep {
  label: string;
  detail: string;
  kind: "code" | "model" | "cache";
}
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
export interface SearchResponse {
  query: SearchQuery;
  result: SearchResult;
  summary: string;
  explanations: Record<string, string>;
  explanationEvidence: Record<
    string,
    {
      quote: string;
      source: "description";
      selectedBy: "code" | "model";
      quality: "specific" | "limited";
    }
  >;
  availability: {
    date: string;
    busyCandidates: { id: string; name: string }[];
  };
  alternatives: Alternative[];
  usage: ModelUsage[];
  trace: TraceStep[];
  aiAvailable: boolean;
  explanationMode: "ai" | "local";
  notice?: string;
  elapsedMs: number;
}
export interface CatalogMeta {
  count: number;
  synthetic: number;
  cities: string[];
  categories: string[];
  formats: string[];
  languages: string[];
  aiAvailable: boolean;
  demos: { label: string; detail: string; query: SearchQuery }[];
}
