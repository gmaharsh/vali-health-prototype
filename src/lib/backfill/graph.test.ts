import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/backfill/analyzeVacancy", () => ({
  analyzeVacancy: vi.fn(async () => ({
    shiftId: "shift-1",
    clientId: "client-1",
    clientFirstName: "Mr",
    clientLastInitial: "S",
    clientLanguage: "en",
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600_000).toISOString(),
    requiredSkills: ["Dementia"],
  })),
}));

vi.mock("@/lib/backfill/fetchCandidates", () => ({
  fetchCandidates: vi.fn(async () => [
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
  ]),
}));

vi.mock("@/lib/backfill/rankCandidates", () => ({
  rankCandidates: vi.fn(async () => ({
    chosenCaregiverId: "cg-1",
    safetyRedactionsApplied: ["client_name_minimized"],
    ranked: [
      {
        caregiverId: "cg-1",
        finalScore: 0.9,
        featureScores: { distance: 0.9, skills: 1, reliability: 0.7, language: 1 },
        rationale: "test",
      },
    ],
  })),
}));

vi.mock("@/lib/backfill/outreach", () => ({
  executeOutreach: vi.fn(async () => ({ attemptId: "attempt-1", channel: "sms", caregiverId: "cg-1" })),
}));

vi.mock("@/lib/backfill/escalate", () => ({
  escalateBackfillRun: vi.fn(async () => {}),
}));

import { runBackfillGraph } from "@/lib/backfill/graph";

describe("backfill graph wiring (integration-style)", () => {
  it("runs through to execute_outreach when a caregiver is chosen", async () => {
    const out = await runBackfillGraph({ shiftId: "shift-1", runId: "run-1" });
    expect(out.shiftId).toBe("shift-1");
    expect(out.chosenCaregiverId).toBe("cg-1");
    expect(out.lastAttemptId).toBe("attempt-1");
  });
});

