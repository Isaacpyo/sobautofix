import Link from "next/link";

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-3" aria-label="SOB Autofix home">
      <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#67B9FF]/35 bg-[#1974E2]/15 text-lg font-black text-[#67B9FF]">S</span>
      <span className="leading-none">
        <span className="block font-[family-name:var(--font-barlow)] text-xl font-extrabold tracking-tight"><span className="text-[#168BFF]">SOB</span> <span className={inverse ? "text-white" : "text-[#071127]"}>AUTOFIX</span></span>
        <span className={inverse ? "mt-1 block text-[9px] font-bold tracking-[0.18em] text-[#DCE6F2] uppercase" : "mt-1 block text-[9px] font-bold tracking-[0.18em] text-[#586575] uppercase"}>Diagnosis · Repair · Sales</span>
      </span>
    </Link>
  );
}
