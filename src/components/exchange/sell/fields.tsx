"use client";

import type { ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { cn } from "@/lib/utils";
import { errorClass, hintClass, inputClass, labelClass } from "../ui";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <span id={id} className={errorClass}>{message}</span>;
}

export function TextField({ id, label, hint, error, registration, optional, className, ...input }: { id: string; label: string; hint?: string; error?: string; registration: UseFormRegisterReturn; optional?: boolean; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>{label}{optional && <span className="font-normal text-[#5B6575]"> (optional)</span>}</label>
      {hint && <span id={`${id}-hint`} className={hintClass}>{hint}</span>}
      <input id={id} {...registration} {...input} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cn(inputClass, "mt-1.5")} />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function TextAreaField({ id, label, hint, error, registration, optional, rows = 3, placeholder }: { id: string; label: string; hint?: string; error?: string; registration: UseFormRegisterReturn; optional?: boolean; rows?: number; placeholder?: string }) {
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}{optional && <span className="font-normal text-[#5B6575]"> (optional)</span>}</label>
      {hint && <span id={`${id}-hint`} className={hintClass}>{hint}</span>}
      <textarea id={id} {...registration} rows={rows} placeholder={placeholder} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cn(inputClass, "mt-1.5 min-h-24")} />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** Radio choices as large tappable cards. */
export function ChoiceGroup({ id, legend, hint, error, registration, options, columns = 2, children }: { id: string; legend: string; hint?: string; error?: string; registration: UseFormRegisterReturn; options: Array<{ value: string; label: string; description?: string }>; columns?: 1 | 2 | 3 | 4; children?: ReactNode }) {
  return (
    <fieldset aria-describedby={[hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}>
      <legend className={labelClass}>{legend}</legend>
      {hint && <span id={`${id}-hint`} className={hintClass}>{hint}</span>}
      <div className={cn("mt-2 grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "grid-cols-1 min-[420px]:grid-cols-3", columns === 4 && "grid-cols-2 sm:grid-cols-4")}>
        {options.map((option) => (
          <label key={option.value} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-[#C9D3E0] bg-white px-4 py-3 text-[15px] has-[:checked]:border-[#1974E2] has-[:checked]:bg-[#EAF2FD] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[rgba(22,139,255,.55)]">
            <input type="radio" value={option.value} {...registration} className="mt-0.5 size-5 shrink-0 accent-[#1974E2]" />
            <span><span className="font-semibold text-[#0B1220]">{option.label}</span>{option.description && <span className="block text-sm text-[#5B6575]">{option.description}</span>}</span>
          </label>
        ))}
      </div>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </fieldset>
  );
}
