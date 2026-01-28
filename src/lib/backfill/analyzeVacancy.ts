import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ShiftVacancy } from "@/lib/backfill/types";

export async function analyzeVacancy(shiftId: string): Promise<ShiftVacancy> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("shifts")
    .select(
      `
        id,
        client_id,
        start_time,
        end_time,
        required_skills,
        clients (
          id,
          first_name,
          last_initial,
          primary_language
        )
      `,
    )
    .eq("id", shiftId)
    .single();

  if (error || !data) {
    throw new Error(`analyzeVacancy: failed to load shift ${shiftId}: ${error?.message ?? "no data"}`);
  }

  const client = (data as any).clients as
    | { id: string; first_name: string; last_initial: string; primary_language: string }
    | null;

  if (!client) {
    throw new Error(`analyzeVacancy: shift ${shiftId} missing client record`);
  }

  return {
    shiftId: data.id,
    clientId: data.client_id,
    clientFirstName: client.first_name,
    clientLastInitial: client.last_initial,
    clientLanguage: client.primary_language ?? "en",
    startTime: data.start_time,
    endTime: data.end_time,
    requiredSkills: (data.required_skills ?? []) as string[],
  };
}

