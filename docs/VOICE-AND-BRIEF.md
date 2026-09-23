# Conversation and voice: implementation handoff

## Backend milestone, 23 September 2026

- `POST /api/brief`: `{message, brief, history?}` → partial validated brief, missing fields, next question and model usage. Uses `gpt-5.4-nano` with the `update_brief` tool. Missing dates/budgets stay missing. This endpoint never searches; the UI must ask for confirmation before `/api/search`.
- `POST /api/calendar`: partial brief → availability and minimum starting price for each day from 23 September through 31 December 2026. Requires city, category and event format. Language and duration remain hard filters; budget is shown separately. Prices are fixed per contractor: another day changes who is available, not their tariff.
- `POST /api/transcribe`: multipart `file`, max 8 MB → transcript and usage. Uses `gpt-4o-mini-transcribe`, configurable with `OPENAI_MODEL_TRANSCRIBE`. Audio is held in request memory only, never persisted or cached. Upload limits are enforced even without Content-Length. Text/audio token prices are different, so audio cost is left unknown until an applicable rate is verified.
- Search now supplies useful alternatives after successful results too: a higher budget must add eligible profiles; a nearby date must add choice or lower the minimum starting price. Every alternative reruns all constraints and changes one field only.
- The UI is an AI mode intended for an existing aggregator: a familiar chat with result cards attached to answers, a manual filter/results dialog, and shared local browser favorites. No integration with a live aggregator is claimed.

## Validation

21 unit/integration tests pass, including all 100 catalog dates and missing-field extraction. Production build and TypeScript pass. A real nano request extracted a partial corporate-host request in approximately 2.2 seconds, left the missing date unset, and used about $0.00022 in estimated text-model cost. No secrets are included in the repository.

## UI acceptance criteria

One conversation on desktop and mobile, with up to three cards per search answer. Manual mode has independent filters and results below them in one dialog. Favorites open in a shared dialog from the header. Voice is available inside the chat composer beside Send (the floating button was removed): first press records, second stops and sends. Recording/transcription/assistant updates must not focus fields or scroll the document. A notification allows an explicit jump to the updated brief. Results update only after confirmation. Manual edits made during processing must not be overwritten by a stale assistant response.

## References

- [OpenAI file transcription](https://developers.openai.com/api/docs/guides/speech-to-text)
- [GPT-4o mini transcribe](https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe)
- [MediaRecorder browser support checks](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)

## Verified UI milestone

Production build, 22 tests, and TypeScript pass. Desktop and 390×844 mobile interfaces were inspected in a real browser. Live AI search returned in 2.82 seconds; a selected favorite survived reload. A 7.47-second synthetic Russian recording was transcribed by the real audio API in 2.93 seconds; it retained event date, budget and style. The user’s physical microphone was not recorded during validation. The recorder includes permission/unsupported-browser errors, a 60-second limit, cancellation, stream cleanup, and session IDs preventing stale permission responses from starting cancelled recordings.

Current local checks include 45 tests and 91,800 structured queries. The team also recorded twelve live Definition of Done scenarios; see [DEFINITION-OF-DONE.md](DEFINITION-OF-DONE.md) and [SPEC-AUDIT.md](SPEC-AUDIT.md). Explicit start-screen quick requests display 15 October 2026, city and budget and search on click; conversational drafts still require confirmation. Portrait illustrations are circular face crops; venue/work images remain rectangular. The earlier voice measurements above remain historical evidence, not a new physical-microphone test.
