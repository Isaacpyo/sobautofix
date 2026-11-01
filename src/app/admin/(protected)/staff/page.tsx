import { Check, Minus, ShieldCheck, ShieldOff, UserCog } from "lucide-react";
import type { Metadata } from "next";
import { InviteStaffForm, MemberActions } from "@/components/admin/staff/staff-forms";
import { Badge, Card, Notice } from "@/components/admin/exchange/ui";
import { permissionDescriptions, permissionsFor, staffRoleLabels, staffRoles, type ExchangePermission } from "@/lib/exchange/permissions";
import { ExchangeSchemaMissingError } from "@/lib/exchange/schema";
import { requireStaffPage } from "@/lib/exchange/staff";
import { listStaff, listStaffChanges, type StaffChange, type StaffMember } from "@/lib/staff/admin";
import { staffStatusLabels } from "@/lib/staff/rules";

export const metadata: Metadata = { title: "Staff & access", robots: { index: false, follow: false } };

const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const formatWhen = (value: string | null) => (value ? dateTime.format(new Date(value)) : null);

// The role table groups permissions by the area of the admin they open.
const permissionGroups: Array<{ area: string; permissions: ExchangePermission[] }> = [
  { area: "Vehicle Buying & Selling", permissions: ["exchange.view", "stock.edit", "stock.publish", "stock.price", "buying.manage", "sales.manage", "prep.manage"] },
  { area: "Money", permissions: ["finance.view", "finance.edit"] },
  { area: "Diary and customers", permissions: ["diary.manage", "customers.view"] },
  { area: "Website", permissions: ["content.manage", "pricing.manage", "site.manage"] },
  { area: "Settings and staff", permissions: ["settings.manage", "staff.manage"] },
];

