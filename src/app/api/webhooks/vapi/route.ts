import { getEnv } from "@/lib/env";
import { emitBackfillResponse } from "@/lib/inngest/events";
import { writeAudit } from "@/lib/backfill/audit";

export const runtime = "nodejs";

function verifyVapiAuth(req: Request): boolean {
  const env = getEnv();
  if (!env.VAPI_WEBHOOK_SECRET) return true;

  const auth = req.headers.get("authorization");
  const xSecret = req.headers.get("x-vapi-secret");
  if (auth && auth.trim() === `Bearer ${env.VAPI_WEBHOOK_SECRET}`) return true;
  if (xSecret && xSecret.trim() === env.VAPI_WEBHOOK_SECRET) return true;
  return false;
}

function extractAttemptId(payload: any): string | undefined {
  return (
    payload?.metadata?.attemptId ??
    payload?.call?.metadata?.attemptId ??
    payload?.message?.metadata?.attemptId ??
    payload?.message?.call?.metadata?.attemptId
  );
}

function inferDecision(payload: any): "accepted" | "declined" | "no_answer" {
  const explicit = payload?.decision ?? payload?.data?.decision ?? payload?.message?.decision;
  if (explicit === "accepted" || explicit === "declined" || explicit === "no_answer") return explicit;

  const transcript =
    payload?.transcript ??
    payload?.call?.transcript ??
    payload?.message?.transcript ??
    payload?.message?.call?.transcript ??
    "";
  const t = String(transcript).toLowerCase();
  const hasYes = /\byes\b/.test(t);
  const hasNo = /\bno\b/.test(t);
  if (hasYes && !hasNo) return "accepted";
  if (hasNo && !hasYes) return "declined";
  return "no_answer";
}

export async function POST(req: Request): Promise<Response> {
  if (!verifyVapiAuth(req)) return new Response("Unauthorized", { status: 401 });

  const payload = (await req.json().catch(() => null)) as any;
  if (!payload) return new Response("Bad Request", { status: 400 });

  const attemptId = extractAttemptId(payload);
  const decision = inferDecision(payload);

  await writeAudit({
    action: "vapi.webhook.inbound",
    entityType: "vapi_call",
    entityId: payload?.id ?? payload?.call?.id ?? undefined,
    inputRedacted: { attemptId, decision },
    output: { received: true },
    rationale: "Inbound Vapi server message/webhook received.",
  });

  if (attemptId) {
    await emitBackfillResponse({ attemptId, decision });
  }

  return new Response("OK", { status: 200 });
}

