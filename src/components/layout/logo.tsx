import Image from "next/image";
import Link from "next/link";
import logo from "../../../assets/sobautofix_logo.png";
import inverseLogo from "../../../assets/sobautofix_logo-white.png";

export function Logo({ inverse = false, compact = false, imageClassName }: { inverse?: boolean; compact?: boolean; imageClassName?: string }) {
  return (
    <Link href="/" className="inline-flex shrink-0 items-center" aria-label="SOB Autofix home">
      <Image
        src={inverse ? inverseLogo : logo}
        alt=""
        sizes="108px"
        loading="eager"
        className={imageClassName ?? (compact ? "h-10 w-auto object-contain" : "h-[4.5rem] w-auto object-contain")}
      />
    </Link>
  );
}
