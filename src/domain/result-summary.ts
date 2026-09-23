import { money } from "./matching";
import type { SearchQuery, SearchResult } from "./types";

/** Explain limited supply directly, without adding overlapping rejection counts. */
export function resultSummary(
  result: SearchResult,
  query: SearchQuery,
): string {
  if (result.status === "no_category")
    return `В каталоге для города «${query.city}» нет анкет категории «${query.category}». Можно изменить город или категорию.`;
  const date = query.date.split("-").reverse().join(".");
  if (result.rejected.busy_date === result.candidatesInCity)
    return `Все анкеты этой категории в городе (${result.candidatesInCity}) заняты на ${date}. Увеличение бюджета не освободит эту дату; попробуйте другую.`;
  const labels = {
    busy_date: `заняты на ${date}`,
    over_budget: `начальная цена выше ${money(query.budget_kzt)}`,
    event_format: `не берут формат «${query.event_format}»`,
    language: `не указан язык «${query.language}»`,
    duration: `лимит меньше ${query.hours} ч`,
  };
  const rejected = Object.entries(result.rejected)
    .filter(([, count]) => count > 0)
    .map(
      ([reason, count]) =>
        `${labels[reason as keyof typeof labels]} — ${count}`,
    );
  const count = result.status === "matched" ? result.totalEligible : 0;
  const available = `Анкет этой категории в городе: ${result.candidatesInCity}; всем условиям соответствуют: ${count}.`;
  if (!rejected.length)
    return count < 3
      ? `${available} В каталоге больше анкет этой категории для города нет.`
      : available;
  return `${available} Причины исключения: ${rejected.join("; ")}.${rejected.length > 1 ? " У одной анкеты может быть несколько причин." : ""}`;
}
