"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, startTransition, useActionState, useContext, useEffect, useId, useRef, useState } from "react";
import { ConfirmActionDialog } from "@/components/admin/confirm-action-dialog";
import { cn } from "@/lib/utils";
import { idleState, type FormAction, type FormState } from "./form-state";
import { buttonStyles } from "./ui";

const FormContext = createContext<{ state: FormState; pending: boolean }>({ state: idleState, pending: false });

export function useFormContext() {
  return useContext(FormContext);
}

/**
 * A server-action form that shows field errors next to each control, keeps
 * the submitted values after a validation error and announces the result.
 */
export function ActionForm({ action, children, className, hidden, successMessage = true, resetOnSuccess = false, id, "aria-label": ariaLabel }: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  hidden?: Record<string, string | undefined | null>;
  successMessage?: boolean;
  resetOnSuccess?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success" && state.redirectTo) router.push(state.redirectTo);
  }, [router, state]);
  useEffect(() => {
    if (state.status !== "error" || !state.fieldErrors) return;
    const first = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']");
    first?.focus();
  }, [state]);
  return <FormContext.Provider value={{ state, pending }}>
    {/* Submitting through onSubmit (not the action prop) stops React resetting the
        form, so every control keeps what staff typed when validation fails. */}
    <form ref={formRef} id={id} aria-label={ariaLabel} aria-busy={pending || undefined} noValidate className={className} key={resetOnSuccess && state.status === "success" ? state.nonce : undefined} onSubmit={(event) => {
      event.preventDefault();
      if (pending) return;
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      const data = new FormData(event.currentTarget, submitter && submitter.form === event.currentTarget ? submitter : undefined);
      startTransition(() => formAction(data));
    }}>
      {Object.entries(hidden || {}).map(([name, value]) => value == null ? null : <input key={name} type="hidden" name={name} value={value} />)}
      {children}
      <FormMessage show={successMessage || state.status === "error"} />
    </form>
  </FormContext.Provider>;
}

