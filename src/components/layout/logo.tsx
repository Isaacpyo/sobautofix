import Image from "next/image";
import Link from "next/link";
import logo from "../../../assets/sobautofix_logo.png";
import inverseLogo from "../../../assets/sobautofix_logo-white.png";

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className="inline-flex shrink-0 items-center" aria-label="SOB Autofix home">
      <Image
        src={inverse ? inverseLogo : logo}
        alt=""
        sizes="108px"
        className="h-[4.5rem] w-auto object-contain"
      />
    </Link>
  );
}
