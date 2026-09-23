# Conversation and voice: implementation handoff

## Backend milestone, 23 September 2026

- `POST /api/brief`: `{message, brief, history?}` → partial validated brief, missing fields, next question and model usage. Uses `gpt-5.4-nano` with the `update_brief` tool. Missing dates/budgets stay missing. This endpoint never searches; the UI must ask for confirmation before `/api/search`.
- `POST /api/calendar`: partial brief → availability and minimum starting price for each day from 23 September through 31 December 2026. Requires city, category and event format. Language and duration remain hard filters; budget is shown separately. Prices are fixed per contractor: another day changes who is available, not their tariff.
- `POST /api/transcribe`: multipart `file`, max 8 MB → transcript and usage. Uses `gpt-4o-mini-transcribe`, configurable with `OPENAI_MODEL_TRANSCRIBE`. Audio is held in request memory only, never persisted or cached. Upload limits are enforced even without Content-Length. Text/audio token prices are different, so audio cost is left unknown until an applicable rate is verified.
- Search now supplies useful alternatives after successful results too: a higher budget must add eligible profiles; a nearby date must add choice or lower the minimum starting price. Every alternative reruns all constraints and changes one field only.
- The existing UI remains usable while the new conversation/voice interface is being integrated. The older `/api/agent` endpoint still supports the first MVP interface at this milestone.

## Validation

21 unit/integration tests pass, including all 100 catalog dates and missing-field extraction. Production build and TypeScript pass. A real nano request extracted a partial corporate-host request in approximately 2.2 seconds, left the missing date unset, and used about $0.00022 in estimated text-model cost. No secrets are included in the repository.

## UI acceptance criteria

Form left and conversation right on desktop; stacked on small screens. Voice is available from a fixed bottom button: first press records, second stops and sends. Recording/transcription/assistant updates must not focus fields or scroll the document. A notification allows an explicit jump to the updated brief. Results update only after confirmation. Manual edits made during processing must not be overwritten by a stale assistant response.

## References

- [OpenAI file transcription](https://developers.openai.com/api/docs/guides/speech-to-text)
- [GPT-4o mini transcribe](https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe)
- [MediaRecorder browser support checks](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)
