## Vali Health Prototype (Shift Backfilling)

This Next.js app is a focused prototype of the **Shift Backfilling** workflow:

- **Event-driven**: reacts to `shift.cancelled` events (no polling)
- **Matching**: Supabase/Postgres + PostGIS for proximity + eligibility filters
- **Brain**: LangGraph orchestrates candidate ranking + outreach + escalation
- **Comms**: Twilio (SMS) and optional Vapi (voice)
- **Compliance**: PHI-minimized prompts + append-only audit log

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
