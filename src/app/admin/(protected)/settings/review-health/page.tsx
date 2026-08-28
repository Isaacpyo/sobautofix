import { AlertTriangle, ArrowRight, CheckCircle2, CircleGauge, Clock3, Database, Eye, KeyRound, ListChecks, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ReviewSyncButton } from "@/app/admin/(protected)/reviews/review-sync-button";
import { createReviewHealthChecks, type ReviewHealthState, type ReviewHealthRow } from "@/lib/reviews/health";
import { createAdminReadClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const icons = [KeyRound, Database, Clock3, ListChecks, Eye, CheckCircle2];

export default async function ReviewHealthPage() {
  const client = await createAdminReadClient();
  const result = client
    ? await client.from("reviews").select("provider,rating,text,source_uri,visible,fetched_at").order("fetched_at", { ascending: false })
    : { data: [], error: new Error("Database client unavailable") };
  const reviews = (result.data || []) as ReviewHealthRow[];
  const checks = createReviewHealthChecks({
    credentialsReady: Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim() && process.env.GOOGLE_PLACE_ID?.trim()),
    databaseReady: Boolean(client) && !result.error,
    reviews,
  });
  const healthy = checks.filter((check) => check.state === "healthy").length;
  const degraded = checks.filter((check) => check.state === "degraded").length;
  const warning = checks.filter((check) => check.state === "warning").length;
  const overall = degraded > 0 ? "Attention required" : warning > 0 ? "Review recommended" : "All operational";

  return (
    <>
      <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Configuration</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-4xl font-extrabold text-[#071127]">Review health</h1>
          <p className="mt-3 max-w-2xl text-[#586575]">Monitor Google review collection, storage, moderation and public display from one place.</p>
        </div>
        <ReviewSyncButton />
      </div>

      <ConfigurationTabs active="review-health" />

      <section className="mt-8 overflow-hidden rounded-2xl border border-[#E4EAF0] bg-white" aria-labelledby="review-health-summary">
        <div className="flex flex-col justify-between gap-5 border-b border-[#E4EAF0] bg-[#F8FAFC] p-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2]"><CircleGauge size={22} aria-hidden="true" /></span>
            <div><h2 id="review-health-summary" className="text-xl font-bold text-[#071127]">{overall}</h2><p className="mt-1 text-sm text-[#667586]">Live status based on current configuration and database records.</p></div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-extrabold">
            <span className="rounded-full bg-green-100 px-3 py-1.5 text-green-800">{healthy} healthy</span>
            {warning > 0 && <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-900">{warning} to review</span>}
            {degraded > 0 && <span className="rounded-full bg-red-100 px-3 py-1.5 text-red-800">{degraded} degraded</span>}
          </div>
        </div>

        <div className="grid gap-px bg-[#E4EAF0] md:grid-cols-2 xl:grid-cols-3">
          {checks.map((check, index) => {
            const Icon = icons[index]!;
            return <HealthCheckCard key={check.label} check={check} icon={<Icon size={20} />} />;
          })}
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ActionCard icon={<ListChecks />} title="Moderate reviews" detail="Publish approved reviews or hide entries that should not appear publicly." href="/admin/reviews" label="Open reviews" />
        <ActionCard icon={<RefreshCw />} title="Refresh monitoring" detail="Reload the latest configuration, database counts and sync freshness." href="/admin/settings/review-health" label="Refresh status" />
      </div>

      {(warning > 0 || degraded > 0) && <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><AlertTriangle className="mt-0.5 shrink-0" size={19} aria-hidden="true" /><p>Items marked for review are not necessarily outages. Pending moderation and an empty public carousel are intentional warnings until a staff member approves reviews.</p></div>}
    </>
  );
}

function ConfigurationTabs({ active }: { active: "settings" | "review-health" | "security" }) {
  const tabs = [
    { key: "settings", href: "/admin/settings", label: "Settings" },
    { key: "review-health", href: "/admin/settings/review-health", label: "Review health" },
    { key: "security", href: "/admin/configuration/security", label: "Security" },
  ] as const;
  return <nav aria-label="Configuration pages" className="mt-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-[#D7E0E9] bg-white p-1">{tabs.map((tab) => <Link key={tab.key} href={tab.href} aria-current={active === tab.key ? "page" : undefined} className={cn("whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold", active === tab.key ? "bg-[#071127] text-white" : "text-[#586575] hover:bg-[#F4F7FA] hover:text-[#1974E2]")}>{tab.label}</Link>)}</nav>;
}

function HealthCheckCard({ check, icon }: { check: ReturnType<typeof createReviewHealthChecks>[number]; icon: React.ReactNode }) {
  return <article className="min-h-48 bg-white p-6"><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2]" aria-hidden="true">{icon}</span><HealthBadge state={check.state} label={check.status} /></div><h3 className="mt-5 text-lg font-bold text-[#071127]">{check.label}</h3><p className="mt-2 text-sm leading-6 text-[#667586]">{check.detail}</p></article>;
}

function HealthBadge({ state, label }: { state: ReviewHealthState; label: string }) {
  return <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-extrabold", state === "healthy" ? "bg-green-100 text-green-800" : state === "degraded" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900")}>{label}</span>;
}

function ActionCard({ icon, title, detail, href, label }: { icon: React.ReactNode; title: string; detail: string; href: string; label: string }) {
  return <section className="rounded-2xl border border-[#E4EAF0] bg-white p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2] [&_svg]:size-5" aria-hidden="true">{icon}</span><div><h2 className="font-bold text-[#071127]">{title}</h2><p className="mt-1 text-sm leading-6 text-[#667586]">{detail}</p><Link href={href} className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#1974E2] hover:text-[#1446A5]">{label}<ArrowRight size={15} aria-hidden="true" /></Link></div></div></section>;
}
