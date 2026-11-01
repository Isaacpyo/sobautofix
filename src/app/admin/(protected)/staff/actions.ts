"use server";

import { revalidatePath } from "next/cache";
import { success, type FormState } from "@/components/admin/exchange/form-state";
import { parseForm, runStaffAction } from "@/lib/exchange/admin/core";
import { staffRoleLabels } from "@/lib/exchange/permissions";
import { inviteSchema, inviteStaff, memberSchema, removeAccess, resendInvite, restoreAccess, updateSchema, updateStaff } from "@/lib/staff/admin";

function refresh() {
  revalidatePath("/admin/staff");
  revalidatePath("/admin", "layout");
}

function delivered(result: { emailed: true } | { emailed: false; link: string }, emailedMessage: string): FormState {
  return result.emailed
    ? success(emailedMessage)
    : success("The invite email could not be sent. Copy the set-up link below and send it to them privately.", { link: result.link });
}

export async function inviteStaffAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("staff.manage", formData, async (staff) => {
    const input = parseForm(inviteSchema, formData);
    const result = await inviteStaff(staff, input);
    refresh();
    return delivered(result, `Invite sent to ${input.email} as ${staffRoleLabels[input.role]}.`);
  });
}

export async function resendInviteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("staff.manage", formData, async (staff) => {
    const result = await resendInvite(staff, parseForm(memberSchema, formData));
    refresh();
    return delivered(result, "A new invite has been sent.");
  });
}

export async function updateStaffAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("staff.manage", formData, async (staff) => {
    await updateStaff(staff, parseForm(updateSchema, formData));
    refresh();
    return success("Changes saved.");
  });
}

export async function removeAccessAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("staff.manage", formData, async (staff) => {
    await removeAccess(staff, parseForm(memberSchema, formData));
    refresh();
    return success("Access removed. They can no longer sign in.");
  });
}

export async function restoreAccessAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("staff.manage", formData, async (staff) => {
    await restoreAccess(staff, parseForm(memberSchema, formData));
    refresh();
    return success("Access restored. They can sign in again with their existing password.");
  });
}
