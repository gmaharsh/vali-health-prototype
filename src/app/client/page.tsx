import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientPage(props: { searchParams?: Promise<Record<string, string | string[]>> }) {
  const sp = (await props.searchParams) ?? {};
  const clientId = String(Array.isArray(sp.clientId) ? sp.clientId[0] : sp.clientId ?? "");
  const showAll = String(Array.isArray(sp.showAll) ? sp.showAll[0] : sp.showAll ?? "") === "1";

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  const { data: clients } = await supabase
    .from("clients")
    .select("id, first_name, last_initial, primary_language")
    .order("created_at", { ascending: false })
    .limit(20);

  const selectedId = clientId || clients?.[0]?.id || "";

  const { data: shifts } = selectedId
    ? await supabase
        .from("shifts")
        .select(
          `
          id,
          start_time,
          end_time,
          status,
          required_skills,
          caregivers ( full_name )
        `,
        )
        .eq("client_id", selectedId)
        .gte("start_time", now.toISOString())
        .lte("start_time", oneHourFromNow.toISOString())
        .order("start_time", { ascending: true })
        .limit(20)
    : { data: [] as any[] };

  const { data: audits } = selectedId
    ? await supabase
        .from("system_audit")
        .select("id, at, action, entity_type, entity_id, rationale")
        .order("at", { ascending: false })
        .limit(15)
    : { data: [] as any[] };

  return (
    <div className="min-h-screen font-sans">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="space-y-2">
          <div className="text-xs font-medium text-zinc-500">Role</div>
          <h1 className="text-2xl font-semibold tracking-tight">Client / Caretaker</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            View upcoming visits and staffing status (PHI-minimized demo identifiers).
          </p>
        </header>

        <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Select client</h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(clients ?? []).map((c: any) => {
              const label = `${c.first_name} ${c.last_initial}.`;
              return (
                <a
                  key={c.id}
                  href={`/client?clientId=${encodeURIComponent(c.id)}${showAll ? "&showAll=1" : ""}`}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    c.id === selectedId
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                      : "border-black/10 bg-white hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  }`}
                >
                  {label}
                </a>
              );
            })}
            <a
              href={`/client?clientId=${encodeURIComponent(selectedId)}${showAll ? "" : "&showAll=1"}`}
              className="ml-auto text-sm text-zinc-600 hover:underline dark:text-zinc-300"
            >
              {showAll ? "Show next 1h" : "Show all"}
            </a>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Upcoming visits</h2>
            <div className="mt-4 space-y-2 text-sm">
              {(shifts ?? []).length === 0 ? (
                <div className="text-sm text-zinc-600 dark:text-zinc-300">No visits found.</div>
              ) : (
                (shifts ?? []).map((s: any) => {
                  const caregiver = s.caregivers && Array.isArray(s.caregivers) ? s.caregivers[0] : s.caregivers;
                  return (
                    <div
                      key={s.id}
                      className="rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-black/5 dark:bg-black dark:ring-white/10"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">{new Date(s.start_time).toLocaleString()}</div>
                        <span className="rounded-full bg-white px-2 py-1 text-xs ring-1 ring-black/10 dark:bg-zinc-950 dark:ring-white/10">
                          {s.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                        Caregiver: {caregiver?.full_name ?? "TBD"} • Skills:{" "}
                        {(s.required_skills ?? []).join(", ") || "—"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Recent system updates (audit)</h2>
            <div className="mt-4 space-y-2">
              {(audits ?? []).length === 0 ? (
                <div className="text-sm text-zinc-600 dark:text-zinc-300">No audit events yet.</div>
              ) : (
                (audits ?? []).map((a: any) => (
                  <div
                    key={a.id}
                    className="rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-black/5 dark:bg-black dark:ring-white/10"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-mono text-xs text-zinc-500">{new Date(a.at).toLocaleString()}</div>
                      <div className="font-mono text-xs">{a.action}</div>
                    </div>
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      {a.rationale ?? `${a.entity_type}${a.entity_id ? ` • ${a.entity_id}` : ""}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

