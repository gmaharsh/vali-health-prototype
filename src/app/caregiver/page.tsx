import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { caregiverRespond } from "@/app/server-actions";

export const dynamic = "force-dynamic";

export default async function CaregiverPage(props: { searchParams?: Promise<Record<string, string | string[]>> }) {
  const sp = (await props.searchParams) ?? {};
  const caregiverId = String(Array.isArray(sp.caregiverId) ? sp.caregiverId[0] : sp.caregiverId ?? "");

  const supabase = getSupabaseAdmin();
  const { data: caregivers } = await supabase
    .from("caregivers")
    .select("id, full_name, phone_number, status")
    .order("full_name", { ascending: true })
    .limit(50);

  const selectedId = caregiverId || caregivers?.[0]?.id || "";

  const { data: offers } = selectedId
    ? await supabase
        .from("backfill_attempts")
        .select(
          `
          id,
          channel,
          status,
          created_at,
          run_id,
          caregiver_id,
          backfill_runs (
            id,
            shift_id,
            status,
            shifts (
              id,
              start_time,
              end_time,
              required_skills,
              clients ( first_name, last_initial )
            )
          )
        `,
        )
        .eq("caregiver_id", selectedId)
        .in("status", ["pending", "sent", "delivered"])
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] as any[] };

  const { data: myShifts } = selectedId
    ? await supabase
        .from("shifts")
        .select(
          `
          id,
          start_time,
          end_time,
          status,
          clients ( first_name, last_initial )
        `,
        )
        .eq("caregiver_id", selectedId)
        .in("status", ["assigned", "filled"])
        .order("start_time", { ascending: true })
        .limit(10)
    : { data: [] as any[] };

  return (
    <div className="min-h-screen font-sans">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="space-y-2">
          <div className="text-xs font-medium text-zinc-500">Role</div>
          <h1 className="text-2xl font-semibold tracking-tight">Caregiver</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            View backfill offers and accept/decline (this simulates SMS/voice responses for demos).
          </p>
        </header>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Select caregiver</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(caregivers ?? []).map((c: any) => (
              <a
                key={c.id}
                href={`/caregiver?caregiverId=${encodeURIComponent(c.id)}`}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  c.id === selectedId
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                    : "border-black/10 bg-white hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                }`}
              >
                {c.full_name}
              </a>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Backfill offers</h2>
            <div className="mt-4 space-y-3">
              {(offers ?? []).length === 0 ? (
                <div className="text-sm text-zinc-600 dark:text-zinc-300">No offers yet.</div>
              ) : (
                (offers ?? []).map((o: any) => {
                  const run = o.backfill_runs;
                  const shift = run?.shifts;
                  const client =
                    shift?.clients && Array.isArray(shift.clients) ? shift.clients[0] : shift?.clients;
                  const clientLabel = client ? `${client.first_name} ${client.last_initial}.` : "Client";
                  const start = shift?.start_time ? new Date(shift.start_time).toLocaleString() : "—";
                  const skills = (shift?.required_skills ?? []).join(", ") || "—";
                  return (
                    <div
                      key={o.id}
                      className="rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-black/5 dark:bg-black dark:ring-white/10"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold">{clientLabel}</div>
                        <span className="rounded-full bg-white px-2 py-1 text-xs ring-1 ring-black/10 dark:bg-zinc-950 dark:ring-white/10">
                          {o.status} • {o.channel}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                        Start: {start} • Skills: {skills}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <form action={caregiverRespond}>
                          <input type="hidden" name="attemptId" value={o.id} />
                          <input type="hidden" name="decision" value="accepted" />
                          <button
                            type="submit"
                            className="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                          >
                            Accept
                          </button>
                        </form>
                        <form action={caregiverRespond}>
                          <input type="hidden" name="attemptId" value={o.id} />
                          <input type="hidden" name="decision" value="declined" />
                          <button
                            type="submit"
                            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                          >
                            Decline
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">My upcoming shifts</h2>
            <div className="mt-4 space-y-2 text-sm">
              {(myShifts ?? []).length === 0 ? (
                <div className="text-sm text-zinc-600 dark:text-zinc-300">No upcoming shifts.</div>
              ) : (
                (myShifts ?? []).map((s: any) => {
                  const client =
                    s.clients && Array.isArray(s.clients) ? s.clients[0] : s.clients;
                  const label = client ? `${client.first_name} ${client.last_initial}.` : "Client";
                  return (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-black/5 dark:bg-black dark:ring-white/10"
                    >
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-300">
                        {new Date(s.start_time).toLocaleString()} • {s.status}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

