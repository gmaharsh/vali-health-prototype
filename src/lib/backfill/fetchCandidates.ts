import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { CandidateRow } from "@/lib/backfill/types";

export async function fetchCandidates(input: {
  shiftId: string;
  radiusMiles: number;
}): Promise<CandidateRow[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc("rpc_fetch_candidates", {
    p_shift_id: input.shiftId,
    p_radius_miles: input.radiusMiles,
  });

  if (error) {
    throw new Error(`fetchCandidates: rpc_fetch_candidates failed: ${error.message}`);
  }

  return (data ?? []) as CandidateRow[];
}

