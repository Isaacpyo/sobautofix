"use client";

import { LoaderCircle } from "lucide-react";

export function AdminLoadingModal({ title, description }: { title: string; description: string }) {
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#071127]/55 p-5 backdrop-blur-sm">
    <div role="dialog" aria-modal="true" aria-labelledby="admin-loading-title" aria-describedby="admin-loading-description" className="w-full max-w-sm rounded-2xl border border-white/20 bg-white p-7 text-center shadow-2xl">
      <LoaderCircle className="mx-auto animate-spin text-[#1974E2]" size={38} aria-hidden="true" />
      <h2 id="admin-loading-title" className="mt-4 text-xl font-extrabold text-[#071127]">{title}</h2>
      <p id="admin-loading-description" className="mt-2 text-sm text-[#667586]">{description}</p>
    </div>
  </div>;
}