export function FormMessage({ show = true }: { show?: boolean }) {
  const { state } = useFormContext();
  if (!show || state.status === "idle" || !state.message) return <p aria-live="polite" className="sr-only" />;
  return <p aria-live="polite" role={state.status === "error" ? "alert" : "status"} className={cn("mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm font-bold", state.status === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800")}>
    {state.status === "success" && <CheckCircle2 size={17} className="mt-0.5 shrink-0" aria-hidden="true" />}{state.message}
  </p>;
}

function useField(name: string, defaultValue?: string | number | null) {
  const { state } = useFormContext();
  const error = state.fieldErrors?.[name];
  const submitted = state.status === "error" ? state.values?.[name] : undefined;
  const value = submitted ?? (defaultValue == null ? "" : String(defaultValue));
  return { error, value, state };
}

const controlClass = "block w-full rounded-xl border bg-white px-3.5 text-sm text-[#071127] outline-none transition placeholder:text-[#8794A3] focus:border-[#1974E2] focus:ring-4 focus:ring-[#1974E2]/15 disabled:bg-[#F4F7FA] disabled:text-[#667586] read-only:bg-[#F4F7FA]";

function FieldShell({ id, label, hint, error, required, children, className }: { id: string; label: React.ReactNode; hint?: React.ReactNode; error?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return <div className={cn("min-w-0", className)}>
    <label htmlFor={id} className="block text-sm font-bold text-[#071127]">{label}{required && <span className="text-[#B42318]" aria-hidden="true"> *</span>}</label>
    {hint && <p id={`${id}-hint`} className="mt-0.5 text-xs leading-5 text-[#667586]">{hint}</p>}
    <div className="mt-1.5">{children}</div>
    {error && <p id={`${id}-error`} className="mt-1 text-xs font-bold text-red-700">{error}</p>}
  </div>;
}

function describedBy(id: string, hint?: React.ReactNode, error?: string) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

type InputProps = { name: string; label: React.ReactNode; hint?: React.ReactNode; defaultValue?: string | number | null; required?: boolean; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "defaultValue" | "required" | "className">;

export function TextField({ name, label, hint, defaultValue, required, className, ...props }: InputProps) {
  const id = useId();
  const { error, value } = useField(name, defaultValue);
  return <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
    <input id={id} name={name} defaultValue={value} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} aria-required={required || undefined} className={cn(controlClass, "min-h-11", error ? "border-red-400" : "border-[#D7E0E9]")} {...props} />
  </FieldShell>;
}

export function MoneyField(props: Omit<InputProps, "type" | "inputMode">) {
  return <TextField inputMode="decimal" placeholder="0" {...props} label={<>{props.label} <span className="font-semibold text-[#667586]">(£)</span></>} />;
}

export function TextArea({ name, label, hint, defaultValue, required, className, rows = 4, ...props }: { name: string; label: React.ReactNode; hint?: React.ReactNode; defaultValue?: string | null; required?: boolean; className?: string; rows?: number } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "defaultValue" | "required" | "className">) {
  const id = useId();
  const { error, value } = useField(name, defaultValue);
  return <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
    <textarea id={id} name={name} rows={rows} defaultValue={value} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} aria-required={required || undefined} className={cn(controlClass, "py-2.5 leading-6", error ? "border-red-400" : "border-[#D7E0E9]")} {...props} />
  </FieldShell>;
}

export function SelectField({ name, label, hint, defaultValue, required, className, options, placeholder, ...props }: { name: string; label: React.ReactNode; hint?: React.ReactNode; defaultValue?: string | null; required?: boolean; className?: string; options: ReadonlyArray<{ value: string; label: string }>; placeholder?: string } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name" | "defaultValue" | "required" | "className">) {
  const id = useId();
  const { error, value } = useField(name, defaultValue);
  return <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
    <select id={id} name={name} defaultValue={value} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} aria-required={required || undefined} className={cn(controlClass, "min-h-11 font-semibold", error ? "border-red-400" : "border-[#D7E0E9]")} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </FieldShell>;
}

export function CheckboxField({ name, label, hint, defaultChecked, className }: { name: string; label: React.ReactNode; hint?: React.ReactNode; defaultChecked?: boolean; className?: string }) {
  const id = useId();
  const { state } = useFormContext();
  const checked = state.status === "error" && state.values ? state.values[name] === "on" : Boolean(defaultChecked);
  return <div className={cn("flex items-start gap-3", className)}>
    <input id={id} type="checkbox" name={name} defaultChecked={checked} aria-describedby={hint ? `${id}-hint` : undefined} className="mt-0.5 size-5 shrink-0 accent-[#1974E2]" />
    <div><label htmlFor={id} className="text-sm font-bold text-[#071127]">{label}</label>{hint && <p id={`${id}-hint`} className="text-xs leading-5 text-[#667586]">{hint}</p>}</div>
  </div>;
}

export function SubmitButton({ children, pendingLabel = "Saving…", variant = "primary", className, name, value, disabled }: { children: React.ReactNode; pendingLabel?: string; variant?: keyof typeof buttonStyles; className?: string; name?: string; value?: string; disabled?: boolean }) {
  const { pending } = useFormContext();
  const [clicked, setClicked] = useState(false);
  useEffect(() => { if (!pending) setClicked(false); }, [pending]);
  const busy = pending && (clicked || !name);
  return <button type="submit" name={name} value={value} disabled={pending || disabled} onClick={() => setClicked(true)} aria-busy={busy || undefined} className={cn(buttonStyles[variant], className)}>
    {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}{busy ? pendingLabel : children}
  </button>;
}

/** A submit button that asks first. Use for destructive or customer-visible changes. */
export function ConfirmButton({ children, title, message, confirmLabel, variant = "danger", tone = "danger", name, value, className }: { children: React.ReactNode; title: string; message: string; confirmLabel?: string; variant?: keyof typeof buttonStyles; tone?: "danger" | "warning"; name?: string; value?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const { pending, state } = useFormContext();
  const hiddenRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setOpen(false); }, [state]);
  return <>
    {name && <input ref={hiddenRef} type="hidden" name={name} value={value} />}
    <button type="button" onClick={() => setOpen(true)} disabled={pending} className={cn(buttonStyles[variant], className)}>{children}</button>
    <ConfirmActionDialog open={open} pending={pending} tone={tone} title={title} message={message} confirmLabel={confirmLabel || children} confirmType="submit" onCancel={() => setOpen(false)} />
  </>;
}
