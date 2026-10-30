import { cn } from "@/lib/utils";

/**
 * Registration entry styled as a UK rear number plate: yellow plate, bold
 * condensed characters and the blue UK identifier band. The placeholder uses
 * the same lettering so the empty field already reads as a plate.
 */
export function NumberPlateInput({ wrapperClassName, className, ...props }: React.ComponentProps<"input"> & { wrapperClassName?: string }) {
  return (
    <div className={cn("flex min-h-14 w-full overflow-hidden rounded-xl border-2 border-[#0B1220] bg-[#FFD84D] focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[#1974E2]", wrapperClassName)}>
      <span aria-hidden="true" className="flex w-10 shrink-0 items-end justify-center bg-[#003399] pb-1.5 text-[13px] font-bold tracking-wide text-white">UK</span>
      <input
        placeholder="ENTER REG"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={10}
        {...props}
        className={cn("w-full min-w-0 flex-1 bg-transparent px-3 text-center exchange-display text-[28px] font-bold tracking-[.1em] text-[#0B1220] uppercase placeholder:text-[#0B1220]/60 focus:outline-none", className)}
      />
    </div>
  );
}
