import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type BackfillRunRow = Readonly<{
  id: string;
  shift_id: string;
  status: string;
  deadline_at: string;
  chosen_caregiver_id: string | null;
}>;

export async function createBackfillRun(input: {
  shiftId: string;
  deadlineMinutes?: number;
}): Promise<BackfillRunRow> {
  const supabase = getSupabaseAdmin();
  const deadlineMinutes = input.deadlineMinutes ?? 15;
  const deadlineAt = new Date(Date.now() + deadlineMinutes * 60_000).toISOString();

  const { data, error } = await supabase
    .from("backfill_runs")
    .insert({
      shift_id: input.shiftId,
      status: "running",
      deadline_at: deadlineAt,
    })
    .select("id, shift_id, status, deadline_at, chosen_caregiver_id")
    .single();

  if (error || !data) throw new Error(`createBackfillRun failed: ${error?.message ?? "no data"}`);
  return data as BackfillRunRow;
}

export async function setRunChosenCaregiver(input: { runId: string; caregiverId: string }) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("backfill_runs")
    .update({ chosen_caregiver_id: input.caregiverId })
    .eq("id", input.runId);
  if (error) throw new Error(`setRunChosenCaregiver failed: ${error.message}`);
}

export async function setRunStatus(input: { runId: string; status: string }) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("backfill_runs").update({ status: input.status }).eq("id", input.runId);
  if (error) throw new Error(`setRunStatus failed: ${error.message}`);
}

export async function findLatestActiveRunForShift(input: { shiftId: string }): Promise<BackfillRunRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("backfill_runs")
    .select("id, shift_id, status, deadline_at, chosen_caregiver_id")
    .eq("shift_id", input.shiftId)
    .in("status", ["running"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(`findLatestActiveRunForShift failed: ${error.message}`);
  const row = (data ?? [])[0];
  return row ? (row as BackfillRunRow) : null;
}

