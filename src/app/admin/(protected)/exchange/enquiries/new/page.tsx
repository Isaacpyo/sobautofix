import Link from "next/link";
import { ActionForm, SelectField, SubmitButton, TextArea, TextField } from "@/components/admin/exchange/forms";
import { preferredContactLabels, runningStatusLabels } from "@/components/admin/exchange/labels";
import { Card, NoAccess, PageHeading } from "@/components/admin/exchange/ui";
import { BackLink } from "@/components/ui/back-link";
import { enquiryVehicleOptions } from "@/lib/exchange/admin/enquiries-admin";
import { requireStaffPage } from "@/lib/exchange/staff";
import { vehicleSalesOptions } from "@/lib/vehicle/sales-options";
import { cn } from "@/lib/utils";
import { createStaffBuyingEnquiryAction, createStaffSalesEnquiryAction } from "./actions";

const contactOptions = Object.entries(preferredContactLabels).map(([value, label]) => ({ value, label }));

export default async function NewStaffEnquiryPage({ searchParams }: { searchParams: Promise<{ type?: string; vehicle?: string }> }) {
  const params = await searchParams;
  const type = params.type === "buying" ? "buying" : "sales";
  const { staff, allowed } = await requireStaffPage(type === "buying" ? "buying.manage" : "sales.manage");
  if (!allowed || !staff.can("customers.view")) return <NoAccess area={type === "buying" ? "buying enquiries" : "sales enquiries"} />;
  const vehicles = await enquiryVehicleOptions(staff, type === "buying" ? ["available", "reserved"] : ["available", "reserved", "preparation"]);

  return <>
    <BackLink href={type === "buying" ? "/admin/exchange/buying" : "/admin/exchange/sales"}>Back to {type === "buying" ? "Buying" : "Sales"} Enquiries</BackLink>
    <div className="mt-3"><PageHeading eyebrow="Staff-created enquiry" title={type === "buying" ? "New buying enquiry" : "New sales enquiry"} description="For enquiries taken by phone, WhatsApp or in person. It joins the same pipeline as website enquiries and is assigned to you. No email is sent to the customer." /></div>
    <nav aria-label="Enquiry type" className="mt-4 inline-flex rounded-xl bg-[#EEF2F6] p-1">
      {(["sales", "buying"] as const).map((value) => <Link key={value} aria-current={type === value ? "page" : undefined} href={`/admin/exchange/enquiries/new?type=${value}`} className={cn("inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-bold", type === value ? "bg-white text-[#1462C4] shadow-sm" : "text-[#586575]")}>{value === "sales" ? "Customer wants to buy" : "Customer wants to sell"}</Link>)}</nav>

    <ActionForm action={type === "buying" ? createStaffBuyingEnquiryAction : createStaffSalesEnquiryAction} className="mt-4 grid max-w-4xl gap-4" aria-label="New enquiry">
      <Card title="Customer">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="name" label="Name" required autoComplete="off" />
          <TextField name="phone" label="Phone" type="tel" required autoComplete="off" />
          <TextField name="email" label="Email" type="email" autoComplete="off" hint="Needed to reply from the conversation." />
          <SelectField name="preferredContact" label="Prefers" defaultValue="phone" options={contactOptions} />
        </div>
      </Card>
      {type === "sales" ? <Card title="Vehicle">
        <SelectField name="vehicleId" label="Which vehicle are they interested in?" defaultValue={params.vehicle || ""} placeholder="Not a specific vehicle" options={vehicles} />
      </Card> : <Card title="Their vehicle" description="Record what the customer tells you. Leave anything unknown blank.">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField name="kind" label="Type" defaultValue="sell" options={[{ value: "sell", label: "Sell to us" }, { value: "part_exchange", label: "Part exchange" }]} />
          <SelectField name="interestedVehicleId" label="Part exchange towards" defaultValue={params.vehicle || ""} placeholder="Not a part exchange" options={vehicles} />
          <TextField name="registration" label="Registration" autoComplete="off" />
          <TextField name="postcode" label="Postcode" autoComplete="off" />
          <TextField name="make" label="Make" />
          <TextField name="model" label="Model" />
          <TextField name="year" label="Year" inputMode="numeric" />
          <TextField name="mileage" label="Mileage" inputMode="numeric" />
          <SelectField name="fuelType" label="Fuel" placeholder="Not known" options={vehicleSalesOptions.fuelType.map((value) => ({ value, label: value }))} />
          <SelectField name="transmission" label="Transmission" placeholder="Not known" options={vehicleSalesOptions.transmission.map((value) => ({ value, label: value }))} />
          <SelectField name="runningStatus" label="Running" defaultValue="not_sure" options={Object.entries(runningStatusLabels).map(([value, label]) => ({ value, label }))} />
          <TextArea className="md:col-span-2" name="knownFaults" label="Known faults" rows={2} />
        </div>
      </Card>}
      <Card title="Notes">
        <TextArea name="notes" label="What the customer wants" rows={4} required hint="Starts the conversation thread. Staff only unless you reply." />
      </Card>
      <div className="flex justify-end"><SubmitButton pendingLabel="Creating…">Create enquiry</SubmitButton></div>
    </ActionForm>
  </>;
}
