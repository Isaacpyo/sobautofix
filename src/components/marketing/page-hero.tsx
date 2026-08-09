import { CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/container";

export function PageHero({ eyebrow, title, body, children, cta = true }: { eyebrow: string; title: string; body: string; children?: React.ReactNode; cta?: boolean }) {
  return (
    <section className="hero-grid overflow-hidden py-16 text-white sm:py-20 lg:py-24">
      <Container>
        <div className={children ? "grid items-center gap-10 lg:grid-cols-[1fr_.9fr]" : "max-w-3xl"}>
          <div>
            <Eyebrow className="text-[#67B9FF]">{eyebrow}</Eyebrow>
            <h1 className="text-balance text-5xl leading-[.95] font-extrabold sm:text-6xl lg:text-7xl">{title}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#C6D2DF]">{body}</p>
            {cta && <div className="mt-8 flex flex-wrap gap-3"><ButtonLink href="/book">Book appointment</ButtonLink><ButtonLink href="/get-a-quote" variant="secondary">Request an estimate</ButtonLink></div>}
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#DCE6F2]"><span className="flex items-center gap-2"><CheckCircle2 size={17} className="text-[#67B9FF]" /> Professional testing</span><span className="flex items-center gap-2"><CheckCircle2 size={17} className="text-[#67B9FF]" /> Clear next steps</span></div>
          </div>
          {children}
        </div>
      </Container>
    </section>
  );
}
