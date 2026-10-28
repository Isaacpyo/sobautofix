"use server";

import { revalidatePath } from "next/cache";
import { success, type FormState } from "@/components/admin/exchange/form-state";
import { parseForm, revalidateExchangeAdmin, runStaffAction } from "@/lib/exchange/admin/core";
import { changeStaffRole, privateSettingsSchema, publicSettingsSchema, roleSchema, savePrivateSettings, savePublicSettings } from "@/lib/exchange/admin/settings-admin";

export async function savePublicSettingsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("settings.manage", formData, async (staff) => {
    await savePublicSettings(staff, parseForm(publicSettingsSchema, formData));
    revalidatePath("/exchange", "layout");
    revalidateExchangeAdmin();
    return success("Customer-facing settings saved. The exchange site shows them straight away.");
  });
}

export async function savePrivateSettingsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("settings.manage", formData, async (staff) => {
    await savePrivateSettings(staff, parseForm(privateSettingsSchema, formData));
    revalidatePath("/exchange", "layout");
    revalidateExchangeAdmin();
    return success("Operating settings saved.");
  });
}

export async function changeStaffRoleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  return runStaffAction("settings.manage", formData, async (staff) => {
    await changeStaffRole(staff, parseForm(roleSchema, formData));
    revalidateExchangeAdmin();
    return success("Role changed.");
  });
}
