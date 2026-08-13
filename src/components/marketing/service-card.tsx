import { ArrowUpRight, CircuitBoard, Cog, Gauge, Wrench } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import styles from "./service-card.module.css";

const icons = { diagnostic: CircuitBoard, repair: Wrench, service: Cog, inspection: Gauge };

export function ServiceCard({ title, body, href, icon = "diagnostic", dark = false, index, className }: { title: string; body: string; href: string; icon?: keyof typeof icons; dark?: boolean; index?: number; className?: string }) {
  const Icon = icons[icon];
  return (
    <Link href={href} className={cn(styles.card, dark && styles.dark, className)} data-reveal>
      <div className={styles.top}><span className={styles.icon}><Icon /></span><ArrowUpRight className={styles.arrow} /></div>
      {index !== undefined && <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>}
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.body}>{body}</p>
    </Link>
  );
}
