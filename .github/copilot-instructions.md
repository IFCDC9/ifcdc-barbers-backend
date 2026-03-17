# Copilot Instructions — IFCDC Barbers Backend

## Big picture
- This is an ESM Node backend (`"type": "module"`) with Express + Socket.IO + Twilio voice flows; entrypoint: `src/server.js`.
- Main architecture centers on voice automation: Twilio webhooks/TwiML in `src/routes/voiceRoutes.js`, AI orchestration in `src/services/aiReceptionist.js`, intent parsing in `src/services/conversationBrain.js`, and business execution in `src/services/toolRouter.js`.
- There is also a separate Expo mobile app under `mobile/`; root scripts run backend only.

## Voice + AI data flow (critical)
- Call flow: `/api/voice/incoming` (or `/api/voice/realtime/incoming`) → `callSid` session in `src/services/callSession.js` → speech handling at `/api/voice/process`.
- `voiceRoutes` prefers deterministic handling first for booking/cancel/reschedule, then falls back to `processCustomerRequest()`, then to OpenAI chat (`getAIResponse()`) on errors.
- Realtime path uses Twilio Media Streams WS bridge (`src/services/realtimeVoiceBridge.js`) and OpenAI Realtime API.

## Multi-tenant + scoping conventions
- Shop context is inferred from called number (`req.body.To`) via `resolveShop()` in `src/services/shopService.js`.
- Persist `{ shopId, shop }` in call session and pass `entities.shopId` into tools/queries to avoid cross-shop reads/writes.
- Quota/backoff is shop-scoped (`Map` keyed by `shopId`) in both `aiBrain.js` and `aiReceptionist.js`.

## Tool routing contract (do not break)
- `routeTool({ intent, entities })` in `src/services/toolRouter.js` is the switchboard for booking, queue, barber status, SMS, reschedule, cancel.
- For conversational actions (`create_appointment`, `reschedule_appointment`, `cancel_appointment`), return:
  - `{ responseText, needsMoreInfo, updatedEntities }`
- `aiReceptionist` stores in-progress action state in `pendingActionByCallSid`; follow-up prompts depend on this state machine.

## Schema/runtime compatibility patterns
- DB access is `pg` Pool in `src/db/db.js` (default pool size is intentionally low: `PG_POOL_MAX` defaults to `1`).
- Runtime schema discovery is used for resilience (`getAppointmentsColumnConfig`, `getUsersColumnConfig`) because deployed schemas can vary.
- Still, some writes assume concrete columns (e.g., inserts into `appointments`, `queue`); confirm against `src/db/schema.sql` before refactors.

## Dev workflows
- Backend dev: `npm run dev` (with `predev` that kills process on port 3000).
- Backend prod-style run: `npm start`.
- No root test script exists; validate via endpoint and Twilio voice-flow checks.
- For webhooks in local dev, set `VOICE_WEBHOOK_BASE_URL` (or use ngrok).

## Integrations + env
- Required: `DATABASE_URL`, `OPENAI_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`.
- Optional/behavior flags: `TWILIO_VALIDATE_SIGNATURE=true`, `VOICE_WEBHOOK_BASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENAI_TIMEOUT_MS`, `OPENAI_QUOTA_BACKOFF_MS`.
- Twilio signature validation is gated in `voiceRoutes`: only enforced when `TWILIO_VALIDATE_SIGNATURE === "true"`.

## Where to edit quickly
- TwiML prompts/retries/end-call telemetry: `src/routes/voiceRoutes.js` (`VOICE_PROCESS_METRICS`, gather loop).
- Intent/entity extraction rules: `src/services/conversationBrain.js`.
- AI fallback/backoff behavior: `src/services/aiBrain.js`, `src/services/aiReceptionist.js`.
- Booking/queue/SMS business logic + DB writes: `src/services/toolRouter.js`.
