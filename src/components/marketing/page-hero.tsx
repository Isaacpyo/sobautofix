import { CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/container";
import { cn } from "@/lib/utils";
import styles from "./page-hero.module.css";

type PageHeroProps = {
  eyebrow?: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  cta?: boolean;
  compact?: boolean;
  tightTop?: boolean;
  showTrustFacts?: boolean;
};

export function PageHero({ eyebrow, title, body, children, actions, cta = true, compact = false, tightTop = false, showTrustFacts = true }: PageHeroProps) {
  return (
    <section className={cn(styles.hero, compact && styles.compact, tightTop ? "pt-4 pb-10 sm:pt-5 sm:pb-12 lg:pt-6 lg:pb-14" : compact ? "py-10 sm:py-12 lg:py-14" : "py-16 sm:py-20 lg:py-24")}>
      <span className={styles.scan} aria-hidden="true" />
      <Container className={styles.inner}>
        <div className={cn(styles.layout, children ? styles.withChildren : "max-w-4xl")}>
          <div className={styles.copy}>
            <span className={styles.index} aria-hidden="true">SOB / SYSTEM / 01</span>
            {eyebrow && <Eyebrow className="text-[#67B9FF]">{eyebrow}</Eyebrow>}
            <h1 className={styles.title}>{title}</h1>
            {body && <p className={styles.body}>{body}</p>}
            {actions ? <div className={styles.actions}>{actions}</div> : cta && <div className={styles.actions}><ButtonLink href="/book">Book appointment</ButtonLink><ButtonLink href="/get-a-quote" variant="secondary">Request an estimate</ButtonLink></div>}
            {showTrustFacts && <div className={styles.trust}><span><CheckCircle2 size={17} /> Professional testing</span><span><CheckCircle2 size={17} /> Clear next steps</span></div>}
          </div>
          {children && <div className={styles.children}>{children}<span className={styles.coordinate} aria-hidden="true">53.5228° N / 1.1285° W</span></div>}
        </div>
      </Container>
    </section>
  );
}
