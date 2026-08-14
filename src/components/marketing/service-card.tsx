import { ArrowUpRight, CircuitBoard, Cog, Gauge, Wrench } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import styles from "./service-card.module.css";

const icons = { diagnostic: CircuitBoard, repair: Wrench, service: Cog, inspection: Gauge };

export function ServiceCard({ title, body, href, icon = "diagnostic", dark = false, compact = false, mobileCompact = false, horizontal = false, tight = false, image, mobileSeparator = false, index, className }: { title: string; body: string; href: string; icon?: keyof typeof icons; dark?: boolean; compact?: boolean; mobileCompact?: boolean; horizontal?: boolean; tight?: boolean; image?: StaticImageData; mobileSeparator?: boolean; index?: number; className?: string }) {
  const Icon = icons[icon];
  return (
    <Link href={href} className={cn(styles.card, dark && styles.dark, image && styles.withImage, compact && styles.compact, mobileCompact && styles.mobileCompact, horizontal && styles.horizontal, tight && styles.tight, className)} data-reveal>
      {image && <><Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className={styles.image} /><span className={styles.overlay} aria-hidden="true" /></>}
      {mobileSeparator && <span className={styles.mobileSeparator} aria-hidden="true" />}
      <div className={styles.top}><span className={styles.icon}><Icon /></span><ArrowUpRight className={styles.arrow} /></div>
      {index !== undefined && <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>}
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.body}>{body}</p>
    </Link>
  );
}
