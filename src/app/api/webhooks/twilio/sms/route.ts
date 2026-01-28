import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { emitBackfillResponse } from "@/lib/inngest/events";
import { writeAudit } from "@/lib/backfill/audit";

export const runtime = "nodejs";

function normalizeDecision(body: string | undefined): "accepted" | "declined" | null {
  const t = (body ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t === "y" || t === "yes" || t.startsWith("yes ")) return "accepted";
  if (t === "n" || t === "no" || t.startsWith("no ")) return "declined";
  return null;
}

function formDataToRecord(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) out[k] = String(v);
  return out;
}

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const params = formDataToRecord(form);

  const from = params.From;
  const messageBody = params.Body;
  const decision = normalizeDecision(messageBody);

  await writeAudit({
    action: "twilio.sms.inbound",
    entityType: "twilio_sms",
    entityId: params.MessageSid,
    inputRedacted: { from, body: decision ? decision : "[unrecognized]" },
    output: { messageSid: params.MessageSid },
    rationale: "Inbound SMS webhook received.",
  });

  if (!from || !decision) {
    return new Response("OK", { status: 200 });
  }

  // Map the sender -> caregiver -> latest active attempt.
  const supabase = getSupabaseAdmin();
  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("id")
    .eq("phone_number", from)
    .maybeSingle();

  if (!caregiver?.id) return new Response("OK", { status: 200 });

  const { data: attempt } = await supabase
    .from("backfill_attempts")
    .select("id, status")
    .eq("caregiver_id", caregiver.id)
    .in("status", ["pending", "sent", "delivered"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attempt?.id) return new Response("OK", { status: 200 });

  await emitBackfillResponse({ attemptId: attempt.id, decision });
  return new Response("OK", { status: 200 });
}

