import "server-only";

import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/comms/twilio";
import { startOutboundCall } from "@/lib/comms/vapi";
import { writeAudit } from "@/lib/backfill/audit";
import type { CandidateRow, RankedCandidate, ShiftVacancy } from "@/lib/backfill/types";
import { setRunChosenCaregiver } from "@/lib/backfill/run";
import { clientLabel } from "@/lib/phi";

export type ExecuteOutreachResult = Readonly<{
  attemptId: string;
  channel: "sms" | "voice";
  caregiverId: string;
}>;

export async function executeOutreach(input: {
  runId: string;
  vacancy: ShiftVacancy;
  candidates: CandidateRow[];
  ranked: RankedCandidate[];
}): Promise<ExecuteOutreachResult | null> {
  const top = input.ranked[0];
  if (!top) return null;

  const candidate = input.candidates.find((c) => c.caregiver_id === top.caregiverId);
  if (!candidate) throw new Error(`executeOutreach: missing candidate row for ${top.caregiverId}`);

  const env = getEnv();
  const hasVapi = Boolean(env.VAPI_API_KEY && env.VAPI_PHONE_NUMBER_ID && env.VAPI_ASSISTANT_ID);
  const channel: "sms" | "voice" = hasVapi ? "voice" : "sms";

  await setRunChosenCaregiver({ runId: input.runId, caregiverId: candidate.caregiver_id });

  const supabase = getSupabaseAdmin();
  const { data: attempt, error: insErr } = await supabase
    .from("backfill_attempts")
    .insert({
      run_id: input.runId,
      caregiver_id: candidate.caregiver_id,
      channel,
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !attempt) throw new Error(`executeOutreach: insert attempt failed: ${insErr?.message ?? "no data"}`);

  const attemptId = (attempt as any).id as string;

  const clientLabelText = clientLabel({
    firstName: input.vacancy.clientFirstName,
    lastInitial: input.vacancy.clientLastInitial,
  });
  const message =
    `Vali Backfill: Can you cover a shift for ${clientLabelText}?\n` +
    `Start: ${new Date(input.vacancy.startTime).toLocaleString()}\n` +
    `Reply YES or NO.`;

  try {
    if (channel === "sms") {
      const { messageSid } = await sendSms({ toE164: candidate.phone_number, body: message });
      await supabase
        .from("backfill_attempts")
        .update({ status: "sent", provider_message_id: messageSid })
        .eq("id", attemptId);
    } else {
      const { callId } = await startOutboundCall({
        toE164: candidate.phone_number,
        metadata: { attemptId, runId: input.runId, shiftId: input.vacancy.shiftId },
      });
      await supabase
        .from("backfill_attempts")
        .update({ status: "sent", provider_call_id: callId })
        .eq("id", attemptId);
    }
  } catch (e) {
    await supabase.from("backfill_attempts").update({ status: "failed" }).eq("id", attemptId);
    await writeAudit({
      action: "backfill.outreach.failed",
      entityType: "backfill_attempt",
      entityId: attemptId,
      inputRedacted: { shiftId: input.vacancy.shiftId, caregiverId: candidate.caregiver_id, channel },
      output: { error: e instanceof Error ? e.message : String(e) },
      rationale: "Outreach provider call failed.",
    });
    throw e;
  }

  await writeAudit({
    action: "backfill.outreach.sent",
    entityType: "backfill_attempt",
    entityId: attemptId,
    inputRedacted: {
      shiftId: input.vacancy.shiftId,
      caregiverId: candidate.caregiver_id,
      channel,
      client: clientLabelText,
    },
    output: { topScore: top.finalScore, rationale: top.rationale },
    rationale: "Executed outreach to top-ranked caregiver.",
  });

  return { attemptId, channel, caregiverId: candidate.caregiver_id };
}

