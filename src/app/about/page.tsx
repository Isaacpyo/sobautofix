import { AboutExperience } from "@/components/about/about-experience";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata(
  "Who We Are — Diagnosis-led automotive care",
  "Meet SOB Autofix: professional vehicle diagnostics, electrical fault finding and practical repair support across Doncaster and South Yorkshire.",
  "/about",
);

export default function AboutPage() {
  return <AboutExperience />;
}
