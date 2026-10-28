"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { addPrepItemAction, deletePrepItemAction, recordPreSaleInspectionAction, setPrepItemStatusAction, updatePrepItemAction } from "@/app/admin/(protected)/exchange/preparation/actions";
import { ActionForm, ConfirmButton, SelectField, SubmitButton, TextArea, TextField } from "./forms";
import { formatDate, inspectionOutcomeLabels, inspectionOutcomes, prepCategories, prepCategoryLabels, prepStatuses, prepStatusLabels, prepStatusTones } from "./labels";
import { Badge, buttonStyles } from "./ui";

type Item = { id: string; title: string; category: string; status: string; notes: string | null; due_on: string | null; assigned_to: string | null };
type Staff = Array<{ id: string; name: string }>;

const categoryOptions = prepCategories.map((value) => ({ value, label: prepCategoryLabels[value] }));
const statusOptions = prepStatuses.map((value) => ({ value, label: prepStatusLabels[value] }));

export function PrepItemRow({ item, staff, today, canEdit }: { item: Item; staff: Staff; today: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const overdue = item.due_on && item.due_on < today && (item.status === "todo" || item.status === "in_progress");
  const assignee = staff.find((member) => member.id === item.assigned_to)?.name;
  const next = item.status === "todo" ? "in_progress" : item.status === "in_progress" ? "done" : "todo";
  return <li className="rounded-lg border border-[#E4EAF0] bg-white p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className={`text-sm font-bold ${item.status === "done" || item.status === "not_required" ? "text-[#586575] line-through decoration-[#98A2B3]" : "text-[#071127]"}`}>{item.title}</p>
        <p className="text-xs text-[#586575]">{prepCategoryLabels[item.category as keyof typeof prepCategoryLabels] || item.category}{assignee ? ` · ${assignee}` : ""}{item.due_on ? <> · <span className={overdue ? "font-bold text-[#B42318]" : ""}>{overdue ? "Overdue: " : "Due "}{formatDate(item.due_on)}</span></> : null}</p>
        {item.notes && <p className="mt-1 text-xs whitespace-pre-wrap text-[#344054]">{item.notes}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={prepStatusTones[item.status as keyof typeof prepStatusTones]}>{prepStatusLabels[item.status as keyof typeof prepStatusLabels]}</Badge>
        {canEdit && <ActionForm action={setPrepItemStatusAction} hidden={{ itemId: item.id, status: next }} successMessage={false}><SubmitButton variant="secondary" className="min-h-10 px-3 text-xs" pendingLabel="…">{next === "in_progress" ? "Start" : next === "done" ? "Mark done" : "Reopen"}<span className="sr-only"> {item.title}</span></SubmitButton></ActionForm>}
        {canEdit && <button type="button" onClick={() => setEditing((value) => !value)} aria-expanded={editing} className={`${buttonStyles.secondary} min-h-10 px-3`}><Pencil size={14} aria-hidden="true" /><span className="sr-only">Edit {item.title}</span></button>}
      </div>
    </div>
    {editing && <div className="mt-3 border-t border-[#EEF2F6] pt-3">
      <ActionForm action={updatePrepItemAction} hidden={{ itemId: item.id }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField className="sm:col-span-2" name="title" label="Item" defaultValue={item.title} required maxLength={160} />
          <SelectField name="category" label="Category" defaultValue={item.category} options={categoryOptions} />
          <SelectField name="status" label="Status" defaultValue={item.status} options={statusOptions} />
          <SelectField name="assignedTo" label="Assigned to" defaultValue={item.assigned_to || ""} placeholder="Unassigned" options={staff.map((member) => ({ value: member.id, label: member.name }))} />
          <TextField name="dueOn" label="Due" type="date" defaultValue={item.due_on} />
          <TextArea className="sm:col-span-2" name="notes" label="Notes" rows={2} defaultValue={item.notes} />
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className={buttonStyles.secondary}>Close</button><SubmitButton>Save item</SubmitButton></div>
      </ActionForm>
      <ActionForm action={deletePrepItemAction} hidden={{ itemId: item.id }} className="mt-2 flex justify-end" successMessage={false}><ConfirmButton className="min-h-10 px-3 text-xs" title="Remove this item?" message={`Remove "${item.title}" from the checklist?`} confirmLabel="Remove item"><Trash2 size={14} aria-hidden="true" />Remove</ConfirmButton></ActionForm>
    </div>}
  </li>;
}

export function AddPrepItemForm({ vehicleId, staff }: { vehicleId: string; staff: Staff }) {
  return <details className="rounded-lg border border-dashed border-[#C9D5E2] p-3">
    <summary className="min-h-10 cursor-pointer text-sm font-extrabold text-[#1462C4]">Add a checklist item</summary>
    <ActionForm action={addPrepItemAction} hidden={{ vehicleId }} resetOnSuccess className="mt-2">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField className="sm:col-span-2" name="title" label="Item" required maxLength={160} placeholder="For example: replace rear wiper blade" />
        <SelectField name="category" label="Category" defaultValue="check" options={categoryOptions} />
        <TextField name="dueOn" label="Due" type="date" />
        <SelectField className="sm:col-span-2" name="assignedTo" label="Assigned to" defaultValue="" placeholder="Unassigned" options={staff.map((member) => ({ value: member.id, label: member.name }))} />
        <TextArea className="sm:col-span-2" name="notes" label="Notes" rows={1} />
      </div>
      <div className="mt-3 flex justify-end"><SubmitButton>Add item</SubmitButton></div>
    </ActionForm>
  </details>;
}

export function PreSaleInspectionForm({ vehicleId, inspector, today }: { vehicleId: string; inspector: string; today: string }) {
  return <details className="rounded-lg border border-dashed border-[#C9D5E2] p-3">
    <summary className="min-h-10 cursor-pointer text-sm font-extrabold text-[#1462C4]">Record a pre-sale inspection</summary>
    <ActionForm action={recordPreSaleInspectionAction} hidden={{ vehicleId }} resetOnSuccess className="mt-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="inspectedOn" label="Inspected on" type="date" defaultValue={today} required />
        <TextField name="inspectorName" label="Inspected by" defaultValue={inspector} required />
        <TextArea className="sm:col-span-2" name="scope" label="What was checked" rows={2} required />
        <TextArea className="sm:col-span-2" name="findings" label="Findings" rows={3} required hint="Staff record. Copy a customer-facing summary into Condition & disclosure if you want it on the listing." />
        <TextArea name="faults" label="Faults found (one per line)" rows={2} />
        <SelectField name="outcome" label="Outcome" defaultValue="recorded" options={inspectionOutcomes.map((value) => ({ value, label: inspectionOutcomeLabels[value] }))} />
      </div>
      <div className="mt-3 flex justify-end"><SubmitButton>Save inspection</SubmitButton></div>
    </ActionForm>
  </details>;
}
