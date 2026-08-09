import { AlertTriangle, Bell, CheckCircle2, Clock3, MailWarning } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type AlertRow = {
  id: string;
  type: string;
  status: string;
  notification_status: string;
  created_at: string;
  customers: { name: string; email: string | null; phone: string } | null;
};

type AttemptRow = {
  id: number;
  enquiry_id: string;
  recipient_type: "business" | "customer";
  status: "pending" | "sent" | "failed";
  error_code: string | null;
  attempted_at: string;
};

export default async function NotificationsPage() {
  const client = await createClient();
  const [alertsResult, attemptsResult] = client
    ? await Promise.all([
        client.from("enquiries").select("id,type,status,notification_status,created_at,customers(name,email,phone)").or("status.eq.new,notification_status.in.(pending,failed)").order("created_at", { ascending: false }).limit(100),
        client.from("notification_attempts").select("id,enquiry_id,recipient_type,status,error_code,attempted_at").order("attempted_at", { ascending: false }).limit(100),
      ])
    : [{ data: [], error: new Error("Database unavailable") }, { data: [], error: new Error("Database unavailable") }];

  const alerts = (alertsResult.data || []) as unknown as AlertRow[];
  const attempts = (attemptsResult.data || []) as unknown as AttemptRow[];
  const failedEmails = alerts.filter((item) => item.notification_status === "failed").length;
  const recentSuccessfulEmails = attempts.filter((item) => item.status === "sent").length;
  const loadFailed = Boolean(alertsResult.error || attemptsResult.error);

  return (
    <>
      <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Operations</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-[#071127]">Notification centre</h1>
          <p className="mt-2 max-w-2xl text-[#586575]">New customer requests and email delivery issues that need attention.</p>
        </div>
        <Link href="/admin/enquiries" className="rounded-xl bg-[#071127] px-4 py-3 text-sm font-bold text-white">View all enquiries</Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={<Bell />} label="Requires attention" value={alerts.length} />
        <SummaryCard icon={<MailWarning />} label="Email failures" value={failedEmails} tone={failedEmails ? "danger" : "default"} />
        <SummaryCard icon={<CheckCircle2 />} label="Recent successful emails" value={recentSuccessfulEmails} />
      </div>

      {loadFailed && <div role="alert" className="mt-8 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><AlertTriangle className="shrink-0" size={20} />Notifications could not be loaded. Refresh the page or check the database connection.</div>}

      <section className="mt-10" aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="text-2xl font-bold text-[#071127]">Needs attention</h2>
        <div className="mt-4 grid gap-4">
          {alerts.map((alert) => (
            <article key={alert.id} className="rounded-2xl border border-[#E4EAF0] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">{formatType(alert.type)} · {formatDate(alert.created_at)}</p>
                  <h3 className="mt-2 text-xl font-bold text-[#071127]">{alert.customers?.name || "Customer enquiry"}</h3>
                  <p className="mt-1 text-sm text-[#586575]">{alert.status === "new" ? "New enquiry awaiting review" : "Enquiry in progress"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {alert.status === "new" && <StatusBadge label="New" />}
                  {alert.notification_status === "failed" && <StatusBadge label="Email failed" danger />}
                  {alert.notification_status === "pending" && <StatusBadge label="Email pending" pending />}
                </div>
              </div>
              <Link href={`/admin/enquiries#enquiry-${alert.id}`} className="mt-4 inline-flex min-h-10 items-center font-bold text-[#1974E2] underline decoration-[#1974E2]/30 underline-offset-4">Open enquiry</Link>
            </article>
          ))}
          {!loadFailed && alerts.length === 0 && <p className="rounded-2xl border border-[#E4EAF0] bg-white p-8 text-center text-[#667586]">Nothing needs attention.</p>}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="delivery-heading">
        <h2 id="delivery-heading" className="text-2xl font-bold text-[#071127]">Email delivery history</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#E4EAF0] bg-white">
          {attempts.map((attempt) => (
            <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4EAF0] px-5 py-4 last:border-b-0">
              <div className="flex items-center gap-3">
                {attempt.status === "sent" ? <CheckCircle2 className="text-green-700" size={19} /> : attempt.status === "failed" ? <MailWarning className="text-red-700" size={19} /> : <Clock3 className="text-amber-700" size={19} />}
                <div>
                  <p className="font-bold text-[#071127]">{attempt.recipient_type === "business" ? "Business notification" : "Customer confirmation"}</p>
                  <p className="text-xs text-[#667586]">{formatDate(attempt.attempted_at)}{attempt.error_code ? ` · ${attempt.error_code}` : ""}</p>
                </div>
              </div>
              <Link href={`/admin/enquiries#enquiry-${attempt.enquiry_id}`} className="text-sm font-bold text-[#1974E2]">View enquiry</Link>
            </div>
          ))}
          {!loadFailed && attempts.length === 0 && <p className="p-8 text-center text-[#667586]">No email attempts have been recorded yet.</p>}
        </div>
      </section>
    </>
  );
}

function SummaryCard({ icon, label, value, tone = "default" }: { icon: React.ReactNode; label: string; value: number; tone?: "default" | "danger" }) {
  return <article className={`rounded-2xl border bg-white p-5 ${tone === "danger" ? "border-red-200" : "border-[#E4EAF0]"}`}><span className={tone === "danger" ? "text-red-700" : "text-[#1974E2]"}>{icon}</span><p className="mt-4 text-sm font-semibold text-[#667586]">{label}</p><strong className="mt-1 block text-3xl text-[#071127]">{value}</strong></article>;
}

function StatusBadge({ label, danger = false, pending = false }: { label: string; danger?: boolean; pending?: boolean }) {
  const colour = danger ? "bg-red-100 text-red-800" : pending ? "bg-amber-100 text-amber-900" : "bg-[#EAF3FF] text-[#1446A5]";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${colour}`}>{label}</span>;
}

function formatType(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value));
}
