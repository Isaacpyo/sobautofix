// Diagonal corner ribbon laid over a vehicle photo; the parent must be `relative overflow-hidden`.
export function SoldBanner({ size = "md" }: { size?: "md" | "lg" }) {
  const large = size === "lg";
  return (
    <span className={`pointer-events-none absolute z-10 rotate-45 bg-[#B42318] text-center font-black tracking-[.3em] text-white uppercase shadow-lg ${large ? "top-9 -right-14 w-64 py-2.5 text-lg sm:top-11 sm:-right-16 sm:w-72 sm:text-xl" : "top-6 -right-12 w-48 py-1.5 text-sm"}`}>
      Sold
    </span>
  );
}
