import type { Contractor, RankedMatch, SearchQuery } from "./types";
import { money, normalize } from "./matching";

const stopWords = new Set(
  "который которая которые своих своим этого такое также более очень всегда каждый всем только меня меня зовут работы работа мероприятие мероприятия ведущий профессиональный профессиональная подходит формат стиль гости гостей праздник события событие опыт подход чтобы вместе именно можно будет будут делаем делает услуги себя своих нашей наши ваши ваше который потому любые всему всех ваших"
    .split(" ")
    .map((w) => w.slice(0, 5)),
);
function words(text: string): string[] {
  return [
    ...new Set(
      (normalize(text).match(/[а-яa-z0-9]+/g) || [])
        .filter((w) => w.length >= 4)
        .map((w) => w.slice(0, 5))
        .filter((w) => !stopWords.has(w)),
    ),
  ];
}

/** Source substrings only: no paraphrasing, invented claims, or incomplete words. */
export function sourceFragments(description: string): string[] {
  const fragments: string[] = [];
  for (const sentence of description
    .split(/(?<=[.!?])\s+|(?<=[.!?])(?=[А-ЯA-Z])|[•\n]/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (sentence.length <= 290) {
      if (sentence.length >= 25) fragments.push(sentence);
      continue;
    }
    const clauses = sentence
      .split(/(?<=[;,])\s+/)
      .filter((s) => s.length >= 25 && s.length <= 290);
    if (clauses.length) fragments.push(...clauses);
    else {
      const prefix = sentence.slice(0, 280);
      fragments.push(prefix.slice(0, prefix.lastIndexOf(" ")).trim());
    }
  }
  return [...new Set(fragments)].filter((s) => description.includes(s));
}

/** Concrete details distinguish profiles after their anonymized names are removed. */
export function detailStrength(quote: string): number {
  const s = normalize(quote);
  let score = 0;
  if (
    /\d+\s*(?:человек|чел\b|гост|мест|свад|камер|мероприяти|заказ|вокалист|музыкант|минут|час|дн)/.test(
      s,
    )
  )
    score += 7;
  // A promise to relive photos "in 10 years" is not ten years of experience.
  if (
    /(?:опыт|веду|ведет|работа|снима|созда|фотограф).{0,45}(?:\d+|семи|десяти)\s*(?:лет|год)|\d+\s*(?:лет|год).{0,35}(?:опыт|ведени|съем|работ|созда)/.test(
      s,
    )
  )
    score += 7;
  if (
    /акт[её]р|педагог|солист|телеведущ|саксофон|скрип|фортепиано|гитар|джаз|этно.рок|репортаж|кинематограф|документальн|постановоч|фотожурнализм/.test(
      s,
    )
  )
    score += 6;
  if (
    /оборудован|мультимедиа|мультимедий|светов|звукорежиссер|\bdj\b|фотозон|фотокниг|ретуш|дрон|аэросъем|арки|сезонн|живые цвет|инсталляц|террас|панорам|парков|банкетными зал|потолк|трансфер|банкетное меню|вегетариан|ручной работ|фотобудк|печать.{0,20}(?:снимк|фото)|брендирован|именные|логотип|леденцы|welcome-бокс/.test(
      s,
    )
  )
    score += 5;
  if (
    /специализир.{0,80}(?:свадеб|семейн|корпоратив)|семейн.{0,20}съем|love story|портретн.{0,20}фото|в студии|выездных локаци|позирован|не про позы|снима.{0,30}концерт|снимал.{0,40}(?:город|стран)|портфолио.{0,20}съемки для|музыкальный дуэт|репертуар|хореографи|выездную регистраци/.test(
      s,
    )
  )
    score += 5;
  if (
    /казахск.{0,25}русск|русск.{0,25}английск|каз\/рус|двуязыч|трех языках/.test(
      s,
    )
  )
    score += 4;
  if (
    /резидент|финалист|сценарист|квн|чемпион|лига|телеканал|авторск|импровизатор|топ.?\d|colorist of the year|победител.{0,30}номинац/.test(
      s,
    )
  )
    score += 3;
  if (/без.{0,25}конкурс|без долгих речей/.test(s)) score += 5;
  return score;
}

export interface QuoteOption {
  quote: string;
  specificity: number;
  relevant: boolean;
  quality: "specific" | "limited";
}
export function individualQuotes(
  contractor: Contractor,
  peers: readonly Contractor[],
  query: SearchQuery,
): QuoteOption[] {
  const names = new Set(words(contractor.anon_name));
  const peerWords = peers
    .filter((c) => c.id !== contractor.id)
    .map((c) => new Set(words(c.description)));
  const wanted = words(query.preferences || "");
  const quiet = /спокойн|тих|ненавязчив/.test(
    normalize(query.preferences || ""),
  );
  const options = sourceFragments(contractor.description)
    .filter((q) => {
      const s = normalize(q);
      return (
        !/приветств|меня зовут|с уважением|свяж|связав|по телефону|можете не сомневаться|дорогие друзья/.test(
          s,
        ) && !(quiet && /тихий,? формальный вечер.{0,45}не подой/s.test(s))
      );
    })
    .map((quote) => {
      const terms = words(quote).filter((w) => !names.has(w));
      const unique = terms.filter(
        (w) => !peerWords.some((p) => p.has(w)),
      ).length;
      const rarity =
        terms.reduce(
          (sum, w) =>
            sum +
            Math.log(
              (peerWords.length + 2) /
                (peerWords.filter((p) => p.has(w)).length + 1),
            ),
          0,
        ) / Math.sqrt(Math.max(terms.length, 1));
      const relevant = wanted.some((w) => terms.includes(w));
      return {
        quote,
        specificity:
          detailStrength(quote) * 3 +
          Math.min(unique, 8) +
          rarity +
          (relevant ? 5 : 0),
        relevant,
        quality:
          detailStrength(quote) >= 3
            ? ("specific" as const)
            : ("limited" as const),
      };
    });
  // When factual details exist, generic self-praise must not replace them.
  const detailed = options.filter((o) => detailStrength(o.quote) >= 3);
  const pool = detailed.length ? detailed : options;
  pool.sort(
    (a, b) =>
      Number(b.relevant) - Number(a.relevant) ||
      b.specificity - a.specificity ||
      a.quote.localeCompare(b.quote, "ru"),
  );
  if (!pool.length)
    return [
      {
        quote:
          sourceFragments(contractor.description)[0] || contractor.description,
        specificity: 0,
        relevant: false,
        quality: "limited",
      },
    ];
  const minimum = pool[0].specificity * 0.72;
  return pool
    .filter(
      (o) => o.specificity >= minimum && (!pool[0].relevant || o.relevant),
    )
    .slice(0, 4);
}

/** Only compare returned profiles; never imply the cheapest shortlist item is best. */
export function shortlistComparison(
  match: RankedMatch,
  matches: readonly RankedMatch[],
  totalEligible: number,
): string {
  const c = match.contractor;
  if (!matches.some((m) => m.contractor.id === c.id)) return "";
  const others = matches
    .filter((m) => m.contractor.id !== c.id)
    .map((m) => m.contractor);
  if (!others.length)
    return totalEligible === 1
      ? "Единственная анкета этой категории в городе, которая проходит все заданные условия"
      : "";
  const nextPrice = Math.min(...others.map((p) => p.price_from_kzt));
  if (c.price_from_kzt < nextPrice)
    return `Начальная цена на ${money(nextPrice - c.price_from_kzt)} ниже ближайшего по цене из остальных показанных вариантов`;
  const uniqueLanguage = c.languages.find(
    (language) =>
      !others.some((p) =>
        p.languages.some((value) => normalize(value) === normalize(language)),
      ),
  );
  if (uniqueLanguage)
    return `Из показанных анкет только здесь указан язык «${uniqueLanguage}»`;
  if (
    c.max_hours !== null &&
    others.every((p) => p.max_hours !== null && p.max_hours < c.max_hours!)
  )
    return `Самый большой указанный лимит среди показанных анкет — ${c.max_hours} ч`;
  if (c.price_from_kzt > nextPrice)
    return `Начальная цена на ${money(c.price_from_kzt - nextPrice)} выше минимальной среди показанных анкет; более высокая цена сама по себе не подтверждает лучшее качество`;
  return "";
}

export function explanationFromQuote(
  match: RankedMatch,
  query: SearchQuery,
  quote: string,
  comparison = "",
): string {
  const c = match.contractor;
  const date = query.date.split("-").reverse().join(".");
  const language = query.language ? `, язык — ${query.language}` : "";
  const hours = query.hours
    ? c.max_hours === null
      ? "; часы присутствия к этой услуге не применяются"
      : `, ${query.hours} ч при лимите ${c.max_hours} ч`
    : "";
  const facts = `На ${date} дата свободна по календарю; от ${money(c.price_from_kzt)} при бюджете ${money(query.budget_kzt)}, формат «${query.event_format}»${language}${hours}.`;
  const conflict = match.evidence.find((e) => e.criterion === "style:conflict");
  if (conflict)
    return `${facts} Ограничение по пожеланию: ${conflict.fact.toLocaleLowerCase("ru-RU")}; строгие условия соблюдены, но стиль может не подойти.`;
  if (detailStrength(quote) < 3)
    return comparison
      ? `${facts} ${comparison}; в описании мало конкретных отличий, особенности стиля и состава услуги не подтверждены.`
      : `${facts} В описании мало конкретных отличий: сравнивайте по указанным цене, языкам и длительности; особенности стиля и состава услуги не подтверждены.`;
  return `${facts} По описанию: «${quote}»`;
}
