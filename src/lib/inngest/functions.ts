import "server-only";

import { inngest } from "@/lib/inngest/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/backfill/audit";
import { runBackfillGraph } from "@/lib/backfill/graph";
import { createBackfillRun, findLatestActiveRunForShift } from "@/lib/backfill/run";
import { escalateBackfillRun } from "@/lib/backfill/escalate";
import { processResponse } from "@/lib/backfill/processResponse";

export const backfillOnShiftCancelled = inngest.createFunction(
  { id: "backfill-on-shift-cancelled" },
  { event: "shift/cancelled" },
  async ({ event, step }) => {
    const shiftId = event.data.shiftId;

    const existing = await step.run("dedupe-active-run", async () => {
      return await findLatestActiveRunForShift({ shiftId });
    });
    if (existing) return { runId: existing.id, deduped: true };

    const run = await step.run("create-run", async () => {
      const r = await createBackfillRun({ shiftId, deadlineMinutes: 15 });
      await writeAudit({
        action: "backfill.run.created",
        entityType: "backfill_run",
        entityId: r.id,
        inputRedacted: { shiftId },
        output: { deadlineAt: r.deadline_at },
        rationale: "Shift cancelled; created backfill run.",
      });
      return r;
    });

    await step.run("run-langgraph", async () => {
      await runBackfillGraph({ shiftId, runId: run.id });
    });

    await step.sleep("wait-for-deadline", "15m");

    await step.run("escalate-if-still-running", async () => {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("backfill_runs")
        .select("id, status")
        .eq("id", run.id)
        .single();
      if (error || !data) throw new Error(`backfill run check failed: ${error?.message ?? "no data"}`);
      if (data.status === "running") {
        await escalateBackfillRun({ runId: run.id, reason: "No acceptance within 15 minutes." });
      }
    });

    return { runId: run.id, deduped: false };
  },
);

export const backfillOnResponse = inngest.createFunction(
  { id: "backfill-on-response" },
  { event: "backfill/response" },
  async ({ event, step }) => {
    const { attemptId, decision } = event.data;
    return await step.run("process-response", async () => {
      return await processResponse({ attemptId, decision, raw: event.data });
    });
  },
);

export const inngestFunctions = [backfillOnShiftCancelled, backfillOnResponse];

