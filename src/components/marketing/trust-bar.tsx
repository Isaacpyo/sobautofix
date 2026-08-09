import { Clock3, MapPin, ScanLine, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/container";

const facts = [
  { icon: ScanLine, label: "Diagnostic-led", detail: "Test before replacing" },
  { icon: MapPin, label: "Doncaster based", detail: "Workshop and mobile" },
  { icon: Clock3, label: "Open 24 hours", detail: "Appointments vary" },
  { icon: ShieldCheck, label: "4 years in business", detail: "Professional approach" },
];

export function TrustBar() {
  return <section className="border-y border-[#E4EAF0] bg-white"><Container className="grid sm:grid-cols-2 lg:grid-cols-4">{facts.map(({ icon: Icon, label, detail }) => <div key={label} className="flex items-center gap-4 border-b border-[#E4EAF0] py-5 sm:border-b-0 sm:border-r sm:px-5 first:pl-0 last:border-r-0"><Icon className="text-[#1974E2]" /><div><strong className="block text-sm text-[#071127]">{label}</strong><span className="text-xs text-[#667586]">{detail}</span></div></div>)}</Container></section>;
}
