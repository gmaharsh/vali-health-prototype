import { beforeEach, describe, expect, it, vi } from "vitest";

// Prevent env parsing (requires real secrets); provide minimal env for this module.
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    OPENAI_API_KEY: undefined,
    OPENAI_MODEL: "gpt-4o-mini",
  }),
}));

// Prevent real audit writes during tests
vi.mock("@/lib/backfill/audit", () => ({ writeAudit: vi.fn(async () => {}) }));

import { rankCandidates } from "@/lib/backfill/rankCandidates";
import type { CandidateRow, ShiftVacancy } from "@/lib/backfill/types";

describe("backfill.rankCandidates (deterministic fallback)", () => {
  beforeEach(() => {
    // ensure deterministic fallback path
    delete process.env.OPENAI_API_KEY;
  });

  it("chooses the best mandatory-qualified candidate", async () => {
    const vacancy: ShiftVacancy = {
      shiftId: "shift-1",
      clientId: "client-1",
      clientFirstName: "Mr",
      clientLastInitial: "S",
      clientLanguage: "en",
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600_000).toISOString(),
      requiredSkills: ["Dementia"],
    };

    const candidates: CandidateRow[] = [
      {
        caregiver_id: "a",
        caregiver_name: "A",
        phone_number: "+10000000001",
        distance_miles: 1,
        skills_overlap: ["Dementia"],
        has_mandatory_skills: true,
        reliability_score: 0.5,
        last_minute_accept_rate: 0.5,
        language_match: false,
      },
      {
        caregiver_id: "b",
        caregiver_name: "B",
        phone_number: "+10000000002",
        distance_miles: 0.5,
        skills_overlap: [],
        has_mandatory_skills: false,
        reliability_score: 1,
        last_minute_accept_rate: 1,
        language_match: true,
      },
    ];

    const out = await rankCandidates({ vacancy, candidates });
    expect(out.chosenCaregiverId).toBe("a");
    expect(out.ranked[0]?.caregiverId).toBe("a");
  });

  it("sets finalScore to 0 when missing mandatory skills", async () => {
    const vacancy: ShiftVacancy = {
      shiftId: "shift-2",
      clientId: "client-2",
      clientFirstName: "Ms",
      clientLastInitial: "J",
      clientLanguage: "en",
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600_000).toISOString(),
      requiredSkills: ["Dementia"],
    };

    const candidates: CandidateRow[] = [
      {
        caregiver_id: "x",
        caregiver_name: "X",
        phone_number: "+10000000003",
        distance_miles: 0.1,
        skills_overlap: [],
        has_mandatory_skills: false,
        reliability_score: 1,
        last_minute_accept_rate: 1,
        language_match: true,
      },
    ];

    const out = await rankCandidates({ vacancy, candidates });
    expect(out.ranked[0]?.finalScore).toBe(0);
  });
});

