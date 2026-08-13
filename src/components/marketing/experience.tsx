import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/container";
import { cn } from "@/lib/utils";
import styles from "./experience.module.css";

export function SectionIntro({ eyebrow, title, body, inverted = false, className }: { eyebrow: string; title: string; body?: string; inverted?: boolean; className?: string }) {
  return <div className={cn(styles.intro, className)} data-reveal><div className={styles.marker} aria-hidden="true"><span /><span /></div><div><Eyebrow className={inverted ? "text-[#67B9FF]" : undefined}>{eyebrow}</Eyebrow><h2 className={cn(styles.heading, inverted && styles.inverted)}>{title}</h2>{body && <p className={cn(styles.body, inverted && styles.bodyInverted)}>{body}</p>}</div></div>;
}

export function ProcessFlow({ eyebrow = "The process", title, body, steps, dark = true }: { eyebrow?: string; title: string; body?: string; steps: Array<{ title: string; body?: string }>; dark?: boolean }) {
  return <section className={cn(styles.process, dark ? styles.processDark : styles.processLight)}><Container><SectionIntro eyebrow={eyebrow} title={title} body={body} inverted={dark} /><ol className={styles.processGrid}>{steps.map((step, index) => <li key={step.title} className={styles.processStep} data-reveal style={{ "--step": index } as React.CSSProperties}><div className={styles.processIndex}>0{index + 1}</div><div className={styles.processNode} aria-hidden="true" /><h3>{step.title}</h3>{step.body && <p>{step.body}</p>}</li>)}</ol></Container></section>;
}

export function TechnicalStatement({ eyebrow, lineOne, lineTwo, body }: { eyebrow: string; lineOne: string; lineTwo: string; body?: string }) {
  return <section className={styles.statement}><Container><div className={styles.statementGrid}><div className={styles.statementCode} aria-hidden="true">DATA / EVIDENCE / CAUSE</div><div data-reveal><Eyebrow className="text-[#67B9FF]">{eyebrow}</Eyebrow><h2><span>{lineOne}</span><strong>{lineTwo}</strong></h2>{body && <p>{body}</p>}</div></div></Container></section>;
}

export function PremiumCta({ eyebrow, title, body, primaryHref = "/book", primaryLabel = "Book appointment", secondaryHref = "/get-a-quote", secondaryLabel = "Request an estimate" }: { eyebrow: string; title: string; body?: string; primaryHref?: string; primaryLabel?: string; secondaryHref?: string; secondaryLabel?: string }) {
  return <section className={styles.cta}><Container className={styles.ctaGrid}><div data-reveal><Eyebrow className="text-[#67B9FF]">{eyebrow}</Eyebrow><h2>{title}</h2>{body && <p>{body}</p>}</div><div className={styles.ctaActions} data-reveal><ButtonLink href={primaryHref}>{primaryLabel}<ArrowRight size={17} /></ButtonLink><ButtonLink href={secondaryHref} variant="secondary">{secondaryLabel}</ButtonLink></div></Container></section>;
}
