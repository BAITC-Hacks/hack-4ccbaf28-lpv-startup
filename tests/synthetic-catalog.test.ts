import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { generateSyntheticCatalog } from "../scripts/synthetic-fixtures";
import {
  catalog,
  officialCatalog,
  teamCatalog,
  initialQuery,
} from "../src/server/catalog";
import {
  contractorSchema,
  CALENDAR_START,
  CALENDAR_END,
} from "../src/domain/schema";
import { search, rejectionReasons } from "../src/domain/matching";
import { individualQuotes } from "../src/domain/explanations";
import { runSearch } from "../src/server/search-service";

const budgetQuery = {
  city: "Алматы",
  category: "Ведущий",
  event_format: "корпоратив",
  date: "2026-10-15",
  budget_kzt: 100000,
};

test("expanded catalog preserves the organizer source and validates 120 reproducible team profiles", () => {
  assert.equal(
    createHash("sha256")
      .update(readFileSync("data/contractors.csv"))
      .digest("hex"),
    "6a724b6b7dfb5973343e68ba18dadb60fc807d87e3d78f03ee86fb26cb089f7d",
  );
  assert.equal(officialCatalog.length, 66);
  assert.equal(catalog.length, 186);
  assert.equal(new Set(catalog.map((c) => c.id)).size, 186);
  assert.deepEqual(catalog.slice(0, 66), officialCatalog);
  assert.deepEqual(generateSyntheticCatalog(), teamCatalog);
  assert.equal(teamCatalog.length, 120);
  assert.equal(new Set(teamCatalog.map((c) => c.description)).size, 120);
  for (const c of teamCatalog) {
    assert.ok(contractorSchema.safeParse(c).success);
    assert.equal(c.synthetic, true);
    assert.match(c.id, /^LPV-SYN-/);
    assert.equal(c.city_imputed, false);
    assert.equal(c.price_imputed, false);
  }
});

test("synthetic calendars retain autumn availability, December seasonality and distinct schedules", () => {
  assert.ok(new Set(teamCatalog.map((c) => c.busy_dates.join())).size > 110);
  for (const c of teamCatalog) {
    assert.equal(c.busy_dates.filter((d) => d < "2026-12-01").length, 28);
    assert.equal(c.busy_dates.filter((d) => d >= "2026-12-01").length, 23);
    assert.equal(new Set(c.busy_dates).size, 51);
    assert.ok(
      c.busy_dates.every((d) => d >= CALENDAR_START && d <= CALENDAR_END),
    );
    assert.ok(c.busy_dates.includes("2026-12-19"));
  }
});

test("added profiles have concrete individual source facts rather than interchangeable praise", () => {
  for (const c of teamCatalog) {
    const peers = catalog.filter(
      (p) =>
        p.city === c.city &&
        p.categories.some((category) => c.categories.includes(category)),
    );
    const option = individualQuotes(c, peers, {
      ...initialQuery,
      category: c.categories[0],
      preferences: undefined,
    })[0];
    assert.equal(option.quality, "specific", c.id);
    assert.ok(c.description.includes(option.quote));
    assert.ok(
      !peers.some((p) => p.id !== c.id && p.description.includes(option.quote)),
      `${c.id}: source fact must distinguish it within its category and city`,
    );
  }
});

test("budget hosts are discoverable in both cities without silently relaxing hours or language", async () => {
  for (const city of ["Алматы", "Астана"]) {
    const query = { ...budgetQuery, city };
    const data = await runSearch(query, false);
    assert.equal(data.result.status, "matched");
    assert.ok(
      data.result.matches.length >= 2 && data.result.matches.length <= 3,
    );
    for (const m of data.result.matches) {
      assert.ok(m.contractor.price_from_kzt <= 100000);
      assert.deepEqual(rejectionReasons(m.contractor, query), []);
      assert.equal(
        data.explanationEvidence[m.contractor.id].quality,
        "specific",
      );
      assert.equal(m.contractor.synthetic, true);
    }
    assert.equal(search(catalog, { ...query, hours: 8 }).status, "no_matches");
    assert.equal(
      search(catalog, { ...query, language: "французский" }).status,
      "no_matches",
    );
  }
});

test("expansion preserves rare, absent and exhausted categories without padding or budget tricks", async () => {
  const rare = await runSearch(
    { ...budgetQuery, category: "Флорист", budget_kzt: 400000 },
    false,
  );
  assert.equal(rare.result.matches.length, 1);
  assert.equal(
    search(catalog, { ...budgetQuery, category: "Флорист", city: "Зарубежье" })
      .status,
    "no_category",
  );
  assert.equal(
    search(catalog, { ...budgetQuery, budget_kzt: 10000 }).status,
    "no_matches",
  );
  const busy = await runSearch(
    {
      ...budgetQuery,
      category: "Банкетный зал",
      date: "2026-12-19",
      budget_kzt: 10000000,
    },
    false,
  );
  assert.equal(busy.result.status, "no_matches");
  assert.equal(busy.availability.busyCandidates.length, 17);
  assert.match(busy.summary, /Все анкеты.*заняты/);
  assert.ok(!busy.alternatives.some((a) => a.kind === "budget"));
});

test("expanded results stay deterministic and respect optional filters across cities and dates", () => {
  for (const city of ["Алматы", "Астана"])
    for (const category of new Set(teamCatalog.flatMap((c) => c.categories)))
      for (const date of [
        "2026-09-23",
        "2026-10-15",
        "2026-11-14",
        "2026-12-19",
        "2026-12-31",
      ]) {
        const query = {
          ...budgetQuery,
          city,
          category,
          date,
          budget_kzt: 1000000,
          language: "русский",
          hours: 4,
        };
        const a = search(catalog, query);
        assert.deepEqual(search([...catalog].reverse(), query), a);
        assert.ok(a.matches.length <= 3);
        for (const match of a.matches)
          assert.deepEqual(rejectionReasons(match.contractor, query), []);
      }
});
