## Vali Health Prototype (Shift Backfilling)

This Next.js app is a focused prototype of the **Shift Backfilling** workflow:

- **Event-driven**: reacts to `shift.cancelled` events (no polling)
- **Matching**: Supabase/Postgres + PostGIS for proximity + eligibility filters
- **Brain**: LangGraph orchestrates candidate ranking + outreach + escalation
- **Comms**: Twilio (SMS) and optional Vapi (voice)
- **Compliance**: PHI-minimized prompts + append-only audit log

## Why this architecture (in detail)

This workflow looks simple (“text the next caregiver”), but home care backfilling is a real-time, high-stakes coordination problem. The architecture exists to make the system **fast, reliable, explainable, and safe**:

- **Event-driven (no polling)**: cancellations must trigger action immediately; polling introduces delay and duplicate work.
- **DB-first matching**: eligibility filters (distance, availability, mandatory skills) must be deterministic and enforced by the database.
- **Workflow brain (LangGraph)**: backfilling is a state machine (analyze → fetch → rank → outreach → response → escalate), not a single LLM call.
- **Durable orchestration (Inngest)**: retries, idempotency, and the 15-minute escalation timer must survive serverless restarts.
- **Comms (Twilio/Vapi)**: the “hard part” is closing the loop with humans via SMS/voice and turning responses into system state.
- **Compliance**: prompts must be PHI-minimized, and every decision must be audit-logged.

For full technical detail, see: `docs/LLD_SHIFT_BACKFILLING.md`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Create a `.env.local` from `.env.example`, then start editing `src/app/page.tsx`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Local development notes

- Supabase SQL is in `supabase/migrations/`.
- Webhooks (Twilio/Vapi/Inngest) are implemented as Next.js route handlers under `src/app/api/`.
