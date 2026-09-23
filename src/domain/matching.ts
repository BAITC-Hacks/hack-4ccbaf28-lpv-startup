import type {
  Contractor,
  MatchEvidence,
  RankedMatch,
  RejectionReason,
  SearchQuery,
  SearchResult,
} from "./types";
import { CALENDAR_END, CALENDAR_START, querySchema } from "./schema";

export const normalize = (s: string) =>
  s.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
const equals = (a: string, b: string) => normalize(a) === normalize(b);
const has = (values: string[], value: string) =>
  values.some((v) => equals(v, value));
export const money = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n) + " ₸";

export function rejectionReasons(
  c: Contractor,
  q: SearchQuery,
): RejectionReason[] {
  const reasons: RejectionReason[] = [];
  if (c.busy_dates.includes(q.date)) reasons.push("busy_date");
  if (c.price_from_kzt > q.budget_kzt) reasons.push("over_budget");
  if (!has(c.event_formats, q.event_format)) reasons.push("event_format");
  if (q.language && !has(c.languages, q.language)) reasons.push("language");
  if (q.hours !== undefined && c.max_hours !== null && q.hours > c.max_hours)
    reasons.push("duration");
  return reasons;
}

/** Soft lexical preferences never bypass structured hard constraints. */
const facets = [
  {
    query: /спокойн|тих|ненавязчив|интеллигент|камерн|лампов/,
    profile: /спокойн|ненавязчив|интеллигент|камерн|лампов/,
    label: "Спокойная подача",
  },
  {
    query: /динамич|энерги|драйв|весел|импровиз|живое шоу/,
    profile: /динамич|энерги|драйв|импровиз|живое шоу/,
    label: "Энергия и импровизация",
  },
  {
    query: /репортаж|естествен|живые эмоции|искрен/,
    profile: /репортаж|естествен|живые эмоции|искрен/,
    label: "Живые эмоции",
  },
  {
    query: /преми|элегант|эстет|изыскан/,
    profile: /преми|элегант|эстет|изыскан/,
    label: "Эстетика и стиль",
  },
  { query: /джаз|jazz/, profile: /джаз|jazz/, label: "Джаз" },
  {
    query: /традици|этно|национальн/,
    profile: /традици|этно|национальн/,
    label: "Национальный колорит",
  },
  {
    query: /индивидуальн|персональн|авторск/,
    profile: /индивидуальн|персональн|авторск/,
    label: "Индивидуальный подход",
  },
] as const;

export function rank(c: Contractor, q: SearchQuery): RankedMatch {
  const preferences = normalize(q.preferences ?? "");
  const description = normalize(c.description);
  const quietConflict =
    /тих|спокойн|формальн/.test(preferences) &&
    /тихий,? формальный вечер.{0,45}не подой/s.test(description);
  const evidence: MatchEvidence[] = [
    {
      criterion: "budget",
      fact: `Начальная цена ${money(c.price_from_kzt)} при бюджете ${money(q.budget_kzt)}`,
    },
    { criterion: "format", fact: `В анкете указан формат «${q.event_format}»` },
    {
      criterion: "availability",
      fact: `Дата ${q.date} не занята в календаре каталога`,
    },
  ];
  if (q.language)
    evidence.push({
      criterion: "language",
      fact: `Указан язык: ${q.language}`,
    });
  if (q.hours)
    evidence.push({
      criterion: "duration",
      fact:
        c.max_hours === null
          ? "Услуга не ограничена часами присутствия"
          : `До ${c.max_hours} ч при запросе на ${q.hours} ч`,
    });
  let score = 100 + Math.round(10 * (1 - c.price_from_kzt / q.budget_kzt));
  for (const facet of facets) {
    if (quietConflict && facet.label === "Спокойная подача") continue;
    if (facet.query.test(preferences) && facet.profile.test(description)) {
      score += 25;
      evidence.push({
        criterion: `style:${facet.label}`,
        fact: `В описании есть признаки пожелания «${facet.label}»`,
      });
    }
  }
  // An explicit incompatibility in the profile must not count as a positive keyword hit.
  if (quietConflict) {
    score -= 60;
    evidence.push({
      criterion: "style:conflict",
      fact: "В описании отмечено: тихий формальный вечер этому исполнителю не подходит",
    });
  }
  if (/без (?:банальных )?конкурс/.test(preferences)) {
    if (/без.{0,25}конкурс/.test(description)) score += 25;
    else if (/база игр и конкурсов|адресными конкурсами/.test(description))
      score -= 25;
  }
  return { contractor: c, score, evidence };
}

