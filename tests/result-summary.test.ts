import { test } from "node:test";
import assert from "node:assert/strict";
import { runSearch } from "../src/server/search-service";
import { initialQuery } from "../src/server/catalog";

test("rare supply explains its actual exclusion without hiding it behind a UI disclosure", async () => {
  const data = await runSearch(
    {
      ...initialQuery,
      category: "Флорист",
      budget_kzt: 400000,
      hours: undefined,
      language: undefined,
    },
    false,
  );
  assert.equal(data.result.matches.length, 1);
  assert.match(data.summary, /Анкет этой категории в городе: 2/);
  assert.match(data.summary, /не берут формат «корпоратив» — 1/);
});

test("all-busy venues are distinguished from absence and cannot be fixed by a larger budget", async () => {
  const data = await runSearch(
    {
      ...initialQuery,
      category: "Банкетный зал",
      date: "2026-12-19",
      budget_kzt: 10000000,
      hours: undefined,
      language: undefined,
    },
    false,
  );
  assert.equal(data.result.status, "no_matches");
  assert.match(data.summary, /Все анкеты.*\(7\).*заняты на 19.12.2026/);
  assert.match(data.summary, /Увеличение бюджета не освободит/);
  assert.ok(!data.alternatives.some((alt) => alt.kind === "budget"));
});

test("overlapping rejections are disclosed, never added as if they were different people", async () => {
  const data = await runSearch({ ...initialQuery, budget_kzt: 100000 }, false);
  assert.equal(data.result.status, "no_matches");
  assert.match(data.summary, /начальная цена выше 100\s000 ₸/);
  assert.match(data.summary, /У одной анкеты может быть несколько причин/);
});

test("an absent city-category pair stays explicit and incurs no invented alternatives", async () => {
  const data = await runSearch(
    { ...initialQuery, category: "Флорист", city: "Зарубежье" },
    false,
  );
  assert.equal(data.result.status, "no_category");
  assert.match(data.summary, /нет анкет категории «Флорист»/);
  assert.equal(data.alternatives.length, 0);
});
