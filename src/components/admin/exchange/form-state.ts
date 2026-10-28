// Shared state shape for Vehicle Buying & Selling forms (useActionState).
// The submitted values come back on error so the form keeps what staff typed.

export type FormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  /** Changes on every result so forms can reset or re-key after success. */
  nonce?: number;
  /** Optional redirect target the client follows after success. */
  redirectTo?: string;
};

export const idleState: FormState = { status: "idle", message: "" };

export type FormAction = (previous: FormState, formData: FormData) => Promise<FormState>;

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string" || key.startsWith("$ACTION")) continue;
    values[key] = key in values ? `${values[key]}\n${value}` : value;
  }
  return values;
}

export function success(message: string, extra: Partial<FormState> = {}): FormState {
  return { status: "success", message, nonce: Date.now(), ...extra };
}

export function failure(message: string, formData?: FormData, fieldErrors?: Record<string, string>): FormState {
  return { status: "error", message, fieldErrors, values: formData ? formValues(formData) : undefined, nonce: Date.now() };
}
