import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { catalog, initialQuery } from "../src/server/catalog";
import { runSearch } from "../src/server/search-service";
import { rejectionReasons } from "../src/domain/matching";
import type { SearchResponse } from "../src/domain/api";

async function main() {
  const live = process.argv.includes("--live");
  if (live && !process.env.OPENAI_API_KEY)
    throw new Error(
      "Live evaluation requires OPENAI_API_KEY; load .env.local explicitly.",
    );
  const rare = {
    city: "Алматы",
    date: "2026-10-15",
    category: "Флорист",
    event_format: "корпоратив",
    budget_kzt: 400000,
    preferences: "Авторское цветочное оформление",
  };
  const cases = [
    { name: "dense-autumn", query: initialQuery, status: "matched" },
    { name: "same-request-repeat", query: initialQuery, status: "matched" },
    {
      name: "same-request-another-date",
      query: { ...initialQuery, date: "2026-10-17" },
      status: "matched",
    },
    { name: "rare-category", query: rare, status: "matched" },
    {
      name: "existing-supply-no-matches",
      query: { ...initialQuery, budget_kzt: 10000 },
      status: "no_matches",
    },
    {
      name: "no-category-in-city",
      query: { ...rare, city: "Зарубежье" },
      status: "no_category",
    },
    {
      name: "dense-photographers",
      query: {
        city: "Алматы",
        date: "2026-10-15",
        category: "Фотограф",
        event_format: "свадьба",
        budget_kzt: 2000000,
        preferences: "Репортаж, естественные кадры без постановки",
      },
      status: "matched",
    },
    {
      name: "venues-two-results",
      query: {
        city: "Алматы",
        date: "2026-11-14",
        category: "Банкетный зал",
        event_format: "корпоратив",
        budget_kzt: 500000,
      },
      status: "matched",
    },
    {
      name: "venues-all-busy-december",
      query: {
        city: "Алматы",
        date: "2026-12-19",
        category: "Банкетный зал",
        event_format: "корпоратив",
        budget_kzt: 10000000,
      },
      status: "no_matches",
    },
    {
      name: "rare-two-results",
      query: {
        city: "Алматы",
        date: "2026-09-23",
        category: "Декоратор",
        event_format: "корпоратив",
        budget_kzt: 10000000,
      },
      status: "matched",
    },
    ...["Алматы", "Астана"].map((city) => ({
      name: city === "Алматы" ? "budget-hosts-almaty" : "budget-hosts-astana",
      query: {
        city,
        date: "2026-10-15",
        category: "Ведущий",
        event_format: "корпоратив",
        budget_kzt: 100000,
      },
      status: "matched",
    })),
  ] as const;
  const responses: SearchResponse[] = [];
  const rows = [];
  for (const scenario of cases) {
    const data = await runSearch(scenario.query, live);
    assert.equal(data.result.status, scenario.status, scenario.name);
    assert.ok(data.elapsedMs < 10000, `${scenario.name}: exceeded 10 seconds`);
    assert.ok(data.result.matches.length <= 3);
    assert.ok(data.summary.length > 20);
    if (data.result.status !== "matched") assert.equal(data.usage.length, 0);
    if (live && data.result.status === "matched")
      assert.equal(
        data.explanationMode,
        "ai",
        `${scenario.name}: must exercise the real model`,
      );
    const evidence = data.result.matches.map((match) => {
      assert.deepEqual(rejectionReasons(match.contractor, scenario.query), []);
      const quote = data.explanationEvidence[match.contractor.id].quote;
      assert.ok(match.contractor.description.includes(quote));
      assert.equal(
        data.explanationEvidence[match.contractor.id].quality,
        "specific",
        `${scenario.name}: the demo must have concrete individual facts`,
      );
      assert.ok(
        !data.result.matches.some(
          (other) =>
            other.contractor.id !== match.contractor.id &&
            other.contractor.description.includes(quote),
        ),
        "Evidence must identify a unique profile within the shortlist",
      );
      return {
        id: match.contractor.id,
        name: match.contractor.anon_name,
        individualFact: quote,
        quality: data.explanationEvidence[match.contractor.id].quality,
        explanation: data.explanations[match.contractor.id],
      };
    });
    responses.push(data);
    rows.push({
      scenario: scenario.name,
      query: data.query,
      status: data.result.status,
      summary: data.summary,
      ids: data.result.matches.map((m) => m.contractor.id),
      elapsedMs: data.elapsedMs,
      explanationMode: data.explanationMode,
      usage: data.usage,
      notice: data.notice,
      evidence,
      busyOnDate: data.availability.busyCandidates,
    });
    console.log(
      `${scenario.name}: ${data.result.status}, ${data.result.matches.length} cards, ${data.elapsedMs} ms, ${data.explanationMode}`,
    );
  }
  assert.deepEqual(
    rows[0].ids,
    rows[1].ids,
    "Same request must preserve order",
  );
  assert.notDeepEqual(
    rows[0].ids,
    rows[2].ids,
    "The chosen date pair must change the shortlist",
  );
  const excluded = responses[0].result.matches.filter((m) =>
    m.contractor.busy_dates.includes(responses[2].query.date),
  );
  assert.ok(excluded.length > 0);
  for (const profile of excluded) {
    assert.ok(!rows[2].ids.includes(profile.contractor.id));
    assert.ok(rows[2].busyOnDate.some((c) => c.id === profile.contractor.id));
  }
  assert.equal(
    responses[3].result.matches.length,
    1,
    "Rare category must not invent a second or third match",
  );
  assert.equal(
    responses[7].result.matches.length,
    2,
    "Venue calendars must constrain the shortlist too",
  );
  assert.equal(
    responses[9].result.matches.length,
    2,
    "A rare category must not be padded to three",
  );
  assert.equal(responses[8].availability.busyCandidates.length, 17);
  assert.match(responses[8].summary, /Все анкеты.*заняты/);
  assert.ok(
    !responses[8].alternatives.some((a) => a.kind === "budget"),
    "A larger budget cannot free a busy venue",
  );
  if (live) {
    assert.equal(
      responses[0].explanationMode,
      "ai",
      "Live evaluation must really exercise AI, not silently pass on fallback",
    );
    assert.ok(responses[1].usage.every((u) => u.cached));
  }
  const report = {
    checkedAt: new Date().toISOString(),
    mode: live ? "live-api" : "offline",
    catalogSize: catalog.length,
    catalogBreakdown: { organizer: 66, teamSynthetic: 120 },
    passed: true,
    repeatOrder: true,
    busyIdentityExplained: excluded.map((m) => m.contractor.id),
    maximumResponseMs: Math.max(...rows.map((r) => r.elapsedMs)),
    scenarios: rows,
    limitation:
      "Unique source quotes and hard constraints are checked automatically. Human evaluation still assesses how useful and relevant each explanation is.",
  };
  const reportFlag = process.argv.indexOf("--report");
  if (reportFlag !== -1 && process.argv[reportFlag + 1])
    await writeFile(
      process.argv[reportFlag + 1],
      JSON.stringify(report, null, 2) + "\n",
    );
  console.log(
    `PASS: ${cases.length} scenarios; stable order; date exclusion; rare supply; three outcomes; individual source facts; venue calendars and December exhaustion. Max ${report.maximumResponseMs} ms.`,
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Evaluation failed");
  process.exitCode = 1;
});
