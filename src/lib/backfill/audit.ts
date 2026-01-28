import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type AuditWriteInput = Readonly<{
  actor?: string; // default: system
  action: string;
  entityType: string;
  entityId?: string;
  inputRedacted?: unknown;
  output?: unknown;
  rationale?: string;
  metadata?: Record<string, unknown>;
}>;

export async function writeAudit(input: AuditWriteInput): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload = {
    actor: input.actor ?? "system",
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    input_redacted: input.inputRedacted ?? null,
    output: input.output ?? null,
    rationale: input.rationale ?? null,
    metadata: input.metadata ?? {},
  };

  const { error } = await supabase.from("system_audit").insert(payload);
  if (error) {
    // Avoid throwing in core flows; audit failures shouldn't block backfilling.
    console.warn(
      JSON.stringify({
        at: "audit.write.failed",
        message: error.message,
        payload,
      }),
    );
  }
}

