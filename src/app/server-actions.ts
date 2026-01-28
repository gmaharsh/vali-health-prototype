"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { emitShiftCancelled } from "@/lib/inngest/events";
import { writeAudit } from "@/lib/backfill/audit";

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

export async function seedDemoData() {
  const supabase = getSupabaseAdmin();

  const { data: existingShifts } = await supabase.from("shifts").select("id").limit(1);
  if (existingShifts && existingShifts.length > 0) {
    revalidatePath("/");
    return;
  }

  const { data: client, error: clientErr } = await supabase
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
    .single();
  if (clientErr || !client) throw new Error(`seedDemoData: client insert failed: ${clientErr?.message ?? "no data"}`);

  const caregivers = [
    {
      full_name: "Bob Caregiver",
      phone_number: "+15555550101",
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
  ];

  const { data: insertedCaregivers, error: cgErr } = await supabase
    .from("caregivers")
    .insert(caregivers)
    .select("id");
  if (cgErr || !insertedCaregivers) throw new Error(`seedDemoData: caregivers insert failed: ${cgErr?.message ?? "no data"}`);

  await supabase.from("caregiver_stats").insert(
    insertedCaregivers.map((c, idx) => ({
      caregiver_id: c.id,
      reliability_score: idx === 0 ? 0.7 : idx === 1 ? 0.8 : 0.6,
      last_minute_accept_rate: idx === 0 ? 0.6 : idx === 1 ? 0.4 : 0.7,
    })),
  );

  const start = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h from now
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000); // 4h shift

  const { error: shiftErr } = await supabase.from("shifts").insert({
    client_id: client.id,
    caregiver_id: insertedCaregivers[0]?.id ?? null,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    status: "assigned",
    required_skills: ["Dementia"],
  });
  if (shiftErr) throw new Error(`seedDemoData: shift insert failed: ${shiftErr.message}`);

  await writeAudit({
    action: "demo.seed",
    entityType: "system",
    entityId: client.id,
    inputRedacted: { created: true },
    output: { clientId: client.id, caregiverCount: insertedCaregivers.length },
    rationale: "Seeded demo client/caregivers/shift.",
  });

  revalidatePath("/");
}

