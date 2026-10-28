import { Check, Minus } from "lucide-react";
import { ActionForm, SelectField, SubmitButton, TextArea, TextField } from "@/components/admin/exchange/forms";
import { Badge, Card, NoAccess, Notice, PageHeading } from "@/components/admin/exchange/ui";
import { exchangePolicyPages, NOT_PUBLISHED_COPY } from "@/config/exchange";
import { loadSettingsForEdit } from "@/lib/exchange/admin/settings-admin";
import { permissionDescriptions, permissionsFor, staffRoleLabels, staffRoles } from "@/lib/exchange/permissions";
import { requireStaffPage } from "@/lib/exchange/staff";
import { changeStaffRoleAction, savePrivateSettingsAction, savePublicSettingsAction } from "./actions";

const blankMeans = "Leave blank if not yet approved: the site then says the information is being finalised.";

export default async function ExchangeSettingsPage() {
  const { staff, allowed } = await requireStaffPage("settings.manage");
  if (!allowed) return <NoAccess area="settings" />;
  const { publicSettings: p, privateSettings: v, staff: people } = await loadSettingsForEdit(staff);

  return <>
    <PageHeading eyebrow="Owner only" title="Settings" description="Customer-facing copy, policies, operating rules and staff roles for SOB Auto Exchange." />
    <nav aria-label="Settings sections" className="mt-4 flex flex-wrap gap-2 text-sm font-bold">{[["#copy", "Website copy"], ["#policies", "Policies"], ["#operations", "Notifications and rules"], ["#handover", "Handover checklist"], ["#roles", "Staff roles"]].map(([href, text]) => <a key={href} href={href} className="inline-flex min-h-10 items-center rounded-full border border-[#D7E0E9] bg-white px-3.5 text-[#344054] hover:border-[#1974E2]">{text}</a>)}</nav>
    <div className="mt-4"><Notice tone="info" title="Empty means not published">Any blank customer-facing field shows: “{NOT_PUBLISHED_COPY}” Only enter wording that has been approved. Never promise response times, warranty cover or payment terms that are not agreed.</Notice></div>

    <ActionForm action={savePublicSettingsAction} className="mt-4 grid gap-4" aria-label="Customer-facing settings">
      <Card id="copy" title="Website copy" description="Name, contact details and the How buying works page.">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="name" label="Trading name" defaultValue={p.name} required hint="Tentative name; change it here without a deploy." />
          <TextField name="shortName" label="Short name" defaultValue={p.shortName} required />
          <TextField className="md:col-span-2" name="tagline" label="Tagline" defaultValue={p.tagline} />
          <TextField className="md:col-span-2" name="heroHeading" label="Home page heading" defaultValue={p.heroHeading} />
          <TextArea className="md:col-span-2" name="heroBody" label="Home page introduction" rows={2} defaultValue={p.heroBody} />
          <TextField name="phone" label="Sales phone" defaultValue={p.phone} hint="Blank uses the main SOB Autofix number." />
          <TextField name="whatsapp" label="Sales WhatsApp" defaultValue={p.whatsapp} hint="Blank uses the main SOB Autofix WhatsApp." />
          <TextField name="email" label="Sales email" type="email" defaultValue={p.email} hint="Blank uses the main SOB Autofix email." />
          <TextArea name="openingHours" label="Viewing hours" rows={2} defaultValue={p.openingHours} hint="Blank says “call to confirm”." />
          <TextArea className="md:col-span-2" name="sellerResponsePromise" label="Seller response promise" rows={2} defaultValue={p.sellerResponsePromise} hint="Shown after a seller submits. Only fill in if the business has agreed a response time." />
          {([["buyingProcess", "How buying works"], ["viewingInformation", "Viewings"], ["paymentInformation", "Payment"], ["collectionDelivery", "Collection and delivery"], ["afterSales", "After-sales"], ["warrantyInformation", "Warranty and your statutory rights"], ["partExchangeInformation", "Part exchange"], ["inspectionProcess", "How we inspect cars we buy"]] as const).map(([name, text]) => <TextArea key={name} name={name} label={text} rows={4} defaultValue={p[name]} hint={blankMeans} />)}
        </div>
      </Card>
      <Card id="policies" title="Policies" description="Each policy has its own page. Paste the approved wording.">
        <div className="grid gap-4">{exchangePolicyPages.map((page) => <TextArea key={page.key} name={`policy_${page.key}`} label={<span className="flex flex-wrap items-center gap-2">{page.title}{p.policies[page.key] ? <Badge tone="success">Published</Badge> : <Badge>Not published</Badge>}</span>} rows={6} defaultValue={p.policies[page.key]} hint={`/policies/${page.slug}. ${blankMeans}`} />)}</div>
      </Card>
      <div className="flex justify-end"><SubmitButton>Save customer-facing settings</SubmitButton></div>
    </ActionForm>

    <ActionForm action={savePrivateSettingsAction} className="mt-6 grid gap-4" aria-label="Operating settings">
      <Card id="operations" title="Notifications and rules" description="Private to staff. Never shown to customers.">
        <div className="grid gap-4 md:grid-cols-2">
          <TextArea className="md:col-span-2" name="notificationRecipients" label="Who receives new enquiry, viewing and seller notifications" rows={3} defaultValue={v.notificationRecipients.join("\n")} hint="One email address per line, up to 10. Blank uses the existing enquiry notification address." />
          <TextField name="viewingLengthMinutes" label="Viewing length (minutes)" inputMode="numeric" defaultValue={v.viewingLengthMinutes} required />
          <TextField name="minimumPublishPhotos" label="Photos needed to publish" inputMode="numeric" defaultValue={v.minimumPublishPhotos} required />
          <TextField name="sellerRetentionMonths" label="Keep declined or closed seller details for (months)" inputMode="numeric" defaultValue={v.sellerRetentionMonths} required hint="Photos, registration and notes are then removed." />
          <TextField name="reservationHoldDays" label="Default reservation hold (days)" inputMode="numeric" defaultValue={v.reservationHoldDays} required hint="0 means no default: staff set an end date per reservation if needed. Not shown to customers." />
        </div>
      </Card>
      <Card id="handover" title="Handover checklist" description="Steps staff tick before completing a sale. Each new reservation copies this list.">
        <TextArea name="handoverChecklist" label="Steps (one per line)" rows={6} defaultValue={v.handoverChecklist.join("\n")} hint="Leave blank until the business has agreed the steps. Nothing is invented: with no steps, sales can be completed without a checklist." />
      </Card>
      <div className="flex justify-end"><SubmitButton>Save operating settings</SubmitButton></div>
    </ActionForm>

    <Card id="roles" className="mt-6" title="Staff roles" description="Who can see costs, change prices, publish and change settings. Sign-in access itself is controlled by the staff allowlist.">
      <ul className="divide-y divide-[#EEF2F6]">{people.map((person) => <li key={person.id} className="flex flex-wrap items-end justify-between gap-3 py-3">
        <div className="min-w-0"><p className="font-bold text-[#071127]">{person.name}{person.id === staff.userId && <span className="ml-2 text-xs font-semibold text-[#586575]">(you)</span>}</p><p className="text-xs text-[#586575]">{staffRoleLabels[person.role]}</p></div>
        {person.id === staff.userId ? <p className="text-xs text-[#586575]">You cannot change your own role.</p> : <ActionForm action={changeStaffRoleAction} hidden={{ userId: person.id }} className="flex flex-wrap items-end gap-2" successMessage>
          <SelectField name="role" label={<span className="sr-only">Role for {person.name}</span>} defaultValue={person.role} options={staffRoles.map((role) => ({ value: role, label: staffRoleLabels[role] }))} />
          <SubmitButton variant="secondary" pendingLabel="Saving…">Change role</SubmitButton>
        </ActionForm>}
      </li>)}</ul>
      <details className="mt-4 rounded-lg border border-[#E4EAF0] p-3"><summary className="min-h-10 cursor-pointer text-sm font-extrabold text-[#1462C4]">What each role can do</summary>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-xs"><caption className="sr-only">Permissions by role</caption><thead><tr><th scope="col" className="py-1 pr-3">Permission</th>{staffRoles.map((role) => <th key={role} scope="col" className="py-1 pr-3 text-center">{staffRoleLabels[role]}</th>)}</tr></thead>
          <tbody>{Object.entries(permissionDescriptions).map(([permission, description]) => <tr key={permission} className="border-t border-[#EEF2F6]"><td className="py-1.5 pr-3">{description}</td>{staffRoles.map((role) => <td key={role} className="py-1.5 pr-3 text-center">{permissionsFor(role).includes(permission as never) ? <Check size={14} className="mx-auto text-[#067647]" aria-label="Yes" /> : <Minus size={14} className="mx-auto text-[#98A2B3]" aria-label="No" />}</td>)}</tr>)}</tbody></table></div>
      </details>
    </Card>
  </>;
}
