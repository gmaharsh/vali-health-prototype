import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { setRunStatus } from "@/lib/backfill/run";
import { writeAudit } from "@/lib/backfill/audit";

export type BackfillDecision = "accepted" | "declined" | "no_answer";

export async function processResponse(input: {
  attemptId: string;
  decision: BackfillDecision;
  raw?: unknown;
}): Promise<{ runId: string; shiftId: string; caregiverId: string | null }> {
  const supabase = getSupabaseAdmin();

  const { data: attempt, error } = await supabase
    .from("backfill_attempts")
    .select("id, run_id, caregiver_id")
    .eq("id", input.attemptId)
    .single();

  if (error || !attempt) throw new Error(`processResponse: attempt load failed: ${error?.message ?? "no data"}`);

  const attemptId = attempt.id as string;
  const runId = attempt.run_id as string;
  const caregiverId = attempt.caregiver_id as string;

  const { data: run, error: runErr } = await supabase
    .from("backfill_runs")
    .select("id, shift_id")
    .eq("id", runId)
    .single();

  if (runErr || !run) throw new Error(`processResponse: run load failed: ${runErr?.message ?? "no data"}`);
  const shiftId = run.shift_id as string;

  await supabase
    .from("backfill_attempts")
    .update({
      status: input.decision,
      responded_at: new Date().toISOString(),
      raw_response: input.raw ?? null,
    })
    .eq("id", attemptId);

  if (input.decision === "accepted") {
    const { error: shiftErr } = await supabase
      .from("shifts")
      .update({ caregiver_id: caregiverId, status: "filled" })
      .eq("id", shiftId);
    if (shiftErr) throw new Error(`processResponse: shift update failed: ${shiftErr.message}`);

    await setRunStatus({ runId, status: "filled" });

    await writeAudit({
      action: "backfill.response.accepted",
      entityType: "backfill_attempt",
      entityId: attemptId,
      inputRedacted: { runId, shiftId, caregiverId },
      output: { decision: input.decision },
      rationale: "Caregiver accepted; shift assigned and run marked filled.",
    });
  } else {
    await writeAudit({
      action: `backfill.response.${input.decision}`,
      entityType: "backfill_attempt",
      entityId: attemptId,
      inputRedacted: { runId, shiftId, caregiverId },
      output: { decision: input.decision },
      rationale: "Caregiver did not accept; run continues to next candidate.",
    });
  }

  return { runId, shiftId, caregiverId };
}

