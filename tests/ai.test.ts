import { test, after } from "node:test";
import assert from "node:assert/strict";
import { runSearch } from "../src/server/search-service";
import { initialQuery } from "../src/server/catalog";
import { estimatedCost } from "../src/server/openai";
import { checkRequest } from "../src/server/http";
import { search } from "../src/domain/matching";
import { catalog } from "../src/server/catalog";
import { individualQuotes } from "../src/domain/explanations";

const previousKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = "test-placeholder";
after(() => {
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
});

const envelope = (text: string) =>
  Response.json({
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text }] }],
    usage: { input_tokens: 100, output_tokens: 30 },
  });

test("AI cannot introduce candidates, change ranking, or insert fabricated profile facts", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () =>
    envelope(
      JSON.stringify({
        selections: [
          {
            id: "HK-44923",
            quote: "Гарантирует бесплатную работу и имеет премию Оскар",
          },
          { id: "invented", quote: "Вымышленная анкета" },
        ],
      }),
    ),
  );
  const query = { ...initialQuery, preferences: "проверка выдуманных цитат" };
  const result = await runSearch(query, true);
  assert.equal(mock.mock.callCount(), 1);
  assert.equal(result.explanationMode, "local");
  assert.ok(!JSON.stringify(result.explanations).includes("Оскар"));
  assert.deepEqual(
    result.result.matches.map((m) => m.contractor.id),
    search(catalog, query).matches.map((m) => m.contractor.id),
  );
});

test("valid quotations are accepted, identical requests are cached without another API charge", async (t) => {
  const query = {
    ...initialQuery,
    preferences: "индивидуальный подход; тест кеша",
  };
  const expected = search(catalog, query);
  const mock = t.mock.method(globalThis, "fetch", async () =>
    envelope(
      JSON.stringify({
        selections: expected.matches.map((m) => ({
          id: m.contractor.id,
          quote: individualQuotes(
            m.contractor,
            catalog.filter(
              (c) =>
                c.city === query.city && c.categories.includes(query.category),
            ),
            query,
          )[0].quote,
        })),
      }),
    ),
  );
  const first = await runSearch(query, true);
  const second = await runSearch(query, true);
  assert.equal(first.explanationMode, "ai");
  assert.equal(second.explanationMode, "ai");
  assert.equal(mock.mock.callCount(), 1);
  assert.equal(second.usage[0].cached, true);
  assert.equal(second.usage[0].estimatedCostUsd, 0);
  assert.equal(second.usage[0].inputTokens, 0);
  assert.deepEqual(first.explanations, second.explanations);
});

test("quota failure preserves usable deterministic results and is disclosed", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("quota", { status: 429 }),
  );
  const result = await runSearch(
    { ...initialQuery, preferences: "тест лимита API" },
    true,
  );
  assert.equal(result.result.status, "matched");
  assert.equal(result.explanationMode, "local");
  assert.match(result.notice ?? "", /лимит API/);
});

test("disabled AI and empty supply incur no model calls", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Must not call provider");
  });
  assert.equal((await runSearch(initialQuery, false)).usage.length, 0);
  assert.equal(
    (
      await runSearch(
        { ...initialQuery, category: "Несуществующая категория" },
        true,
      )
    ).result.status,
    "no_category",
  );
  assert.equal(mock.mock.callCount(), 0);
});

test("same browser host is accepted despite internal Next URL; cross-site origin is rejected", () => {
  assert.equal(
    checkRequest(
      new Request("http://localhost:3000/api/search", {
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      }),
    ),
    null,
  );
  assert.equal(
    checkRequest(
      new Request("http://localhost:3000/api/search", {
        headers: {
          host: "127.0.0.1:3000",
          origin: "https://unrelated.example",
        },
      }),
    )?.status,
    403,
  );
  assert.equal(
    checkRequest(
      new Request("http://localhost:3000/api/search", {
        headers: { origin: "null" },
      }),
    )?.status,
    403,
  );
});

test("cost calculation accounts for provider cached input and unknown model prices", () => {
  assert.equal(estimatedCost("gpt-5.4-nano", 1000000, 0, 1000000), 0.02);
  assert.equal(estimatedCost("unknown-model", 1000, 100), null);
});

test("a real but generic quote cannot replace individual evidence selected by the engine", async (t) => {
  const query = {
    ...initialQuery,
    preferences: "интеллигентный спокойный стиль, проверка общих фраз",
  };
  const match = search(catalog, query).matches.find(
    (m) => m.contractor.id === "HK-77838",
  )!;
  const generic =
    "Профессиональный ведущий с интеллигентной, располагающей и ненавязчивой подачей.";
  assert.ok(match.contractor.description.includes(generic));
  t.mock.method(globalThis, "fetch", async () =>
    envelope(
      JSON.stringify({
        selections: [{ id: match.contractor.id, quote: generic }],
      }),
    ),
  );
  const result = await runSearch(query, true);
  assert.notEqual(
    result.explanationEvidence[match.contractor.id].quote,
    generic,
  );
  assert.equal(
    result.explanationEvidence[match.contractor.id].selectedBy,
    "code",
  );
  assert.match(
    result.explanationEvidence[match.contractor.id].quote,
    /актёр театра/,
  );
});
