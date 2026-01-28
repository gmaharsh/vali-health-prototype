import "server-only";

import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/comms/twilio";
import { setRunStatus } from "@/lib/backfill/run";
import { writeAudit } from "@/lib/backfill/audit";

export async function escalateBackfillRun(input: { runId: string; reason: string }) {
  const env = getEnv();
  const supabase = getSupabaseAdmin();

  const { data: run, error } = await supabase
    .from("backfill_runs")
    .select("id, shift_id")
    .eq("id", input.runId)
    .single();

  if (error || !run) throw new Error(`escalateBackfillRun: run load failed: ${error?.message ?? "no data"}`);

  await setRunStatus({ runId: input.runId, status: "escalated" });

  if (env.MANAGER_PHONE_NUMBER) {
    await sendSms({
      toE164: env.MANAGER_PHONE_NUMBER,
      body: `Vali Backfill Escalation: No acceptance for shift ${run.shift_id} within deadline. Reason: ${input.reason}`,
    });
  }

  await writeAudit({
    action: "backfill.escalate",
    entityType: "backfill_run",
    entityId: input.runId,
    inputRedacted: { runId: input.runId, shiftId: run.shift_id },
    output: { notifiedManager: Boolean(env.MANAGER_PHONE_NUMBER) },
    rationale: input.reason,
  });
}

