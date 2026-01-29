import "server-only";

import { z } from "zod";

const EnvSchema = z.object({
  // Base URLs
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // LLM (optional: system runs with deterministic fallback if unset)
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),

  // Demo knobs (optional)
  DEMO_CAREGIVER_PHONE: z.string().min(1).optional(),

  // Inngest (optional for local boot; required if you want to emit events / run jobs)
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),

  // Twilio (optional for local boot; required for SMS sending/escalation)
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_FROM_NUMBER: z.string().min(1).optional(),

  // Vapi (voice gateway)
  VAPI_API_KEY: z.string().min(1).optional(),
  VAPI_PHONE_NUMBER_ID: z.string().min(1).optional(),
  VAPI_ASSISTANT_ID: z.string().min(1).optional(),
  VAPI_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Escalation target (human manager)
  MANAGER_PHONE_NUMBER: z.string().min(1).optional(),
});

let cached: z.infer<typeof EnvSchema> | undefined;

/**
 * Lazy env parsing.
 *
 * Next.js evaluates route modules during build; parsing eagerly would fail builds
 * unless all secrets are present. Call this inside request handlers / server actions.
 */
export function getEnv() {
  if (!cached) cached = EnvSchema.parse(process.env);
  return cached;
}

