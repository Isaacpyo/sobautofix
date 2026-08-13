import { MapPinned, MapPin, ScanLine, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import styles from "./trust-bar.module.css";

const facts = [
  { icon: ScanLine, label: "Diagnostic-led", detail: "Test before replacing" },
  { icon: MapPin, label: "Doncaster based", detail: "Workshop and mobile" },
  { icon: MapPinned, label: "South Yorkshire", detail: "Coverage varies by service" },
  { icon: ShieldCheck, label: "4 years in business", detail: "Professional approach" },
];

export function TrustBar() {
  return <section className={styles.bar} data-motion="off"><Container className={styles.grid}>{facts.map(({ icon: Icon, label, detail }) => <div key={label} className={styles.fact}><span className={styles.icon}><Icon size={20} /></span><div><strong className={styles.label}>{label}</strong><span className={styles.detail}>{detail}</span></div></div>)}</Container></section>;
}
