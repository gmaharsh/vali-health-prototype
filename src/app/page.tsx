import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cancelShift, seedDemoData } from "@/app/server-actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Server component: load shifts + latest backfill run (if any).
  // If Supabase isn't configured yet, this page will error; that's expected until `.env.local` is set.
  const supabase = getSupabaseAdmin();

  const { data: shifts } = await supabase
    .from("shifts")
    .select(
      `
        id,
        start_time,
        end_time,
        status,
        client_id,
        caregiver_id,
        clients ( first_name, last_initial, primary_language ),
        caregivers ( full_name )
      `,
    )
    .order("start_time", { ascending: true })
    .limit(50);

  const { data: runs } = await supabase
    .from("backfill_runs")
    .select("id, shift_id, status, created_at, chosen_caregiver_id")
    .order("created_at", { ascending: false })
    .limit(200);

  const latestRunByShift = new Map<string, any>();
  for (const r of runs ?? []) {
    if (!latestRunByShift.has(r.shift_id)) latestRunByShift.set(r.shift_id, r);
  }

  return (
    <div className="min-h-screen font-sans">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-300">
            Vali Health • Prototype
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Shift Backfilling</h1>
          <p className="max-w-3xl text-base leading-7 text-zinc-700 dark:text-zinc-300">
            Cancel a shift to trigger the event-driven backfill engine (Supabase + LangGraph + Inngest + Twilio/Vapi).
            Every ranking/outreach decision is written to <span className="font-mono">system_audit</span>.
          </p>
        </header>

        <section className="flex flex-wrap items-center gap-3">
          <form action={seedDemoData}>
            <button
              className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              type="submit"
            >
              Seed demo data
            </button>
          </form>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            Webhooks: <span className="font-mono">/api/webhooks/twilio/sms</span> •{" "}
            <span className="font-mono">/api/webhooks/vapi</span> • Inngest:{" "}
            <span className="font-mono">/api/inngest</span>
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Shifts</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Click into a shift to see the backfill timeline and outreach attempts.
          </p>

          <div className="mt-4 overflow-x-auto">
            <ShiftTable shifts={shifts ?? []} latestRunByShift={latestRunByShift} />
          </div>
        </section>
      </main>
    </div>
  );
}

function ShiftTable(props: { shifts: any[]; latestRunByShift: Map<string, any> }) {
  const shifts = props.shifts;
  const latestRunByShift = props.latestRunByShift;

  if (shifts.length === 0) {
    return <div className="text-sm text-zinc-600 dark:text-zinc-300">No shifts found yet.</div>;
  }

  return (
    <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-sm">
      <thead className="text-left text-xs text-zinc-500">
        <tr>
          <th className="px-3 py-2">Client</th>
          <th className="px-3 py-2">Start</th>
          <th className="px-3 py-2">End</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2">Assigned</th>
          <th className="px-3 py-2">Latest backfill</th>
          <th className="px-3 py-2 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {shifts.map((s) => {
          const clientLabel = s.clients ? `${s.clients.first_name} ${s.clients.last_initial}.` : s.client_id;
          const run = latestRunByShift.get(s.id);
          const start = new Date(s.start_time).toLocaleString();
          const end = new Date(s.end_time).toLocaleString();
          return (
            <tr
              key={s.id}
              className="rounded-xl bg-zinc-50 text-zinc-900 shadow-sm ring-1 ring-black/5 dark:bg-black dark:text-zinc-50 dark:ring-white/10"
            >
              <td className="px-3 py-3">
                <Link className="font-medium hover:underline" href={`/shifts/${s.id}`}>
                  {clientLabel}
                </Link>
              </td>
              <td className="px-3 py-3">{start}</td>
              <td className="px-3 py-3">{end}</td>
              <td className="px-3 py-3">
                <span className="rounded-full bg-white px-2 py-1 text-xs ring-1 ring-black/10 dark:bg-zinc-950 dark:ring-white/10">
                  {s.status}
                </span>
              </td>
              <td className="px-3 py-3">{s.caregivers?.full_name ?? "—"}</td>
              <td className="px-3 py-3">
                {run ? (
                  <span className="rounded-full bg-white px-2 py-1 text-xs ring-1 ring-black/10 dark:bg-zinc-950 dark:ring-white/10">
                    {run.status}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-3 text-right">
                <form action={cancelShift}>
                  <input type="hidden" name="shiftId" value={s.id} />
                  <button
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                    type="submit"
                    disabled={s.status === "cancelled" || s.status === "filled"}
                  >
                    Cancel shift
                  </button>
                </form>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
