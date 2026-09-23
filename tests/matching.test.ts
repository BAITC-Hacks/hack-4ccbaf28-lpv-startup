import { test } from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/contractors.json";
import { search, alternatives, rejectionReasons } from "../src/domain/matching";
import { contractorSchema, querySchema } from "../src/domain/schema";
import type { Contractor, SearchQuery } from "../src/domain/types";

const q: SearchQuery = {
  city: "Алматы",
  date: "2026-10-15",
  category: "Ведущий",
  event_format: "корпоратив",
  budget_kzt: 1_000_000,
};
const fixture: Contractor = {
  id: "A",
  anon_name: "Тест",
  city: "Алматы",
  categories: ["Ведущий", "Ведущий церемонии"],
  price_from_kzt: 500000,
  event_formats: ["корпоратив"],
  languages: ["русский"],
  max_hours: 6,
  busy_dates: [],
  description: "Спокойная интеллигентная подача для камерных событий.",
  synthetic: true,
  city_imputed: false,
  price_imputed: false,
};

test("official catalog has 66 unique validated profiles and 13 synthetic profiles", () => {
  assert.equal(catalog.length, 66);
  assert.equal(new Set(catalog.map((c) => c.id)).size, 66);
  assert.equal(catalog.filter((c) => c.synthetic).length, 13);
  catalog.forEach((c) => contractorSchema.parse(c));
});
test("distinguishes absent category, rejected supply, and real matches", () => {
  assert.equal(search([], q).status, "no_category");
  assert.equal(search([fixture], { ...q, budget_kzt: 1 }).status, "no_matches");
  assert.equal(search([fixture], q).matches.length, 1);
});
test("all hard filters apply; exact budget/hours boundary is allowed", () => {
  assert.deepEqual(
    rejectionReasons(
      { ...fixture, busy_dates: [q.date] },
      {
        ...q,
        budget_kzt: 499999,
        event_format: "свадьба",
        language: "английский",
        hours: 7,
      },
    ),
    ["busy_date", "over_budget", "event_format", "language", "duration"],
  );
  assert.equal(
    search([fixture], { ...q, budget_kzt: 500000, hours: 6 }).status,
    "matched",
  );
  assert.equal(
    search([{ ...fixture, max_hours: null }], { ...q, hours: 24 }).status,
    "matched",
  );
});
test("matches array categories exactly, accepts normalized city, and never invents three results", () => {
  assert.equal(
    search([fixture], { ...q, city: " алматы ", category: "ведущий церемонии" })
      .matches.length,
    1,
  );
  assert.equal(
    search([fixture], { ...q, category: "Вед" }).status,
    "no_category",
  );
});
test("stable ranking is independent of input catalog order and limited to three", () => {
  const values = ["D", "B", "A", "C"].map((id) => ({ ...fixture, id }));
  assert.deepEqual(
    search(values, q).matches.map((m) => m.contractor.id),
    ["A", "B", "C"],
  );
  assert.deepEqual(search(values, q), search([...values].reverse(), q));
});
test("calendar and malformed numbers are rejected instead of claiming unknown availability", () => {
  for (const date of ["2026-02-30", "2026-09-22", "2027-01-01", "tomorrow"])
    assert.equal(querySchema.safeParse({ ...q, date }).success, false);
  assert.equal(querySchema.safeParse({ ...q, budget_kzt: NaN }).success, false);
  assert.equal(querySchema.safeParse({ ...q, hours: 0 }).success, false);
});
test("every returned profile across official calendar satisfies every requested constraint", () => {
  for (let day = 0; day < 100; day++) {
    const date = new Date(Date.UTC(2026, 8, 23 + day))
      .toISOString()
      .slice(0, 10);
    for (const c of catalog) {
      const request = {
        ...q,
        date,
        city: c.city,
        category: c.categories[0],
        event_format: c.event_formats[0],
        budget_kzt: c.price_from_kzt,
        language: c.languages[0],
        hours: c.max_hours ?? 4,
      };
      const found = search(catalog, request);
      for (const match of found.matches) {
        assert.deepEqual(rejectionReasons(match.contractor, request), []);
        assert.equal(match.contractor.city, request.city);
        assert.ok(match.contractor.categories.includes(request.category));
      }
    }
  }
});
test("alternative changes exactly one constraint and actually yields matches", () => {
  const input = { ...q, budget_kzt: 1 };
  for (const option of alternatives(catalog, input)) {
    assert.equal(search(catalog, option.query).status, "matched");
    const changed = Object.keys(input).filter(
      (key) =>
        input[key as keyof SearchQuery] !==
        option.query[key as keyof SearchQuery],
    );
    assert.deepEqual(changed, [
      option.kind === "budget" ? "budget_kzt" : "date",
    ]);
  }
});
