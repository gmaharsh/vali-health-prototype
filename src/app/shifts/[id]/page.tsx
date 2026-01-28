import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ShiftDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = getSupabaseAdmin();

  const { data: shift } = await supabase
    .from("shifts")
    .select(
      `
      id,
      start_time,
      end_time,
      status,
      required_skills,
      clients ( first_name, last_initial, primary_language ),
      caregivers ( full_name )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  const { data: runs } = await supabase
    .from("backfill_runs")
    .select("id, status, created_at, deadline_at, chosen_caregiver_id")
    .eq("shift_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  const latestRun = (runs ?? [])[0];

  const { data: attempts } = latestRun
    ? await supabase
        .from("backfill_attempts")
        .select("id, caregiver_id, channel, status, created_at, responded_at, provider_message_id, provider_call_id")
        .eq("run_id", latestRun.id)
        .order("created_at", { ascending: true })
    : { data: [] as any[] };

  const client =
    shift?.clients && Array.isArray(shift.clients) ? shift.clients[0] : (shift?.clients as any | undefined);
  const clientLabel = client ? `${client.first_name} ${client.last_initial}.` : "Unknown client";

  return (
    <div className="min-h-screen font-sans">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-2">
          <Link className="text-sm text-zinc-600 hover:underline dark:text-zinc-300" href="/">
            ← Back
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Shift</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Client: <span className="font-medium">{clientLabel}</span>
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard label="Status" value={shift?.status ?? "—"} />
          <InfoCard
            label="Assigned caregiver"
            value={
              (shift?.caregivers && Array.isArray(shift.caregivers)
                ? shift.caregivers[0]?.full_name
                : (shift?.caregivers as any | undefined)?.full_name) ?? "—"
            }
          />
          <InfoCard label="Required skills" value={(shift?.required_skills ?? []).join(", ") || "—"} />
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Backfill runs</h2>
          <div className="mt-4 space-y-2 text-sm">
            {(runs ?? []).length === 0 ? (
              <div className="text-zinc-600 dark:text-zinc-300">No backfill runs yet.</div>
            ) : (
              (runs ?? []).map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-black/5 dark:bg-black dark:ring-white/10"
                >
                  <div className="font-mono text-xs">{r.id}</div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white px-2 py-1 text-xs ring-1 ring-black/10 dark:bg-zinc-950 dark:ring-white/10">
                      {r.status}
                    </span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-300">
                      deadline {new Date(r.deadline_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Outreach attempts</h2>
          <div className="mt-4 overflow-x-auto">
            {(attempts ?? []).length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">No attempts yet.</div>
            ) : (
              <table className="w-full min-w-[800px] text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Attempt</th>
                    <th className="py-2 pr-3">Channel</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2 pr-3">Responded</th>
                    <th className="py-2 pr-3">Provider id</th>
                  </tr>
                </thead>
                <tbody>
                  {(attempts ?? []).map((a) => (
                    <tr key={a.id} className="border-t border-black/5 dark:border-white/10">
                      <td className="py-2 pr-3 font-mono text-xs">{a.id}</td>
                      <td className="py-2 pr-3">{a.channel}</td>
                      <td className="py-2 pr-3">{a.status}</td>
                      <td className="py-2 pr-3">{new Date(a.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-3">{a.responded_at ? new Date(a.responded_at).toLocaleString() : "—"}</td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {a.provider_message_id ?? a.provider_call_id ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function InfoCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <div className="text-xs font-medium text-zinc-500">{props.label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{props.value}</div>
    </div>
  );
}

