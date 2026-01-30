import "server-only";

import OpenAI from "openai";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import type { CandidateRow, RankedCandidate, ShiftVacancy } from "@/lib/backfill/types";
import { writeAudit } from "@/lib/backfill/audit";
import { clientLabel } from "@/lib/phi";

const WEIGHTS = {
  distance: 0.4,
  skills: 0.3,
  reliability: 0.2,
  language: 0.1,
} as const;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function deterministicRank(vacancy: ShiftVacancy, candidates: CandidateRow[]): RankedCandidate[] {
  const required = vacancy.requiredSkills;
  const requiredCount = Math.max(1, required.length);

  return [...candidates]
    .map((c) => {
      // Hard constraint: candidates missing mandatory requirements should never be selected.
      if (!c.has_mandatory_skills) {
        const reliabilityScore = clamp01(c.reliability_score);
        const languageScore = c.language_match ? 1 : 0;
        return {
          caregiverId: c.caregiver_id,
          finalScore: 0,
          featureScores: {
            distance: 0,
            skills: 0,
            reliability: reliabilityScore,
            language: languageScore,
          },
          rationale: [
            `Distance: ${c.distance_miles.toFixed(1)}mi`,
            "Skills: missing mandatory",
            `Reliability: ${(reliabilityScore * 100).toFixed(0)}%`,
            `Language: ${c.language_match ? "match" : "no match"}`,
          ].join(" • "),
        } satisfies RankedCandidate;
      }

      const distanceScore = clamp01(1 - Math.min(c.distance_miles / 10, 1));
      const overlap = c.skills_overlap ?? [];
      const overlapScore = clamp01(overlap.length / requiredCount);
      const skillsScore = overlapScore;
      const reliabilityScore = clamp01(c.reliability_score);
      const languageScore = c.language_match ? 1 : 0;
      const finalScore = clamp01(
        WEIGHTS.distance * distanceScore +
          WEIGHTS.skills * skillsScore +
          WEIGHTS.reliability * reliabilityScore +
          WEIGHTS.language * languageScore,
      );

      const rationale = [
        `Distance: ${c.distance_miles.toFixed(1)}mi`,
        `Skills: ${c.has_mandatory_skills ? "meets mandatory" : "missing mandatory"}`,
        `Reliability: ${(reliabilityScore * 100).toFixed(0)}%`,
        `Language: ${c.language_match ? "match" : "no match"}`,
      ].join(" • ");

      return {
        caregiverId: c.caregiver_id,
        finalScore,
        featureScores: {
          distance: distanceScore,
          skills: skillsScore,
          reliability: reliabilityScore,
          language: languageScore,
        },
        rationale,
      } satisfies RankedCandidate;
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

const LlmOutputSchema = z.object({
  chosenCaregiverId: z.string().min(1),
  safetyRedactionsApplied: z.array(z.string()).default([]),
  ranked: z
    .array(
      z.object({
        caregiverId: z.string().min(1),
        finalScore: z.number().min(0).max(1),
        featureScores: z.object({
          distance: z.number().min(0).max(1),
          skills: z.number().min(0).max(1),
          reliability: z.number().min(0).max(1),
          language: z.number().min(0).max(1),
        }),
        rationale: z.string().min(1),
      }),
    )
    .min(1),
});

export async function rankCandidates(input: {
  vacancy: ShiftVacancy;
  candidates: CandidateRow[];
}): Promise<{ ranked: RankedCandidate[]; chosenCaregiverId: string; safetyRedactionsApplied: string[] }> {
  const env = getEnv();

  // Fast deterministic fallback for local dev / no-LLM mode.
  if (!env.OPENAI_API_KEY) {
    const ranked = deterministicRank(input.vacancy, input.candidates);
    const chosenCaregiverId = ranked[0]?.caregiverId ?? "";
    const client = clientLabel({
      firstName: input.vacancy.clientFirstName,
      lastInitial: input.vacancy.clientLastInitial,
    });
    await writeAudit({
      action: "backfill.rank.deterministic",
      entityType: "shift",
      entityId: input.vacancy.shiftId,
      inputRedacted: {
        shiftId: input.vacancy.shiftId,
        client,
        requiredSkills: input.vacancy.requiredSkills,
        candidates: input.candidates.map((c) => ({
          caregiverId: c.caregiver_id,
          caregiverName: c.caregiver_name,
          distanceMiles: c.distance_miles,
          skillsOverlap: c.skills_overlap ?? [],
          hasMandatorySkills: c.has_mandatory_skills,
          reliabilityScore: c.reliability_score,
          languageMatch: c.language_match,
        })),
      },
      output: { chosenCaregiverId, ranked },
      rationale: "OPENAI_API_KEY not set; used deterministic scoring fallback.",
      metadata: { weights: WEIGHTS },
    });
    return { ranked, chosenCaregiverId, safetyRedactionsApplied: ["client_name_minimized"] };
  }

  const clientLabelText = clientLabel({
    firstName: input.vacancy.clientFirstName,
    lastInitial: input.vacancy.clientLastInitial,
  });

  const prompt = [
    "You are an operations-focused matching assistant for home-care shift backfilling.",
    "You MUST follow these rules:",
    "- Use the weighted scoring model exactly: distance 40%, skill match 30%, reliability 20%, language 10%.",
    "- If hasMandatorySkills is false, the candidate's finalScore must be 0.",
    "- Output ONLY valid JSON matching the requested schema; no markdown, no commentary.",
    "",
    "Shift (PHI-minimized):",
    `- client: ${clientLabelText}`,
    `- startTime: ${input.vacancy.startTime}`,
    `- requiredSkills: ${JSON.stringify(input.vacancy.requiredSkills)}`,
    "",
    "Candidates (do not assume any extra fields beyond these):",
    JSON.stringify(
      input.candidates.map((c) => ({
        caregiverId: c.caregiver_id,
        caregiverName: c.caregiver_name,
        distanceMiles: c.distance_miles,
        skillsOverlap: c.skills_overlap ?? [],
        hasMandatorySkills: c.has_mandatory_skills,
        reliabilityScore: c.reliability_score,
        languageMatch: c.language_match,
      })),
    ),
    "",
    "Return JSON with:",
    "{",
    '  \"chosenCaregiverId\": string,',
    '  \"safetyRedactionsApplied\": string[],',
    '  \"ranked\": [',
    "    {",
    '      \"caregiverId\": string,',
    '      \"finalScore\": number,',
    '      \"featureScores\": {\"distance\": number, \"skills\": number, \"reliability\": number, \"language\": number},',
    '      \"rationale\": string',
    "    }",
    "  ]",
    "}",
  ].join("\n");

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const resp = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: "You output strict JSON only." },
      { role: "user", content: prompt },
    ],
  });

  const content = resp.choices[0]?.message?.content ?? "";
  let parsed: z.infer<typeof LlmOutputSchema>;
  try {
    parsed = LlmOutputSchema.parse(JSON.parse(content));
  } catch (e) {
    // Fallback if model didn't comply.
    const ranked = deterministicRank(input.vacancy, input.candidates);
    const chosenCaregiverId = ranked[0]?.caregiverId ?? "";
    await writeAudit({
      action: "backfill.rank.llm_parse_failed",
      entityType: "shift",
      entityId: input.vacancy.shiftId,
      inputRedacted: { client: clientLabelText, requiredSkills: input.vacancy.requiredSkills },
      output: { chosenCaregiverId, ranked, llmRaw: content.slice(0, 4000) },
      rationale: e instanceof Error ? e.message : "LLM JSON parse failed",
      metadata: { weights: WEIGHTS },
    });
    return { ranked, chosenCaregiverId, safetyRedactionsApplied: ["client_name_minimized"] };
  }

  const ranked: RankedCandidate[] = parsed.ranked.map((r) => ({
    caregiverId: r.caregiverId,
    finalScore: clamp01(r.finalScore),
    featureScores: {
      distance: clamp01(r.featureScores.distance),
      skills: clamp01(r.featureScores.skills),
      reliability: clamp01(r.featureScores.reliability),
      language: clamp01(r.featureScores.language),
    },
    rationale: r.rationale,
  }));

  await writeAudit({
    action: "backfill.rank.llm",
    entityType: "shift",
    entityId: input.vacancy.shiftId,
    inputRedacted: {
      shiftId: input.vacancy.shiftId,
      client: clientLabelText,
      requiredSkills: input.vacancy.requiredSkills,
      candidates: input.candidates.map((c) => ({
        caregiverId: c.caregiver_id,
        caregiverName: c.caregiver_name,
        distanceMiles: c.distance_miles,
        skillsOverlap: c.skills_overlap ?? [],
        hasMandatorySkills: c.has_mandatory_skills,
        reliabilityScore: c.reliability_score,
        languageMatch: c.language_match,
      })),
    },
    output: { chosenCaregiverId: parsed.chosenCaregiverId, ranked },
    rationale: "LLM-ranked candidates using weighted scoring.",
    metadata: { weights: WEIGHTS, model: env.OPENAI_MODEL },
  });

  return {
    ranked,
    chosenCaregiverId: parsed.chosenCaregiverId,
    safetyRedactionsApplied: parsed.safetyRedactionsApplied,
  };
}

