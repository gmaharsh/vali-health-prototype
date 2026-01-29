import "server-only";

import twilio from "twilio";
import { getEnv } from "@/lib/env";

let cached:
  | {
      client: ReturnType<typeof twilio>;
      from: string;
    }
  | undefined;

function getClient() {
  if (cached) return cached;
  const env = getEnv();
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    throw new Error(
      "Twilio not configured (need TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).",
    );
  }
  cached = {
    client: twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN),
    from: env.TWILIO_FROM_NUMBER,
  };
  return cached;
}

export async function sendSms(input: { toE164: string; body: string }): Promise<{ messageSid: string }> {
  const { client, from } = getClient();
  const msg = await client.messages.create({
    to: input.toE164,
    from,
    body: input.body,
  });
  return { messageSid: msg.sid };
}

