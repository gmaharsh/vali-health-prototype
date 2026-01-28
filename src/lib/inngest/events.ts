import "server-only";

import { getEnv } from "@/lib/env";
import { inngest } from "@/lib/inngest/client";

export async function emitShiftCancelled(input: { shiftId: string; cancelledBy?: string }) {
  const env = getEnv();
  inngest.setEventKey(env.INNGEST_EVENT_KEY);
  await inngest.send({
    name: "shift/cancelled",
    data: { shiftId: input.shiftId, cancelledBy: input.cancelledBy },
  });
}

export async function emitBackfillResponse(input: {
  attemptId: string;
  decision: "accepted" | "declined" | "no_answer";
}) {
  const env = getEnv();
  inngest.setEventKey(env.INNGEST_EVENT_KEY);
  await inngest.send({
    name: "backfill/response",
    data: { attemptId: input.attemptId, decision: input.decision },
  });
}
