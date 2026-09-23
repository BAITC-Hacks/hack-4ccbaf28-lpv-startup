import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detailStrength,
  sourceFragments,
  individualQuotes,
  explanationFromQuote,
} from "../src/domain/explanations";
import { catalog, initialQuery, getMeta } from "../src/server/catalog";
import { runSearch } from "../src/server/search-service";
import { rank } from "../src/domain/matching";

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

test("metaphors and future promises never masquerade as equipment or years of experience", () => {
  assert.equal(
    detailStrength(
      "Через 10 лет вы откроете фотографии и вспомните этот день.",
    ),
    0,
  );
  assert.equal(
    detailStrength("Чувствую настроение зала и создаю атмосферу звуком."),
    0,
  );
  assert.ok(
    detailStrength(
      "Сняла более 80 мероприятий — от камерных до масштабных свадеб.",
    ) > 0,
  );
  assert.ok(detailStrength("Работаю фотографом более 12 лет.") > 0);
  const photographer = catalog.find((c) => c.id === "HK-98562")!;
  const quote = individualQuotes(photographer, catalog, {
    ...initialQuery,
    preferences: undefined,
  })[0].quote;
  assert.ok(!quote.includes("через 10 лет"));
});

test("concrete relevant evidence wins over unrelated impressive details", () => {
  const florist = catalog.find((c) => c.id === "HK-90001")!;
  const query = {
    ...initialQuery,
    category: "Флорист",
    preferences: "Сезонные цветы и цветовая палитра",
  };
  const quote = individualQuotes(
    {
      ...florist,
      description:
        florist.description +
        " Работаем с командой из 50 человек, используем дрон и мультимедийное оборудование.",
    },
    catalog,
    query,
  )[0];
  assert.match(quote.quote, /сезонными/);
  assert.equal(quote.relevant, true);
});

test("thin descriptions disclose missing evidence instead of recycling generic praise", () => {
  const profile = catalog.find((c) => c.id === "HK-76335")!;
  const query = {
    ...initialQuery,
    category: "Фотограф",
    preferences: undefined,
  };
  const option = individualQuotes(profile, catalog, query)[0];
  assert.equal(option.quality, "limited");
  const explanation = explanationFromQuote(
    rank(profile, query),
    query,
    option.quote,
  );
  assert.match(explanation, /мало конкретных отличий/);
  assert.ok(!explanation.includes("живые эмоции"));
});

test("a soft style conflict is disclosed even when all structured filters pass", () => {
  const profile = {
    ...catalog[0],
    description:
      "Если нужен тихий, формальный вечер, я вам не подойду. Мой стиль — динамика и конкурсы.",
    price_from_kzt: 100000,
  };
  const query = { ...initialQuery, preferences: "Ненавязчивый тихий вечер" };
  const explanation = explanationFromQuote(
    rank(profile, query),
    query,
    profile.description,
  );
  assert.match(explanation, /стиль может не подойти/);
});

test("duration is explained as a limit and null is not advertised as unlimited attendance", () => {
  const host = catalog.find((c) => c.id === "HK-44923")!;
  assert.match(
    explanationFromQuote(
      rank(host, initialQuery),
      initialQuery,
      individualQuotes(host, catalog, initialQuery)[0].quote,
    ),
    /6 ч при лимите 8 ч/,
  );
  const florist = { ...catalog[0], max_hours: null };
  const explanation = explanationFromQuote(
    rank(florist, initialQuery),
    initialQuery,
    florist.description,
  );
  assert.match(explanation, /часы присутствия к этой услуге не применяются/);
  assert.ok(!explanation.includes("без лимита"));
});
