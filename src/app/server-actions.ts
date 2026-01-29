"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";
import { emitShiftCancelled } from "@/lib/inngest/events";
import { writeAudit } from "@/lib/backfill/audit";
import { processResponse, type BackfillDecision } from "@/lib/backfill/processResponse";

export async function cancelShift(formData: FormData) {
  const shiftId = String(formData.get("shiftId") ?? "");
  if (!shiftId) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("shifts")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), caregiver_id: null })
    .eq("id", shiftId);

  if (error) throw new Error(`cancelShift failed: ${error.message}`);

  await writeAudit({
    action: "shift.cancelled",
    entityType: "shift",
    entityId: shiftId,
    inputRedacted: { shiftId },
    output: { status: "cancelled" },
    rationale: "Shift cancelled via UI; emitted shift/cancelled event.",
  });

  await emitShiftCancelled({ shiftId, cancelledBy: "ui" });

  revalidatePath("/");
  revalidatePath(`/shifts/${shiftId}`);
}

export async function caregiverRespond(formData: FormData) {
  const attemptId = String(formData.get("attemptId") ?? "");
  const decision = String(formData.get("decision") ?? "") as BackfillDecision;
  if (!attemptId) return;
  if (decision !== "accepted" && decision !== "declined" && decision !== "no_answer") return;

  await processResponse({ attemptId, decision, raw: { via: "caregiver_ui" } });
  revalidatePath("/caregiver");
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function seedDemoData() {
  const supabase = getSupabaseAdmin();
  const env = getEnv();

  // Idempotent-ish seed: reuse the same client/caregivers, but create a NEW shift every click
  // so you can repeatedly demo the Cancel → Backfill flow.
  //
  // This function also seeds *more* data (caregiver pool + multiple clients + multiple shifts)
  // so the UI has enough rows for demos.

  const { data: existingClient } = await supabase
    .from("clients")
    .select("id")
    .eq("first_name", "Mr")
    .eq("last_initial", "S")
    .limit(1)
    .maybeSingle();

  const clientId =
    existingClient?.id ??
    (
      await supabase
        .from("clients")
        .insert({
          first_name: "Mr",
          last_initial: "S",
          primary_language: "en",
          // NYC-ish
          location: "POINT(-73.935242 40.73061)",
          timezone: "America/New_York",
        })
        .select("id")
        .single()
    ).data?.id;

  if (!clientId) {
    throw new Error("seedDemoData: failed to ensure demo client");
  }

  const bobPhone = env.DEMO_CAREGIVER_PHONE ?? "+15555550101";

  const caregivers = [
    {
      full_name: "Bob Caregiver",
      phone_number: bobPhone,
      skills: ["BLS", "Dementia"],
      primary_language: "en",
      location: "POINT(-73.941 40.735)",
      status: "active",
    },
    {
      full_name: "Alice Caregiver",
      phone_number: "+15555550102",
      skills: ["BLS"],
      primary_language: "es",
      location: "POINT(-73.98 40.72)",
      status: "active",
    },
    {
      full_name: "Charlie Caregiver",
      phone_number: "+15555550103",
      skills: ["BLS", "Dementia", "Hoyer Lift"],
      primary_language: "en",
      location: "POINT(-74.02 40.71)",
      status: "active",
    },
    {
      full_name: "Dana Caregiver",
      phone_number: "+15555550104",
      skills: ["BLS", "Hoyer Lift"],
      primary_language: "en",
      location: "POINT(-73.955 40.742)",
      status: "active",
    },
    {
      full_name: "Evan Caregiver",
      phone_number: "+15555550105",
      skills: ["BLS", "Dementia"],
      primary_language: "fr",
      location: "POINT(-73.99 40.75)",
      status: "active",
    },
    {
      full_name: "Fatima Caregiver",
      phone_number: "+15555550106",
      skills: ["BLS"],
      primary_language: "ar",
      location: "POINT(-73.92 40.73)",
      status: "active",
    },
    {
      full_name: "Gabe Caregiver",
      phone_number: "+15555550107",
      skills: ["BLS", "Dementia"],
      primary_language: "en",
      location: "POINT(-74.01 40.74)",
      status: "active",
    },
    {
      full_name: "Hana Caregiver",
      phone_number: "+15555550108",
      skills: ["BLS", "Hoyer Lift"],
      primary_language: "ja",
      location: "POINT(-73.97 40.71)",
      status: "active",
    },
    {
      full_name: "Ivan Caregiver",
      phone_number: "+15555550109",
      skills: ["BLS", "Dementia", "Hoyer Lift"],
      primary_language: "ru",
      location: "POINT(-73.94 40.72)",
      status: "active",
    },
    {
      full_name: "Jules Caregiver",
      phone_number: "+15555550110",
      skills: ["BLS"],
      primary_language: "en",
      location: "POINT(-73.93 40.745)",
      status: "active",
    },
  ];

  const { data: upsertedCaregivers, error: cgErr } = await supabase
    .from("caregivers")
    .upsert(caregivers, { onConflict: "phone_number" })
    .select("id, phone_number");
  if (cgErr || !upsertedCaregivers) {
    throw new Error(`seedDemoData: caregivers upsert failed: ${cgErr?.message ?? "no data"}`);
  }

  const byPhone = new Map(upsertedCaregivers.map((c) => [c.phone_number, c.id] as const));
  const caregiverIds = upsertedCaregivers.map((c) => c.id);

  // Best-effort stats upsert (safe if rerun).
  const statsSeed = [
    { phone: bobPhone, reliability: 0.7, accept: 0.6 },
    { phone: "+15555550102", reliability: 0.8, accept: 0.4 },
    { phone: "+15555550103", reliability: 0.6, accept: 0.7 },
    { phone: "+15555550104", reliability: 0.65, accept: 0.55 },
    { phone: "+15555550105", reliability: 0.55, accept: 0.45 },
    { phone: "+15555550106", reliability: 0.75, accept: 0.5 },
    { phone: "+15555550107", reliability: 0.6, accept: 0.6 },
    { phone: "+15555550108", reliability: 0.7, accept: 0.35 },
    { phone: "+15555550109", reliability: 0.5, accept: 0.7 },
    { phone: "+15555550110", reliability: 0.8, accept: 0.55 },
  ];

  await supabase.from("caregiver_stats").upsert(
    statsSeed
      .map((s) => ({
        caregiver_id: byPhone.get(s.phone),
        reliability_score: s.reliability,
        last_minute_accept_rate: s.accept,
      }))
      .filter((x) => Boolean(x.caregiver_id)),
  );

  // Seed a few extra clients (we don't have a uniqueness constraint, so we try to reuse if found).
  const clientSeeds = [
    { first_name: "Mr", last_initial: "S", primary_language: "en", location: "POINT(-73.935242 40.73061)" },
    { first_name: "Ms", last_initial: "J", primary_language: "es", location: "POINT(-73.985 40.748)" },
    { first_name: "Mrs", last_initial: "K", primary_language: "en", location: "POINT(-73.96 40.715)" },
  ];

  const clientIds: string[] = [];
  for (const c of clientSeeds) {
    const { data: maybe } = await supabase
      .from("clients")
      .select("id")
      .eq("first_name", c.first_name)
      .eq("last_initial", c.last_initial)
      .limit(1)
      .maybeSingle();

    const id =
      maybe?.id ??
      (
        await supabase
          .from("clients")
          .insert({
            first_name: c.first_name,
            last_initial: c.last_initial,
            primary_language: c.primary_language,
            location: c.location,
            timezone: "America/New_York",
          })
          .select("id")
          .single()
      ).data?.id;

    if (id) clientIds.push(id);
  }

  // Always include the original demo clientId as a fallback.
  if (!clientIds.includes(clientId)) clientIds.push(clientId);

  function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)] as T;
  }

  // Create multiple new shifts each click (assigned/open) so the UI is populated.
  const now = Date.now();
  const newShifts = Array.from({ length: 5 }).map((_, idx) => {
    const start = new Date(now + (1 + idx) * 60 * 60 * 1000); // 1h,2h,... from now
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    const needsDementia = idx % 2 === 0;
    const status = idx % 3 === 0 ? "open" : "assigned";
    const caregiver_id = status === "assigned" ? pick(caregiverIds) : null;
    return {
      client_id: pick(clientIds),
      caregiver_id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status,
      required_skills: needsDementia ? ["Dementia"] : ["BLS"],
    };
  });

  const { error: shiftErr } = await supabase.from("shifts").insert(newShifts);
  if (shiftErr) throw new Error(`seedDemoData: shift insert failed: ${shiftErr.message}`);

  await writeAudit({
    action: "demo.seed",
    entityType: "system",
    entityId: clientId,
    inputRedacted: { created: true },
    output: { clientId, caregiverCount: upsertedCaregivers.length, newShiftCount: newShifts.length },
    rationale: "Seeded (upserted) demo client/caregivers and created multiple new demo shifts.",
  });

  revalidatePath("/");
}

