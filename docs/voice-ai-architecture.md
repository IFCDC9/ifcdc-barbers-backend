# Voice AI Architecture (IFCDC Barbers)

## End-to-end flow

Caller  
→ Twilio Voice  
→ Speech Input  
→ AI Conversation Brain  
→ Tool Router  
→ Business Tools / API  
→ Supabase Database  
→ AI Response Generator  
→ Natural Voice Output

## Tool router contract

Each detected intent maps to one tool call:

- `check_availability`
- `create_appointment`
- `reschedule_appointment`
- `get_barber_status`
- `get_queue_status`
- `add_to_queue`
- `send_sms`
- `send_email`

The tool result is then converted into a concise spoken response.

## API/tool mappings in this codebase

Current routes already support most tool calls:

- `check_availability` → `GET /api/appointments/availability/:date`
- `get_barber_status` → `GET /api/barber-status`
- `get_queue_status` → `GET /api/queue` and `GET /api/checkin`
- `add_to_queue` → `POST /api/queue` or `POST /api/checkin`
- `create_appointment` → `POST /api/appointments/create` (placeholder implementation)
- `reschedule_appointment` → not implemented yet
- `send_sms` → planned via Twilio SDK
- `send_email` → not implemented yet

## Runtime components

- Voice webhook entrypoint: `POST /api/voice/incoming`
- Speech processor: `POST /api/voice/process`
- Follow-up booking speech capture: `POST /api/voice/book`

## Suggested service boundaries

- `ConversationBrain`: intent + entities extraction (speech text -> structured intent)
- `ToolRouter`: executes business tool by intent
- `ResponseGenerator`: transforms tool output into concise voice-safe text

## Data and side effects

- Source of truth: Supabase Postgres via `src/db/db.js`
- Queue and status are read/write through existing routes
- Appointment write paths should be moved from placeholders to DB-backed logic for production voice booking

## Implementation checklist

1. Add intent schema (`intent`, `confidence`, `entities`) in conversation layer
2. Implement `ToolRouter` adapter over existing route logic/services
3. Add idempotency key for call retries (Twilio webhook retries)
4. Add audit log for tool calls and voice outcomes
5. Add safe fallback response when tool execution fails
6. Add `reschedule_appointment`, `send_sms`, `send_email` handlers
7. Add signature validation (`TWILIO_VALIDATE_SIGNATURE=true`) in production

## Voice UX guardrails

- Keep responses short (1–2 sentences)
- Ask one follow-up question at a time
- Confirm critical actions (booking/reschedule) before commit
- Always provide a recovery path (repeat, transfer, callback)
