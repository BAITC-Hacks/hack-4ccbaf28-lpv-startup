import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detailStrength,
  sourceFragments,
  individualQuotes,
} from "../src/domain/explanations";
import { catalog, initialQuery, getMeta } from "../src/server/catalog";
import { runSearch } from "../src/server/search-service";

test("dense-category explanations identify the actual profile even after names are removed", async () => {
  const data = await runSearch(initialQuery, false);
  const expected = {
    "HK-44923": /DJ|мультимедий/,
    "HK-44733": /8 человек|3000 человек/,
    "HK-77838": /актёр театра|солист/,
  };
  const host = catalog.find((c) => c.id === "HK-44923")!;
  const options = individualQuotes(host, catalog, initialQuery);
  assert.ok(
    options.every(
      (option) => !option.quote.includes("разработаем ОРИГИНАЛЬНЫЙ сценарий"),
    ),
    "A generic promise cannot displace concrete equipment details",
  );
  for (const match of data.result.matches) {
    const quote = data.explanationEvidence[match.contractor.id].quote;
    assert.match(quote, expected[match.contractor.id as keyof typeof expected]);
    assert.ok(match.contractor.description.includes(quote));
    assert.ok(detailStrength(quote) >= 3);
    assert.ok(
      !data.result.matches.some(
        (other) =>
          other.contractor.id !== match.contractor.id &&
          other.contractor.description.includes(quote),
      ),
    );
    assert.ok(data.explanations[match.contractor.id].includes(quote));
    assert.ok(data.explanations[match.contractor.id].includes("15.10.2026"));
  }
});

test("all categories retain source-grounded individual evidence across sample dates", async () => {
  let checked = 0;
  for (const category of getMeta().categories) {
    for (const date of ["2026-09-23", "2026-10-15", "2026-12-19"]) {
      const query = {
        ...initialQuery,
        category,
        date,
        language: undefined,
        hours: undefined,
        preferences: undefined,
        budget_kzt: 10000000,
      };
      const data = await runSearch(query, false);
      const quotes = data.result.matches.map(
        (m) => data.explanationEvidence[m.contractor.id].quote,
      );
      assert.equal(
        new Set(quotes).size,
        quotes.length,
        `Repeated explanation in ${category} on ${date}`,
      );
      for (const match of data.result.matches) {
        assert.ok(
          match.contractor.description.includes(
            data.explanationEvidence[match.contractor.id].quote,
          ),
        );
        checked++;
      }
    }
  }
  assert.ok(checked > 60);
});

test("two-date responses expose the exact blocked identities, independently of the UI", async () => {
  const first = await runSearch(initialQuery, false);
  const second = await runSearch(
    { ...initialQuery, date: "2026-10-17" },
    false,
  );
  assert.notDeepEqual(
    first.result.matches.map((m) => m.contractor.id),
    second.result.matches.map((m) => m.contractor.id),
  );
  assert.ok(first.result.matches.some((m) => m.contractor.id === "HK-44923"));
  assert.ok(
    second.availability.busyCandidates.some((c) => c.id === "HK-44923"),
  );
  assert.ok(!second.result.matches.some((m) => m.contractor.id === "HK-44923"));
  for (const candidate of second.availability.busyCandidates)
    assert.ok(
      catalog
        .find((c) => c.id === candidate.id)
        ?.busy_dates.includes(second.query.date),
    );
});

test("source fragment extraction preserves source text and whole words", () => {
  const text =
    "Снимает на две камеры, документальный репортаж и естественный свет. " +
    "Аэрофотосъемка с дрона и обработка фотографий ".repeat(15);
  const fragments = sourceFragments(text);
  assert.ok(fragments.length > 1);
  for (const fragment of fragments) {
    assert.ok(text.includes(fragment));
    assert.ok(fragment.length <= 290);
  }
});
