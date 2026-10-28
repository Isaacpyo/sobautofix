import { ButtonLink, Container } from "@/components/exchange/ui";
import { exchangeHref } from "@/lib/exchange/host";
import { getExchangeBase } from "@/lib/exchange/links";

export default async function ExchangeNotFound() {
  const base = await getExchangeBase();
  return (
    <Container className="py-16 text-center sm:py-24">
      <p className="text-sm font-semibold tracking-[.08em] text-[#1462C4] uppercase">Page not found</p>
      <h1 className="mt-2 text-[40px] leading-none font-bold text-[#0B1220]">We could not find that page</h1>
      <p className="mx-auto mt-4 max-w-md leading-7 text-[#5B6575]">The car may have been sold or withdrawn, or the link may be out of date.</p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <ButtonLink href={exchangeHref(base, "/cars")}>Browse cars</ButtonLink>
        <ButtonLink href={exchangeHref(base, "/")} variant="secondary">Home</ButtonLink>
      </div>
    </Container>
  );
}