function changeText(change: StaffChange) {
  const name = String(change.detail.name || "a member of staff");
  const role = (value: unknown) => staffRoleLabels[value as keyof typeof staffRoleLabels] || String(value);
  switch (change.action) {
    case "staff.invited": return `invited ${name} as ${role(change.detail.role)}`;
    case "staff.invite_resent": return `sent ${name} a new invite`;
    case "staff.updated": return change.detail.roleTo ? `changed ${name} from ${role(change.detail.roleFrom)} to ${role(change.detail.roleTo)}` : `updated ${name}'s details`;
    case "staff.access_removed": return `removed ${name}'s access`;
    case "staff.access_restored": return `restored ${name}'s access`;
    default: return change.action;
  }
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part.replace(/[^\p{L}\p{N}]/gu, "")[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

function MemberRow({ member, isYou }: { member: StaffMember; isYou: boolean }) {
  const tone = member.status === "active" ? "success" : member.status === "invited" ? "info" : "neutral";
  const when = member.status === "removed" ? `Access removed ${formatWhen(member.removedAt)}` : member.lastSignInAt ? `Last signed in ${formatWhen(member.lastSignInAt)}` : member.invitedAt ? `Invited ${formatWhen(member.invitedAt)}, not signed in yet` : "Not signed in yet";
  return <li className="py-4 first:pt-0 last:pb-0">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-[#EAF2FD] text-sm font-extrabold text-[#1462C4]">{initials(member.name)}</span>
        <div className="min-w-0">
          <p className="font-extrabold text-[#071127]">{member.name}{isYou && <span className="ml-2 text-xs font-semibold text-[#586575]">(you)</span>}</p>
          <p className="truncate text-sm text-[#586575]">{member.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{staffRoleLabels[member.role]}</Badge>
            <Badge tone={tone}>{staffStatusLabels[member.status]}</Badge>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#586575]">
              {member.twoStepVerification ? <ShieldCheck size={14} className="text-[#067647]" aria-hidden="true" /> : <ShieldOff size={14} aria-hidden="true" />}
              Two-step verification {member.twoStepVerification ? "on" : "off"}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[#586575]">{when}</p>
        </div>
      </div>
      <MemberActions userId={member.userId} name={member.name} role={member.role} isYou={isYou} status={member.status} />
    </div>
  </li>;
}

export default async function StaffAccessPage() {
  const { staff } = await requireStaffPage("staff.manage");
  let members: StaffMember[] = [];
  let changes: StaffChange[] = [];
  let schemaMissing = false;
  try {
    [members, changes] = await Promise.all([listStaff(staff), listStaffChanges(staff)]);
  } catch (error) {
    if (!(error instanceof ExchangeSchemaMissingError)) throw error;
    schemaMissing = true;
  }
  const active = members.filter((member) => member.status !== "removed").length;

  return <div className="grid gap-6">
    <header className="flex items-start gap-3">
      <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF2FD] text-[#1974E2] sm:grid"><UserCog size={23} aria-hidden="true" /></span>
      <div>
        <p className="text-xs font-extrabold tracking-widest text-[#1462C4] uppercase">System</p>
        <h1 className="mt-1 text-3xl font-extrabold text-[#0B1220] sm:text-4xl">Staff &amp; access</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#5B6575] sm:text-base">Who can sign in to the admin and what each person can do. Only owners see this page.</p>
      </div>
    </header>

    {schemaMissing ? <Notice title="Database update needed">Staff &amp; access needs its database update (migration 20261101090000). Until it is applied, sign-in uses the original two accounts.</Notice> : <>
      <Card id="invite" title="Invite a staff member" description="They get an email with a link to choose a password. They can sign in once they've set it.">
        <InviteStaffForm />
      </Card>

      <Card id="staff" title={`Staff (${active} with access)`} description="Removing access signs the person out straight away. Their past work stays, and you can restore access later.">
        {members.length ? <ul className="divide-y divide-[#EEF2F6]">{members.map((member) => <MemberRow key={member.userId} member={member} isYou={member.userId === staff.userId} />)}</ul> : <p className="text-sm text-[#586575]">No staff yet.</p>}
      </Card>
    </>}

    <Card id="roles" title="What each role can do" description="Everyone with access can use the Dashboard, Today, Enquiries, Bookings and Notifications, and manage their own sign-in security.">
      {/* Phones: one expandable list per role. */}
      <div className="grid gap-2 sm:hidden">
        {staffRoles.map((role) => <details key={role} className="group rounded-xl border border-[#E4EAF0] bg-white">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 font-extrabold text-[#071127]">
            {staffRoleLabels[role]}
            <span className="text-xs font-semibold text-[#586575]">{permissionsFor(role).length} of {permissionGroups.flatMap((group) => group.permissions).length}</span>
          </summary>
          <ul className="grid gap-2 border-t border-[#EEF2F6] px-4 py-3 text-sm">
            {permissionGroups.flatMap((group) => group.permissions).map((permission) => {
              const allowed = permissionsFor(role).includes(permission);
              return <li key={permission} className={allowed ? "flex gap-2 text-[#344054]" : "flex gap-2 text-[#98A2B3]"}>
                {allowed ? <Check size={16} className="mt-0.5 shrink-0 text-[#067647]" aria-hidden="true" /> : <Minus size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
                <span><span className="sr-only">{allowed ? "Can: " : "Cannot: "}</span>{permissionDescriptions[permission]}</span>
              </li>;
            })}
          </ul>
        </details>)}
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="sr-only">Permissions by role</caption>
          <thead><tr className="text-xs text-[#586575]"><th scope="col" className="py-2 pr-3 font-bold">Permission</th>{staffRoles.map((role) => <th key={role} scope="col" className="w-24 py-2 pr-3 text-center font-bold">{staffRoleLabels[role]}</th>)}</tr></thead>
          {permissionGroups.map((group) => <tbody key={group.area}>
            <tr><th scope="rowgroup" colSpan={staffRoles.length + 1} className="pt-4 pb-1 text-xs font-extrabold tracking-wider text-[#1462C4] uppercase">{group.area}</th></tr>
            {group.permissions.map((permission) => <tr key={permission} className="border-t border-[#EEF2F6]">
              <td className="py-2 pr-3 text-[#344054]">{permissionDescriptions[permission]}</td>
              {staffRoles.map((role) => <td key={role} className="py-2 pr-3 text-center">{permissionsFor(role).includes(permission) ? <Check size={16} className="mx-auto text-[#067647]" aria-label="Yes" /> : <Minus size={16} className="mx-auto text-[#98A2B3]" aria-label="No" />}</td>)}
            </tr>)}
          </tbody>)}
        </table>
      </div>
    </Card>

    {!schemaMissing && <Card id="history" title="Recent changes">
      {changes.length ? <ol className="grid gap-2 text-sm">{changes.map((change) => <li key={change.id} className="flex flex-wrap gap-x-2 text-[#344054]"><span className="font-semibold text-[#586575]">{dateTime.format(new Date(change.at))}</span><span><strong className="text-[#071127]">{change.actor}</strong> {changeText(change)}</span></li>)}</ol> : <p className="text-sm text-[#586575]">No changes yet.</p>}
    </Card>}
  </div>;
}
