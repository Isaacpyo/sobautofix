"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: error.name, digest: error.digest }),
      keepalive: true,
    });
  }, [error]);
  return <html lang="en-GB"><body><main className="grid min-h-screen place-items-center bg-[#030712] p-5 text-center text-white"><div><h1 className="text-5xl font-extrabold">Something went wrong.</h1><p className="mt-4 text-[#C6D2DF]">No form details were included in this error report.</p><button className="mt-7 rounded-lg bg-[#1974E2] px-5 py-3 font-bold" onClick={reset}>Try again</button></div></main></body></html>;
}
