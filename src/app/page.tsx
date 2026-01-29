import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen font-sans">
      <main className="mx-auto w-full max-w-6xl px-6 py-14">
        <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex w-fit items-center rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-300">
              Home Care’s Favorite AI Assistant
            </div>

            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Empower your team to do more — with less effort.
            </h1>

            <p className="max-w-xl text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Imagine having a dedicated assistant trained for over 800,000 hours by the best in the home care
              industry—always on, emotionally intelligent, and relentlessly reliable.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin"
                className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                View live demo (Admin)
              </Link>
              <Link
                href="/caregiver"
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                Caregiver view
              </Link>
              <Link
                href="/client"
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                Client view
              </Link>
            </div>

            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              Meet Vali, a new way to manage your caregivers.
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <div className="text-xs font-medium text-zinc-500">This prototype showcases</div>
            <div className="mt-3 grid gap-3">
              <Feature
                title="Open Shift Scheduling, Anytime"
                body="When a caregiver calls out—especially after hours—Vali steps in, filling shifts in real-time."
              />
              <Feature
                title="Always-On Caregiver Support and Engagement"
                body="Vali supports caregivers 24/7 via SMS and proactively engages throughout the caregiver’s journey."
              />
              <Feature
                title="Effortless Billing and Payroll"
                body="Streamline billing and payroll accuracy with next-day shift review and finalization."
              />
              <Feature
                title="Smarter Hiring, Seamless Compliance"
                body="Leverage data-driven insights to hire the best caregivers and stay on top of training and compliance."
              />
            </div>
          </div>
        </section>

        <section className="mt-14 grid gap-6 rounded-3xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Why leading home care agencies choose Vali
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Bullet title="Deliver 24/7 access" body="Support across voice, text, and web with consistent quality." />
            <Bullet title="Build caregiver trust" body="Communicate with empathy and clarity, every time." />
            <Bullet title="Take real action" body="Automate outreach, assignment updates, and escalation." />
            <Bullet title="Monitor live performance" body="Audit logs and run timelines make decisions explainable." />
          </div>
        </section>

        <footer className="mt-14 flex flex-col gap-2 border-t border-black/10 pt-8 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-300">
          <div className="font-medium text-zinc-900 dark:text-zinc-50">Contact</div>
          <div>hello@vali.health</div>
          <div>444 Bryant Street, San Francisco, CA 94107</div>
        </footer>
      </main>
    </div>
  );
}

function Feature(props: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-zinc-50 p-4 text-sm dark:border-white/10 dark:bg-black">
      <div className="font-semibold text-zinc-900 dark:text-zinc-50">{props.title}</div>
      <div className="mt-1 text-zinc-700 dark:text-zinc-300">{props.body}</div>
    </div>
  );
}

function Bullet(props: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-zinc-50 p-4 text-sm dark:border-white/10 dark:bg-black">
      <div className="font-semibold text-zinc-900 dark:text-zinc-50">{props.title}</div>
      <div className="mt-1 text-zinc-700 dark:text-zinc-300">{props.body}</div>
    </div>
  );
}
