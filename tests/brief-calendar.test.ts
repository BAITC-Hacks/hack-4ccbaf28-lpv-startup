import { test, after } from "node:test";
import assert from "node:assert/strict";
import {
  briefSchema,
  missingFields,
  canApplyBrief,
  sameBrief,
} from "../src/domain/brief";
import { querySchema } from "../src/domain/schema";
import { availabilityCalendar } from "../src/domain/calendar";
import {
  alternatives,
  search,
  rejectionReasons,
  normalize,
} from "../src/domain/matching";
import { catalog, initialQuery, getMeta } from "../src/server/catalog";
import { updateBrief } from "../src/server/brief-agent";
import { transcribe, validAudio } from "../src/server/transcribe";

const previousKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = "test-placeholder";
after(() => {
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
});

test("quick requests show their date, follow Almaty midnight, and remain explicit outside the catalog calendar", () => {
  const before = getMeta(new Date("2026-09-23T18:59:00Z"));
  const after = getMeta(new Date("2026-09-23T19:01:00Z"));
  for (const demo of before.demos) {
    assert.equal(demo.query.date, "2026-09-23");
    assert.match(demo.detail, /Сегодня, 23 сентября/);
    assert.equal(demo.query.language, undefined);
    assert.equal(demo.query.hours, undefined);
    assert.equal(demo.query.preferences, undefined);
    assert.ok(search(catalog, demo.query).matches.length <= 3);
  }
  for (const demo of after.demos) {
    assert.equal(demo.query.date, "2026-09-24");
    assert.match(demo.detail, /Сегодня, 24 сентября/);
  }
  for (const demo of getMeta(new Date("2027-01-01T12:00:00Z")).demos) {
    assert.ok(querySchema.safeParse(demo.query).success);
    assert.match(demo.detail, /Пример:.*2026/);
    assert.doesNotMatch(demo.detail, /Сегодня/);
  }
});

test("empty and partial briefs retain missing fields; invalid values never become defaults", () => {
  assert.equal(missingFields(briefSchema.parse({})).length, 5);
  assert.deepEqual(
    missingFields(briefSchema.parse({ city: "Алматы", category: "Ведущий" })),
    ["event_format", "date", "budget_kzt"],
  );
  assert.equal(briefSchema.safeParse({ date: "2026-02-30" }).success, false);
  assert.equal(briefSchema.safeParse({ budget_kzt: 0 }).success, false);
  assert.equal(canApplyBrief(3, 4), false);
  assert.equal(canApplyBrief(4, 4), true);
  assert.equal(
    sameBrief(
      { city: "Алматы", date: "2026-10-15" },
      { date: "2026-10-15", city: "Алматы", preferences: "" },
    ),
    true,
  );
  assert.equal(
    sameBrief(
      { city: "Алматы", date: "2026-10-15" },
      { city: "Алматы", date: "2026-10-17" },
    ),
    false,
  );
});

test("agent saves partial extraction without automatically searching or adding defaults", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      status: "completed",
      output: [
        {
          type: "function_call",
          name: "update_brief",
          arguments: JSON.stringify({
            brief: {
              city: "Алматы",
              category: "Ведущий",
              event_format: "корпоратив",
              date: null,
              budget_kzt: null,
              language: null,
              hours: null,
              preferences: "без конкурсов",
            },
            question: null,
          }),
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
  );
  const result = await updateBrief(
    "Нужен ведущий без конкурсов в Алматы на корпоратив",
    {},
  );
  assert.equal(mock.mock.callCount(), 1);
  assert.deepEqual(result.missing, ["date", "budget_kzt"]);
  assert.equal(result.brief.date, undefined);
  assert.equal(result.brief.budget_kzt, undefined);
  assert.equal("result" in result, false);
});

test("malformed tool arguments cannot bypass date validation or silently clear confirmed fields", async (t) => {
  let broken: unknown = {
    brief: { ...initialQuery, date: "2028-01-01" },
    question: null,
  };
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      status: "completed",
      output: [
        {
          type: "function_call",
          name: "update_brief",
          arguments: JSON.stringify(broken),
        },
      ],
    }),
  );
  await assert.rejects(() =>
    updateBrief("Тест недопустимой даты", initialQuery),
  );
  broken = { brief: { city: "Астана" }, question: null };
  await assert.rejects(() =>
    updateBrief("Тест пропущенных полей инструмента", initialQuery),
  );
});

test("calendar prices match available supply with all non-budget constraints for every date", () => {
  const calendar = availabilityCalendar(catalog, initialQuery);
  assert.equal(calendar.ready, true);
  assert.equal(calendar.days.length, 100);
  for (const day of calendar.days) {
    const q = { ...initialQuery, date: day.date, budget_kzt: 100_000_000 };
    const matches = catalog.filter(
      (c) =>
        normalize(c.city) === normalize(q.city) &&
        c.categories.some((v) => normalize(v) === normalize(q.category)) &&
        !rejectionReasons(c, q).length,
    );
    assert.equal(day.available, matches.length);
    assert.equal(
      day.minPrice,
      matches.length ? Math.min(...matches.map((c) => c.price_from_kzt)) : null,
    );
    assert.equal(
      day.withinBudget,
      matches.filter((c) => c.price_from_kzt <= initialQuery.budget_kzt).length,
    );
  }
  assert.equal(availabilityCalendar(catalog, { city: "Алматы" }).ready, false);
  const cheap = availabilityCalendar(catalog, {
    ...initialQuery,
    budget_kzt: 1,
  });
  assert.ok(cheap.days.some((d) => d.available > 0 && d.withinBudget === 0));
});

test("successful-result suggestions offer a measurable supply or price improvement", () => {
  const calendar = availabilityCalendar(catalog, initialQuery);
  const base = calendar.days.find((d) => d.date === initialQuery.date)!;
  for (const suggestion of alternatives(catalog, initialQuery)) {
    if (suggestion.kind === "budget")
      assert.ok(suggestion.eligible > base.withinBudget!);
    else {
      const day = calendar.days.find((d) => d.date === suggestion.query.date)!;
      assert.ok(
        day.withinBudget! > base.withinBudget! ||
          day.minPrice! < base.minPrice!,
      );
    }
    assert.equal(
      Object.keys(initialQuery).filter(
        (key) =>
          initialQuery[key as keyof typeof initialQuery] !==
          suggestion.query[key as keyof typeof initialQuery],
      ).length,
      1,
    );
  }
});

test("audio is validated before provider use, and transcription is never cached", async (t) => {
  assert.equal(
    validAudio(new File(["text"], "bad.txt", { type: "text/plain" })),
    false,
  );
  assert.equal(
    validAudio(new File([], "empty.webm", { type: "audio/webm" })),
    false,
  );
  const mock = t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      text: "Ведущий на корпоратив в Алматы",
      usage: { input_tokens: 100, output_tokens: 12 },
    }),
  );
  const file = new File(["mock-audio"], "voice.webm", {
    type: "audio/webm;codecs=opus",
  });
  const result = await transcribe(file);
  await transcribe(file);
  assert.equal(mock.mock.callCount(), 2);
  assert.equal(result.usage.model, "gpt-4o-mini-transcribe");
  assert.equal(result.usage.purpose, "transcribe");
  assert.equal(result.usage.cached, false);
  assert.equal(result.text, "Ведущий на корпоратив в Алматы");
});
