import { describe, expect, it, vi } from "vitest";

// Force simulated outreach mode (no providers configured)
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    TWILIO_ACCOUNT_SID: undefined,
    TWILIO_AUTH_TOKEN: undefined,
    TWILIO_FROM_NUMBER: undefined,
    VAPI_API_KEY: undefined,
    VAPI_PHONE_NUMBER_ID: undefined,
    VAPI_ASSISTANT_ID: undefined,
  }),
}));

const updateMock = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
const insertMock = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "attempt-1" }, error: null })) })) }));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "backfill_attempts") {
        return {
          insert: insertMock,
          update: updateMock,
        };
      }
      return { insert: vi.fn(), update: vi.fn() };
    },
  }),
}));

vi.mock("@/lib/backfill/run", () => ({
  setRunChosenCaregiver: vi.fn(async () => {}),
}));

vi.mock("@/lib/backfill/audit", () => ({
  writeAudit: vi.fn(async () => {}),
}));

import { executeOutreach } from "@/lib/backfill/outreach";

describe("backfill.executeOutreach (simulated)", () => {
  it("creates attempt and marks it sent with simulated payload", async () => {
    const res = await executeOutreach({
      runId: "run-1",
      vacancy: {
        shiftId: "shift-1",
        clientId: "client-1",
        clientFirstName: "Mr",
        clientLastInitial: "S",
        clientLanguage: "en",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600_000).toISOString(),
        requiredSkills: ["Dementia"],
      },
      candidates: [
        {
          caregiver_id: "cg-1",
          caregiver_name: "Bob",
          phone_number: "+10000000001",
          distance_miles: 1,
          skills_overlap: ["Dementia"],
          has_mandatory_skills: true,
          reliability_score: 0.7,
          last_minute_accept_rate: 0.6,
          language_match: true,
        },
      ],
      ranked: [
        {
          caregiverId: "cg-1",
          finalScore: 0.9,
          featureScores: { distance: 0.9, skills: 1, reliability: 0.7, language: 1 },
          rationale: "test",
        },
      ],
    });

    expect(res?.attemptId).toBe("attempt-1");
    expect(insertMock).toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalled();
  });
});

