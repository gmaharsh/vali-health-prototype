import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cancelShift, seedDemoData } from "@/app/server-actions";

export const dynamic = "force-dynamic";

export default async function AdminPage(props: { searchParams?: Promise<Record<string, string | string[]>> }) {
  const sp = (await props.searchParams) ?? {};
  const showAll = String(Array.isArray(sp.showAll) ? sp.showAll[0] : sp.showAll ?? "") === "1";

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  let shiftsQuery = supabase
    .from("shifts")
    .select(
      `
      id,
      start_time,
      end_time,
      status,
      caregiver_id,
      clients ( first_name, last_initial ),
      caregivers ( full_name )
    `,
    );

  if (!showAll) {
    shiftsQuery = shiftsQuery
      .gte("start_time", now.toISOString())
      .lte("start_time", oneHourFromNow.toISOString());
  }

  const { data: shifts } = await shiftsQuery
    .order("start_time", { ascending: false })
    .limit(50);

  const { data: audits } = await supabase
    .from("system_audit")
    .select("id, at, action, entity_type, entity_id, rationale")
    .order("at", { ascending: false })
    .limit(20);

  return (
    <div className="min-h-screen font-sans">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="space-y-2">
          <div className="text-xs font-medium text-zinc-500">Role</div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin (Agency Ops)</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Manage shifts, trigger backfill, and view audit log entries.
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
            Tip: cancel an <span className="font-mono">assigned/open</span> shift to trigger backfill.
          </div>
          <div className="ml-auto text-sm text-zinc-600 dark:text-zinc-300">
            <span className="mr-2 rounded-full bg-white px-2 py-1 text-xs ring-1 ring-black/10 dark:bg-zinc-950 dark:ring-white/10">
              {showAll ? "Showing: all" : "Showing: next 1h"}
            </span>
            <Link className="hover:underline" href={showAll ? "/admin" : "/admin?showAll=1"}>
              {showAll ? "Show next 1h" : "Show all"}
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Recent shifts</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Assigned</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(shifts ?? []).map((s: any) => {
                  const client = s.clients && Array.isArray(s.clients) ? s.clients[0] : s.clients;
                  const caregiver = s.caregivers && Array.isArray(s.caregivers) ? s.caregivers[0] : s.caregivers;
                  const clientLabel = client ? `${client.first_name} ${client.last_initial}.` : "—";
                  const start = new Date(s.start_time).toLocaleString();
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
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-white px-2 py-1 text-xs ring-1 ring-black/10 dark:bg-zinc-950 dark:ring-white/10">
                          {s.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">{caregiver?.full_name ?? "—"}</td>
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
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Audit log (latest)</h2>
          <div className="mt-4 space-y-2">
            {(audits ?? []).length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">No audit events yet.</div>
            ) : (
              (audits ?? []).map((a: any) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-1 rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-black/5 dark:bg-black dark:ring-white/10"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-mono text-xs text-zinc-500">{new Date(a.at).toLocaleString()}</div>
                    <div className="font-mono text-xs">{a.action}</div>
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-300">
                    {a.entity_type}
                    {a.entity_id ? ` • ${a.entity_id}` : ""}
                    {a.rationale ? ` • ${a.rationale}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

