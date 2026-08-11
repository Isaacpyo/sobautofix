import { CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/container";

type PageHeroProps = {
  eyebrow?: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  cta?: boolean;
  compact?: boolean;
  showTrustFacts?: boolean;
};

export function PageHero({ eyebrow, title, body, children, actions, cta = true, compact = false, showTrustFacts = true }: PageHeroProps) {
  return (
    <section className={`hero-grid overflow-hidden text-white ${compact ? "py-10 sm:py-12 lg:py-14" : "py-16 sm:py-20 lg:py-24"}`}>
      <Container>
        <div className={children ? "grid items-center gap-10 lg:grid-cols-[1fr_.9fr]" : "max-w-3xl"}>
          <div>
            {eyebrow && <Eyebrow className="text-[#67B9FF]">{eyebrow}</Eyebrow>}
            <h1 className="text-balance text-4xl leading-[1] font-extrabold sm:text-5xl lg:text-6xl">{title}</h1>
            {body && <p className="mt-6 max-w-2xl text-lg leading-8 text-[#C6D2DF]">{body}</p>}
            {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : cta && <div className="mt-8 flex flex-wrap gap-3"><ButtonLink href="/book">Book appointment</ButtonLink><ButtonLink href="/get-a-quote" variant="secondary">Request an estimate</ButtonLink></div>}
            {showTrustFacts && <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#DCE6F2]"><span className="flex items-center gap-2"><CheckCircle2 size={17} className="text-[#67B9FF]" /> Professional testing</span><span className="flex items-center gap-2"><CheckCircle2 size={17} className="text-[#67B9FF]" /> Clear next steps</span></div>}
          </div>
          {children}
        </div>
      </Container>
    </section>
  );
}
