"use client";

import { LoaderCircle, MonitorSmartphone, X } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { revokeEveryTrustedDevice, revokeTrustedDevice } from "./actions";

type Device = { id: string; device_label: string; created_at: string; expires_at: string; last_used_at: string; current: boolean };

const formatDate = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));

export function TrustedDevicesPanel({ devices }: { devices: Device[] }) {
  const [revokeState, revokeAction, revokePending] = useActionState(revokeTrustedDevice, { message: "" });
  const [allState, allAction, allPending] = useActionState(revokeEveryTrustedDevice, { message: "" });
  const [confirmAll, setConfirmAll] = useState(false);
  return <section className="mt-10 rounded-2xl border border-[#E4EAF0] bg-white p-6 sm:p-7" aria-labelledby="trusted-devices-heading">
    <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#1974E2]"><MonitorSmartphone size={21} /></span><div><h2 id="trusted-devices-heading" className="text-xl font-bold text-[#071127]">Trusted devices</h2><p className="mt-2 text-sm leading-6 text-[#586575]">Browsers you&apos;ve chosen to remember for MFA. Trust expires seven days after it is granted.</p></div></div>
    {(revokeState.message || allState.message) && <p role="status" className="mt-5 rounded-xl bg-[#F4F7FA] p-4 text-sm font-semibold text-[#344256]">{revokeState.message || allState.message}</p>}
    <div className="mt-6 divide-y divide-[#E4EAF0] border-y border-[#E4EAF0]">{devices.map((device) => <article key={device.id} className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#071127]">{device.device_label}</h3>{device.current && <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">This device</span>}</div><p className="mt-2 text-xs leading-5 text-[#667586]">Trusted {formatDate(device.created_at)} · Last used {formatDate(device.last_used_at)} · Expires {formatDate(device.expires_at)}</p></div><form action={revokeAction}><input type="hidden" name="deviceId" value={device.id} /><Button type="submit" variant="outline" disabled={revokePending}>Revoke</Button></form></article>)}{!devices.length && <p className="py-6 text-sm text-[#667586]">No active trusted devices.</p>}</div>
    {devices.length > 0 && <Button type="button" variant="outline" className="mt-6 border-red-200 text-red-800 hover:bg-red-50" onClick={() => setConfirmAll(true)}>Revoke all trusted devices</Button>}
    {confirmAll && <div className="fixed inset-0 z-[70] grid place-items-center bg-[#071127]/65 p-5" role="dialog" aria-modal="true" aria-labelledby="revoke-all-title"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-end"><button type="button" onClick={() => setConfirmAll(false)} aria-label="Cancel" className="grid size-10 place-items-center rounded-full text-[#667586] hover:bg-[#F4F7FA]"><X size={19} /></button></div><h3 id="revoke-all-title" className="text-2xl font-bold text-[#071127]">Revoke all trusted devices?</h3><p className="mt-3 text-sm leading-6 text-[#586575]">Every remembered browser will require an authenticator code after its next password sign-in.</p><form action={allAction} className="mt-6 flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setConfirmAll(false)}>Cancel</Button><Button type="submit" disabled={allPending} className="bg-red-700 hover:bg-red-800">{allPending ? <><LoaderCircle size={18} className="animate-spin" />Revoking…</> : "Revoke all"}</Button></form></div></div>}
  </section>;
}
