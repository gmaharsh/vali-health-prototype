import "server-only";

import { getEnv } from "@/lib/env";

export async function startOutboundCall(input: {
  toE164: string;
  metadata: Record<string, unknown>;
}): Promise<{ callId: string }> {
  const env = getEnv();
  if (!env.VAPI_API_KEY || !env.VAPI_PHONE_NUMBER_ID || !env.VAPI_ASSISTANT_ID) {
    throw new Error(
      "Vapi not configured (need VAPI_API_KEY, VAPI_PHONE_NUMBER_ID, VAPI_ASSISTANT_ID).",
    );
  }

  const res = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
      assistantId: env.VAPI_ASSISTANT_ID,
      customer: { number: input.toE164 },
      metadata: input.metadata,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Vapi startOutboundCall failed: ${res.status} ${res.statusText} ${text}`);
  }

  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("Vapi startOutboundCall: missing call id");
  return { callId: json.id };
}

