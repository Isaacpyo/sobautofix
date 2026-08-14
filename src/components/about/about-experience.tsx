"use client";

import { ArrowDown, ArrowRight, MapPin, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import heroImage from "../../../assets/sobautofix-pics (3).png";
import workshopImage from "../../../assets/sobautofix-pics (10).png";
import { contactLinks, siteConfig } from "@/config/site";
import styles from "./about-experience.module.css";
import { HomeCoverageMap } from "@/components/marketing/home-coverage-map";

const diagnosisSteps = [
  {
    label: "Understand",
    title: "Understand the symptoms",
    body: "We start with what the vehicle is doing, when the problem occurs and which warning signs have already appeared.",
  },
  {
    label: "Scan",
    title: "Read the vehicle's data",
    body: "Relevant systems are scanned to gather evidence and identify where focused investigation should begin.",
  },
  {
    label: "Test",
    title: "Test, don't assume",
    body: "Targeted electrical and mechanical checks help separate the recorded symptom from the underlying cause.",
  },
  {
    label: "Explain",
    title: "Make the findings clear",
    body: "We explain what has been found, what it means and the practical routes available before repair work proceeds.",
  },
  {
    label: "Repair",
    title: "Take the right next step",
    body: "Suitable work can be completed through the workshop, a mobile appointment or the appropriate specialist route.",
  },
] as const;

const principles = [
  {
    title: "Evidence before assumptions",
    body: "A warning light is a starting point, not a diagnosis. We follow the vehicle's symptoms and test results to the real fault.",
  },
  {
    title: "Explain before repair",
    body: "Clear findings come first, so the next decision is based on what the vehicle actually needs.",
  },
  {
    title: "Practical next steps",
    body: "Workshop, mobile and specialist routes are chosen around the fault, access required and condition of the vehicle.",
  },
] as const;

const capabilities = [
  {
    index: "01",
    title: "Diagnostics",
    body: "System scans, live data and targeted testing for warning lights, running concerns and intermittent faults.",
    href: "/diagnostics",
    className: styles.capabilityLarge,
  },
  {
    index: "02",
    title: "Electrical",
    body: "Evidence-led fault finding across starting, charging, wiring, sensors and control systems.",
    href: "/diagnostics/electrical-fault-finding",
    className: styles.capabilitySmall,
  },
  {
    index: "03",
    title: "Mechanical",
    body: "Practical repairs and maintenance once the cause and appropriate repair scope are understood.",
    href: "/services/repairs-maintenance",
    className: styles.capabilitySmall,
  },
  {
    index: "04",
    title: "Mobile / specialist",
    body: "Suitable support at the vehicle's location, with a clear route onward when workshop access is needed.",
    href: "/services/mobile-specialist",
    className: styles.capabilityLarge,
  },
] as const;

const services = ["Diagnostics", "Electrical", "Engine", "Brakes", "Suspension", "Servicing", "Modules", "Mobile support"];

function RevealArrow() {
  return <ArrowRight aria-hidden="true" size={17} />;
}

export function AboutExperience() {
  const pageRef = useRef<HTMLElement>(null);
  const storyMediaRef = useRef<HTMLDivElement>(null);
  const metricRef = useRef<HTMLDivElement>(null);
  const processRefs = useRef<Array<HTMLElement | null>>([]);
  const principleRefs = useRef<Array<HTMLElement | null>>([]);
  const [activeProcess, setActiveProcess] = useState(0);
  const [activePrinciple, setActivePrinciple] = useState(0);
  const [years, setYears] = useState<number>(siteConfig.yearsInBusiness);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealItems = Array.from(page.querySelectorAll<HTMLElement>("[data-reveal]"));
    page.dataset.motionReady = "true";

    if (reducedMotion) {
      revealItems.forEach((item) => { item.dataset.visible = "true"; });
      return;
    }

    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).dataset.visible = "true";
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10%", threshold: 0.12 });

    revealItems.forEach((item) => revealObserver.observe(item));
    return () => revealObserver.disconnect();
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    let frame = 0;
    const updateScrollEffects = () => {
      frame = 0;
      setHasScrolled(window.scrollY > 48);
      const media = storyMediaRef.current;
      if (!media) return;
      const rect = media.getBoundingClientRect();
      const centreOffset = (window.innerHeight / 2 - (rect.top + rect.height / 2)) / window.innerHeight;
      const shift = Math.max(-18, Math.min(18, centreOffset * 28));
      media.style.setProperty("--story-shift", `${shift}px`);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateScrollEffects);
    };
    updateScrollEffects();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const processObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActiveProcess(Number((entry.target as HTMLElement).dataset.step));
      });
    }, { rootMargin: "-36% 0px -50%", threshold: 0 });
    const principleObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActivePrinciple(Number((entry.target as HTMLElement).dataset.step));
      });
    }, { rootMargin: "-34% 0px -50%", threshold: 0 });

    processRefs.current.forEach((item) => item && processObserver.observe(item));
    principleRefs.current.forEach((item) => item && principleObserver.observe(item));
    return () => {
      processObserver.disconnect();
      principleObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const target = metricRef.current;
    if (!target) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    let animationFrame = 0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      setYears(0);
      const started = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - started) / 650);
        setYears(Math.round(progress * siteConfig.yearsInBusiness));
        if (progress < 1) animationFrame = window.requestAnimationFrame(tick);
      };
      animationFrame = window.requestAnimationFrame(tick);
    }, { threshold: 0.35 });
    observer.observe(target);
    return () => {
      observer.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <article ref={pageRef} className={styles.page}>
      <section className={styles.hero} aria-labelledby="about-title">
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroImage} aria-hidden="true">
          <Image src={heroImage} alt="" fill priority sizes="(min-width: 900px) 55vw, 100vw" className={styles.coverImage} />
        </div>
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.heroEyebrow}><span />Who we are</p>
            <h1 id="about-title" className={styles.heroTitle}>Diagnosis-led<br /><span>automotive care.</span></h1>
            <p className={styles.heroBody}>Professional vehicle diagnostics, electrical fault finding and practical repair support across Doncaster and surrounding areas.</p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/book">Book an appointment <RevealArrow /></Link>
              <Link className={styles.secondaryButton} href="/services">Explore our services <RevealArrow /></Link>
            </div>
          </div>
          <div className={styles.heroTechnical} aria-hidden="true">
            <span>Vehicle signal</span>
            <div className={styles.waveform}><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            <strong>LIVE / TEST / EXPLAIN</strong>
          </div>
        </div>
        <a className={`${styles.scrollPrompt} ${hasScrolled ? styles.scrollPromptHidden : ""}`} href="#our-story">
          <span>Scroll to discover</span><i /><ArrowDown aria-hidden="true" size={14} />
        </a>
      </section>

      <section id="our-story" className={styles.storySection}>
        <div className={styles.storyGrid}>
          <div ref={storyMediaRef} className={styles.storyMedia} data-reveal="scale">
            <div className={styles.storyGlow} aria-hidden="true" />
            <div className={styles.storyImageFrame}>
              <Image src={workshopImage} alt="SOB Autofix technician carrying out workshop repair work" fill sizes="(min-width: 1024px) 57vw, 100vw" className={styles.storyImage} />
              <span className={styles.imageScan} aria-hidden="true" />
            </div>
            <div className={styles.imageAnnotation} aria-hidden="true"><span>01</span><i />Workshop / Doncaster</div>
          </div>
          <div className={styles.storyCopy} data-reveal="right">
            <p className={styles.eyebrow}>Our story</p>
            <h2>Built around finding the <span>real fault.</span></h2>
            <p className={styles.lead}>Replacing parts without identifying the cause can become expensive quickly. Our approach begins with the symptoms, the vehicle&apos;s data and targeted checks.</p>
            <p>Customers receive a practical explanation of what has been found and the sensible next step before repair work proceeds. That same direct approach carries across workshop and mobile support.</p>
            <div className={styles.storyRule}><span />Follow the evidence, then choose the repair.</div>
          </div>
        </div>
      </section>

      <section className={styles.philosophySection} aria-labelledby="philosophy-title">
        <div className={styles.philosophyGrid} aria-hidden="true" />
        <div className={styles.philosophyInner}>
          <p className={styles.eyebrowLight} data-reveal="up">The principle behind every job</p>
          <h2 id="philosophy-title">
            <span data-reveal="left">Diagnose first.</span>
            <span className={styles.accentLine} data-reveal="right">Repair second.</span>
          </h2>
          <div className={styles.signalRule} data-reveal="up" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
        </div>
      </section>

      <section className={styles.processSection} aria-labelledby="process-title">
        <div className={styles.processLayout}>
          <div className={styles.processIntro}>
            <p className={styles.eyebrow}>The diagnosis process</p>
            <h2 id="process-title">From uncertainty to a clear next step.</h2>
            <p>Each stage narrows the problem. Scroll through the process to see how the evidence builds.</p>
            <div className={styles.processProgress} aria-hidden="true">
              <span style={{ transform: `scaleX(${(activeProcess + 1) / diagnosisSteps.length})` }} />
            </div>
            <div className={styles.processCounter} aria-hidden="true">0{activeProcess + 1}<span>/ 0{diagnosisSteps.length}</span></div>
          </div>
          <ol className={styles.processSteps}>
            {diagnosisSteps.map((step, index) => (
              <li
                key={step.label}
                ref={(node) => { processRefs.current[index] = node; }}
                data-step={index}
                className={index === activeProcess ? styles.processStepActive : ""}
              >
                <div className={styles.stepMarker} aria-hidden="true"><span>0{index + 1}</span><i /></div>
                <div>
                  <p>{step.label}</p>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.trustSection} aria-label="SOB Autofix credentials and service options">
        <div ref={metricRef} className={styles.trustStrip} data-reveal="up">
          <div className={styles.metric} aria-label={`${siteConfig.yearsInBusiness} plus years in business`}><strong aria-hidden="true">{String(years).padStart(2, "0")}<sup>+</sup></strong><span>Years in business</span></div>
          <div className={styles.metric}><strong>NABTEB</strong><span>Technical training</span></div>
          <div className={styles.metric}><strong>Workshop</strong><span>+ mobile</span></div>
          <div className={styles.metric}><strong>All makes</strong><span>Supported</span></div>
        </div>
      </section>

      <div className={styles.marquee} role="region" aria-label={`Service capabilities: ${services.join(", ")}`} tabIndex={0}>
        <div className={styles.marqueeTrack} aria-hidden="true">
          {[...services, ...services].map((service, index) => <span key={`${service}-${index}`}>{service}<i>•</i></span>)}
        </div>
      </div>

      <section className={styles.capabilitiesSection} aria-labelledby="capabilities-title">
        <div className={styles.capabilityHeading} data-reveal="up">
          <p className={styles.eyebrowLight}>What we work across</p>
          <h2 id="capabilities-title">From warning lights<br />to mechanical faults.</h2>
          <p>One diagnosis-led approach across electrical, mechanical, workshop and mobile work.</p>
        </div>
        <div className={styles.capabilityGrid}>
          {capabilities.map((capability) => (
            <Link key={capability.title} href={capability.href} className={`${styles.capabilityCard} ${capability.className}`} data-reveal="up">
              <span>{capability.index}</span>
              <div><h3>{capability.title}</h3><p>{capability.body}</p></div>
              <RevealArrow />
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.principlesSection} aria-labelledby="principles-title">
        <div className={styles.principlesLayout}>
          <div className={styles.principlesIntro}>
            <p className={styles.eyebrow}>How we work</p>
            <h2 id="principles-title">Clear answers before unnecessary parts.</h2>
            <div className={styles.principleStatus} aria-hidden="true">
              {principles.map((_, index) => <span key={index} className={index === activePrinciple ? styles.principleStatusActive : ""} />)}
            </div>
          </div>
          <ol className={styles.principlesList}>
            {principles.map((principle, index) => (
              <li
                key={principle.title}
                ref={(node) => { principleRefs.current[index] = node; }}
                data-step={index}
                className={index === activePrinciple ? styles.principleActive : ""}
              >
                <span>0{index + 1}</span>
                <h3>{principle.title}</h3>
                <p>{principle.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.localSection} aria-labelledby="local-title">
        <div className={styles.localGrid} aria-hidden="true" />
        <div className={styles.localMap}><HomeCoverageMap doncasterOnly variant="dark" /></div>
        <div className={styles.localContent} data-reveal="left">
          <p className={styles.eyebrowLight}><MapPin aria-hidden="true" size={14} />Local identity</p>
          <h2 id="local-title"><span>Based in</span>Doncaster.</h2>
        </div>
      </section>

      <section className={styles.ctaSection} aria-labelledby="cta-title">
        <div className={styles.ctaGlow} aria-hidden="true" />
        <div className={styles.ctaGrid} aria-hidden="true" />
        <div className={styles.ctaContent} data-reveal="up">
          <p className={styles.eyebrowLight}>Start with the symptoms</p>
          <h2 id="cta-title">Got a fault you cannot explain?</h2>
          <p>Tell us what the vehicle is doing and we&apos;ll help you choose the right next step.</p>
          <div className={styles.ctaActions}>
            <Link className={styles.primaryButton} href="/book">Book an appointment <RevealArrow /></Link>
            <Link className={styles.secondaryButton} href="/get-a-quote">Get a quote <RevealArrow /></Link>
            <a className={styles.callLink} href={contactLinks.phone}><Phone aria-hidden="true" size={16} />Call SOB Autofix</a>
          </div>
        </div>
      </section>
    </article>
  );
}
