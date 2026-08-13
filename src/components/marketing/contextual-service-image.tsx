import Image, { type StaticImageData } from "next/image";
import heroImage from "../../../assets/sobautofix-pics (3).png";
import diagnosticsImage from "../../../assets/sobautofix-pics (2).png";
import electricalImage from "../../../assets/sobautofix-pics (4).png";
import serviceImage from "../../../assets/sobautofix-pics (5).png";
import engineImage from "../../../assets/sobautofix-pics (6).png";
import brakesImage from "../../../assets/sobautofix-pics (7).png";
import moduleImage from "../../../assets/sobautofix-pics (8).png";
import inspectionImage from "../../../assets/sobautofix-pics (9).png";
import aboutImage from "../../../assets/sobautofix-pics (10).png";

export type ContextualImageId =
  | "hero"
  | "diagnostics"
  | "mobile"
  | "electrical"
  | "service"
  | "engine"
  | "brakes"
  | "module"
  | "inspection"
  | "about";

const images: Record<ContextualImageId, { src: StaticImageData; alt: string }> = {
  hero: { src: heroImage, alt: "SOB Autofix technician testing a vehicle in the workshop" },
  diagnostics: { src: diagnosticsImage, alt: "Technician using diagnostic equipment beside an open engine bay" },
  mobile: { src: heroImage, alt: "SOB Autofix technician carrying out a vehicle check at the customer's location" },
  electrical: { src: electricalImage, alt: "Technician carrying out electrical testing in a vehicle engine bay" },
  service: { src: serviceImage, alt: "Mobile mechanic attending a vehicle at the customer's location" },
  engine: { src: engineImage, alt: "Technician inspecting the underside of a vehicle on a workshop lift" },
  brakes: { src: brakesImage, alt: "Diagnostic equipment in use during engine and brake system checks" },
  module: { src: moduleImage, alt: "Exposed brake and wheel assembly ready for module-assisted inspection" },
  inspection: { src: inspectionImage, alt: "Open engine bay prepared for a detailed vehicle inspection" },
  about: { src: aboutImage, alt: "SOB Autofix technician working beside a vehicle in the workshop" },
};

export function ContextualServiceImage({ id, priority = false, className = "" }: { id: ContextualImageId; priority?: boolean; className?: string }) {
  const image = images[id];

  return (
    <figure className={`media-frame relative min-h-72 overflow-hidden bg-[#071127] shadow-2xl ${className}`} data-reveal>
      <Image src={image.src} alt={image.alt} fill priority={priority} sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover transition-transform duration-700 hover:scale-[1.02]" />
      <span aria-hidden="true" className="absolute inset-0 ring-1 ring-inset ring-white/10" />
    </figure>
  );
}

export { heroImage };
