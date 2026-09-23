# Recommendation engine integration

The core matcher in `src/domain/matching.ts` and quote selector in `src/domain/explanations.ts` are ordinary TypeScript functions, independent of React or Next.js. The Next route is an adapter. Replace the static catalog adapter with the aggregator's approved dataset to integrate it.

## `POST /api/search`

```json
{
  "query": {
    "city": "Алматы",
    "date": "2026-10-15",
    "event_format": "корпоратив",
    "category": "Ведущий",
    "budget_kzt": 1000000,
    "language": "русский",
    "hours": 6,
    "preferences": "Интеллигентная, ненавязчивая подача и живой юмор"
  },
  "useAI": true
}
```

Category means the service provider type: host, photographer, florist, banquet hall, etc. Event format means wedding, corporate event, conference, birthday, etc. The aggregator can pass its already selected city/event format into this query or the draft endpoint, without asking the customer twice.

Response fields:

- `result.status`: `matched`, `no_category` or `no_matches`; at most three matches.
- `result.matches`: catalog profile, deterministic score and verifiable evidence. Only city/category candidates passing date, price, format, language and duration constraints can enter this array.
- `explanations[id]`: brief explanation with hard facts and a distinctive exact source fragment.
- `explanationEvidence[id]`: the exact fragment, its `description` source, and whether code or model selected it.
- `availability`: requested date and IDs/names explicitly blocked by that date's calendar. Other hard failures can overlap.
- `alternatives`: individually rechecked one-field changes that add eligible choices or lower the minimum available price. Applying an alternative requires an explicit user action.
- `usage`, `trace`, `elapsedMs`, `explanationMode`, optional `notice`: measured routing/cost information and disclosed AI fallback.

Hard constraints and ordering are never delegated to the model. Eligibility is exact; style ranking is a transparent limited lexical/facet heuristic, not an opaque claim of semantic perfection. Equal scores break by catalog ID. Unknown city/category does not silently become a known one. The calendar is bounded by the supplied data: 23 September–31 December 2026.

## Conversation and voice adapters

`POST /api/brief` takes `{message, brief, history?}` and returns a partial validated draft plus missing fields and a clarification. Missing facts stay missing. The LLM calls `update_brief`; the endpoint never searches. The UI confirms the draft and then calls `/api/search`.

`POST /api/calendar` takes a partial brief and returns 100 days of available counts, minimum starting prices and counts within budget. It does not call a model.

`POST /api/transcribe` accepts multipart `file`, up to 8 MB. The server forwards it to `gpt-4o-mini-transcribe` and returns text and usage. It does not store recordings. The earlier MVP `/api/agent` route was removed to keep one explicit draft → confirmation → search flow.

## Model and performance policy

- `gpt-5.4-nano`: natural-language draft extraction and simple quote selection.
- `gpt-5.4-mini`: selection of individual facts when style requirements or combined language/duration require more context.
- `gpt-4o-mini-transcribe`: bounded recorded speech.
- No LLM for filtering, ranking, calendars, alternatives or empty results.
- Cache equivalent provider requests for 30 minutes, coalesce concurrent identical requests, and never cache recordings.
- Model names are configurable server-side; keys never enter the client or the repository.

The supplied host binds to localhost. Production authentication, per-user quotas and the aggregator's storage/consent policy belong to deployment integration; this prototype does not claim a public multi-user deployment.
