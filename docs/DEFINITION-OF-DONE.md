# Definition of Done — live acceptance

The deliverable is the recommendation engine and a demonstrable AI mode for an existing aggregator. It operates on 186 profiles: the organizer's unchanged 66 profiles and 120 clearly labeled synthetic team profiles. The standalone local UI demonstrates integration; it is not a new marketplace or a claimed connection to the production aggregator.

## Automated checks

```sh
npm ci
npm run check
```

`check` runs formatting checks, tests, offline DoD scenarios, the structured query grid, type checking and the production build.

The offline evaluation requires no key. The private judge copy includes authorized organizer credentials in `.env`; to verify real LLM calls, run:

```sh
npm run verify:dod:live
# Optional reproducible JSON evidence:
npm run verify:dod:live -- --report docs/DOD-RESULTS.json
```

The live command fails if AI silently falls back on any matched scenario, if any response exceeds 10 seconds, if card order changes for repeated input, if an unavailable contractor appears, if a quote is absent from its source, or if the expected rare/empty scenarios differ. It does not pretend that automatic checks replace human evaluation of explanation usefulness.

## What to demonstrate to judges

Start-screen shortcuts explicitly display 15 October 2026 and search immediately. Chat selections appear inside their assistant answers; manual results appear below filters in the same dialog. Each search returns at most three cards, even when chat history contains several searches. Use **Ручной режим** for the exact acceptance parameters below.

| Requirement | Live action | Expected result |
| --- | --- | --- |
| Dense category, individual explanations | Open **Ручной режим**: Алматы, Ведущий, корпоратив, 15 October, 1 million ₸, русский, 6 hours, preferences «Интеллигентная, ненавязчивая подача и живой юмор»; confirm | Three cards for Алматы, 15 October, budget 1 million ₸; each has a different factual detail from its own description |
| Same request, same order | In **Ручной режим**, click **Найти до 3 вариантов** again without editing | Same IDs and order; repeated model request is cached |
| Two dates, changed availability | **Ручной режим** → date 17 October → confirm | Мицури Канроджи is excluded because that date is in their busy calendar; the UI explicitly explains the change |
| Rare category | **Ручной режим**: Алматы, Флорист, корпоратив, 15 October, 400,000 ₸, no language/hours constraints; confirm | One suitable florist; no invented second/third profile, with an explicit explanation that no other profile passes all constraints |
| Candidates exist but fail | Reuse all parameters from the dense-category scenario, reduce the budget to 10,000 ₸ and confirm | No matches, reasons and individually verified alternative changes |
| Category absent in city | **Ручной режим**: Зарубежье, Флорист, корпоратив, 15 October, 400,000 ₸ | Explicitly says the city has no such category; not an error or empty screen |
| Understandable pipeline | **Модели и расход API**, **Почему подходит и анкета** | Routing, measured tokens/time, hard-filter evidence and the original description are visible |

Two additional live cases verify hosts within 100,000 ₸ in Алматы (two cards) and Астана (three cards) on 15 October, without language/hours restrictions. Budget packages do not silently satisfy an eight-hour request. For venues on 14 November use 500,000 ₸ for two cards; all 17 Алматы venues are busy on 19 December.

## Non-interchangeable explanations

An explanation must contain a particular fact that can be traced to that contractor, beyond a generic statement that the budget or format fits. For the main demo the live evaluation selected:

- Мицури Канроджи: DJ, dance music and multimedia equipment mentioned in the profile.
- Буллма: events ranging from 8 people to business forums for 3,000 people.
- Хаул: theater/cinema, teaching acting, an ethno-rock band and television experience.

The engine first removes greeting/contact filler, identifies exact source fragments, and scores concrete details and vocabulary that distinguish each profile from peers. When concrete facts exist, generic self-praise is not offered to the LLM. The model selects only from this bounded list; invalid or overly generic selections fall back to the strongest local fact. No claim is promoted to independently verified truth: the text explicitly attributes it to the profile.

## Measured run

See `DOD-RESULTS.json` for exact parameters, identities, source facts, time, token usage and busy identities. On 23 September 2026 the real-API twelve-scenario run passed: 1.982 seconds maximum, 11 ms for the cached repeat, 1.040 seconds for the rare category. Estimated text-model cost for that evaluation: approximately $0.00496. Network and provider latency can vary; a 6.5-second model timeout preserves a deterministic local response if the provider is unavailable.

45 tests also cover malformed arguments, source checking, all 100 calendar dates, all hard constraints across the organizer's profiles, normalized matching, stable tie-breaking, API failures, local favorites validation and three result types. Shortlist comparisons for sparse profiles are checked separately: price differences, language uniqueness, tied fields and sole eligibility must follow the catalog fields.

## Scope boundaries

The complete requirement audit is in [SPEC-AUDIT.md](SPEC-AUDIT.md). An independent raw-field oracle checked 91,800 structured queries across all 100 dates, cities, categories and event formats at three budget levels; see [SPEC-CHECK-RESULTS.json](SPEC-CHECK-RESULTS.json). Seven descriptions lack a sufficiently specific distinction under the conservative heuristic. Those cards disclose limited evidence rather than inventing a unique advantage. Non-interchangeability is demonstrated on the live acceptance shortlists, not promised for every possible set of sparse profiles.

No booking, provider messages, payments, real reviews or invented contacts. Date prices mean the minimum fixed starting price among available profiles, not invented discounts. Generated photos are marked illustrations. No fine-tuning or vector infrastructure is needed for this 186-profile demo catalog. Voice is an input convenience; the engine remains independently usable through `/api/search`.