export function search(
  catalog: readonly Contractor[],
  input: SearchQuery,
): SearchResult {
  const q = querySchema.parse(input);
  const candidates = catalog.filter(
    (c) => equals(c.city, q.city) && has(c.categories, q.category),
  );
  if (!candidates.length)
    return {
      status: "no_category",
      matches: [],
      city: q.city,
      category: q.category,
    };
  const rejected: Record<RejectionReason, number> = {
    busy_date: 0,
    over_budget: 0,
    event_format: 0,
    language: 0,
    duration: 0,
  };
  const eligible: RankedMatch[] = [];
  for (const c of candidates) {
    const reasons = rejectionReasons(c, q);
    for (const reason of reasons) rejected[reason]++;
    if (!reasons.length) eligible.push(rank(c, q));
  }
  if (!eligible.length)
    return {
      status: "no_matches",
      matches: [],
      candidatesInCity: candidates.length,
      rejected,
    };
  eligible.sort(
    (a, b) =>
      b.score - a.score ||
      (a.contractor.id < b.contractor.id
        ? -1
        : a.contractor.id > b.contractor.id
          ? 1
          : 0),
  );
  return {
    status: "matched",
    matches: eligible.slice(0, 3),
    totalEligible: eligible.length,
    candidatesInCity: candidates.length,
    rejected,
  };
}

export interface Alternative {
  kind: "date" | "budget";
  label: string;
  query: SearchQuery;
  eligible: number;
}

/** Re-run the entire search for each proposed change. Never silently relax filters. */
export function alternatives(
  catalog: readonly Contractor[],
  input: SearchQuery,
): Alternative[] {
  const q = querySchema.parse(input);
  const result: Alternative[] = [];
  const baseline = search(catalog, q);
  const baselineCount =
    baseline.status === "matched" ? baseline.totalEligible : 0;
  const cheapest = (query: SearchQuery) =>
    Math.min(
      ...catalog
        .filter(
          (c) =>
            equals(c.city, query.city) &&
            has(c.categories, query.category) &&
            !rejectionReasons(c, query).length,
        )
        .map((c) => c.price_from_kzt),
    );
  const baselinePrice = cheapest(q);
  for (const offset of [1, -1, 2, -2, 3, -3, 7, -7]) {
    const date = new Date(`${q.date}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    const next = date.toISOString().slice(0, 10);
    if (next < CALENDAR_START || next > CALENDAR_END) continue;
    const query = { ...q, date: next };
    const found = search(catalog, query);
    const nextPrice = cheapest(query);
    if (
      found.status === "matched" &&
      (!baselineCount ||
        nextPrice < baselinePrice ||
        found.totalEligible > baselineCount)
    ) {
      result.push({
        kind: "date",
        label: `${next.split("-").reverse().join(".")}: ${Number.isFinite(baselinePrice) && nextPrice < baselinePrice ? `от ${money(nextPrice)} — дешевле на ${money(baselinePrice - nextPrice)}` : `${found.totalEligible} подходящих вариантов`}`,
        query,
        eligible: found.totalEligible,
      });
      break;
    }
  }
  const prices = [
    ...new Set(
      catalog
        .filter((c) => equals(c.city, q.city) && has(c.categories, q.category))
        .map((c) => c.price_from_kzt),
    ),
  ]
    .filter((p) => p > q.budget_kzt)
    .sort((a, b) => a - b);
  for (const price of prices) {
    const query = { ...q, budget_kzt: price };
    const found = search(catalog, query);
    if (found.status === "matched" && found.totalEligible > baselineCount) {
      result.push({
        kind: "budget",
        label: `Бюджет ${money(price)}: ${found.totalEligible} вариантов${baselineCount ? ` (+${found.totalEligible - baselineCount})` : ""}`,
        query,
        eligible: found.totalEligible,
      });
      break;
    }
  }
  return result;
}
