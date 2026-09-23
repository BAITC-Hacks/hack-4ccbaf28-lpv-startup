import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { catalog, getMeta, initialQuery } from "../src/server/catalog";
import { search } from "../src/domain/matching";
import { individualQuotes } from "../src/domain/explanations";
import type { SearchQuery } from "../src/domain/types";

const started = Date.now();
const meta = getMeta();
let requests = 0;
let checkedCards = 0;
const outcomes = { matched: 0, no_category: 0, no_matches: 0 };
for (let day = 0; day < 100; day++) {
  const date = new Date(Date.UTC(2026, 8, 23 + day)).toISOString().slice(0, 10);
  for (const city of meta.cities) {
    for (const category of meta.categories) {
      const supply = catalog.filter(
        (c) => c.city === city && c.categories.includes(category),
      );
      for (const event_format of meta.formats) {
        for (const budget_kzt of [100000, 1000000, 10000000]) {
          const query: SearchQuery = {
            city,
            category,
            event_format,
            date,
            budget_kzt,
          };
          const result = search(catalog, query);
          // Independent oracle over raw fields; do not reuse rejectionReasons.
          const expected = supply.filter(
            (c) =>
              !c.busy_dates.includes(date) &&
              c.price_from_kzt <= budget_kzt &&
              c.event_formats.includes(event_format),
          );
          assert.equal(
            result.status,
            !supply.length
              ? "no_category"
              : !expected.length
                ? "no_matches"
                : "matched",
          );
          assert.equal(result.matches.length, Math.min(3, expected.length));
          if (result.status === "matched") {
            assert.equal(result.totalEligible, expected.length);
            assert.equal(result.candidatesInCity, supply.length);
          }
          for (const match of result.matches) {
            assert.ok(expected.some((c) => c.id === match.contractor.id));
            checkedCards++;
          }
          outcomes[result.status]++;
          requests++;
        }
      }
    }
  }
}

const limitedDescriptions = catalog.flatMap((c) => {
  const peers = catalog.filter(
    (p) =>
      p.city === c.city &&
      p.categories.some((category) => c.categories.includes(category)),
  );
  const options = individualQuotes(c, peers, {
    ...initialQuery,
    preferences: undefined,
  });
  for (const option of options) assert.ok(c.description.includes(option.quote));
  return options[0].quality === "limited"
    ? [{ id: c.id, name: c.anon_name, category: c.categories[0] }]
    : [];
});
const report = {
  checkedAt: new Date().toISOString(),
  passed: true,
  mode: "offline-exhaustive-structured-grid",
  catalogSize: catalog.length,
  days: 100,
  cities: meta.cities,
  categories: meta.categories.length,
  eventFormats: meta.formats,
  budgets: [100000, 1000000, 10000000],
  requests,
  checkedCards,
  outcomes,
  elapsedMs: Date.now() - started,
  limitedDescriptions,
  scope:
    "All catalog cities, categories, event formats and dates at three budget levels. Optional language/duration, invalid inputs, determinism and provider failures are covered by npm test. This is a constraint audit, not a human score of explanation quality. Limited-description labels are a conservative heuristic, not an assertion that a profile has no useful facts.",
};
const flag = process.argv.indexOf("--report");
if (flag !== -1 && process.argv[flag + 1])
  writeFileSync(process.argv[flag + 1], JSON.stringify(report, null, 2) + "\n");
console.log(
  `PASS: ${requests} structured searches over 100 dates; ${checkedCards} returned cards checked independently; ${limitedDescriptions.length} descriptions need cautious explanations. ${report.elapsedMs} ms.`,
);
