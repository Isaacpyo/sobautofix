import { CarFront, Clock3, MapPin, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { formatLondonTimeRange } from "@/lib/diary/time";
import { diaryTypeLabels, diaryTypeStyles, statusStyles, type AppointmentStatus, type DiaryEntry, type DiaryEntryType } from "@/lib/diary/types";
import { cn } from "@/lib/utils";

export function TypeBadge({ type, className }: { type: DiaryEntryType; className?: string }) {
  const style = diaryTypeStyles[type];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", className)} style={{ backgroundColor: style.fill, color: style.text }}>
      <span className="size-2 rounded-full" style={{ backgroundColor: style.edge }} aria-hidden="true" />
      {diaryTypeLabels[type]}
    </span>
  );
}

export function StatusBadge({ status, label, className }: { status: AppointmentStatus; label: string; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold", statusStyles[status], className)}>{label}</span>;
}

/** Full card used in the agenda, the day list on phones and the Today page. */
export function DiaryEntryCard({ entry, showDate = false, dateLabel }: { entry: DiaryEntry; showDate?: boolean; dateLabel?: string }) {
  const style = diaryTypeStyles[entry.type];
  const muted = entry.status === "cancelled" || entry.status === "no_show";
  return (
    <article className={cn("relative rounded-2xl border border-[#E3E8EF] bg-white", muted && "opacity-80")}>
      <span className="absolute inset-y-3 left-0 w-1.5 rounded-r-full" style={{ backgroundColor: style.edge }} aria-hidden="true" />
      <Link href={entry.href} className="block rounded-2xl py-3.5 pr-4 pl-5 hover:bg-[#F8FAFC] focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-[rgba(22,139,255,.55)]">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={entry.type} />
          <StatusBadge status={entry.status} label={entry.statusLabel} />
        </div>
        <h3 className={cn("mt-2 text-base leading-snug font-extrabold text-[#0B1220]", muted && "line-through decoration-1")}>{entry.title}</h3>
        <dl className="mt-2 grid gap-1 text-sm text-[#344054]">
          <Detail label="Time" icon={Clock3}><span className={showDate ? "font-semibold" : "sr-only"}>{dateLabel} </span><time dateTime={entry.start} className="font-semibold">{formatLondonTimeRange(entry.start, entry.end)}</time></Detail>
          {entry.vehicleLabel && <Detail label="Vehicle" icon={CarFront}>{entry.vehicleLabel}</Detail>}
          {entry.customerName && <Detail label="Customer" icon={UserRound}>{entry.customerName}</Detail>}
          <Detail label="Staff" icon={UsersRound}>{entry.assignedName || <span className="text-[#5B6575]">Unassigned</span>}</Detail>
          {entry.location && <Detail label="Location" icon={MapPin}>{entry.location}</Detail>}
        </dl>
      </Link>
      {entry.sourceHref && (
        <div className="border-t border-[#EEF2F6] px-5 py-2">
          <Link href={entry.sourceHref} className="inline-flex min-h-11 items-center text-sm font-bold text-[#1462C4] hover:underline focus-visible:outline-3 focus-visible:outline-[rgba(22,139,255,.55)]">
            Open {entry.sourceLabel?.toLowerCase() || "record"}<span className="sr-only">: {entry.title}</span>
          </Link>
        </div>
      )}
    </article>
  );
}

function Detail({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <dt className="sr-only">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2"><Icon size={15} className="shrink-0 text-[#5B6575]" aria-hidden="true" /><span className="min-w-0 truncate">{children}</span></dd>
    </div>
  );
}
