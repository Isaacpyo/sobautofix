import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return <section className="hero-grid py-32 text-center text-white"><Container><p className="text-sm font-bold tracking-widest text-[#67B9FF] uppercase">Page unavailable</p><h1 className="mt-4 text-6xl font-extrabold">We couldn’t find that page.</h1><p className="mx-auto mt-5 max-w-xl text-[#C6D2DF]">The content may still be awaiting approval or the address may have changed.</p><ButtonLink className="mt-8" href="/">Return home</ButtonLink></Container></section>;
}
