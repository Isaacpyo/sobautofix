import Image, { type StaticImageData } from "next/image";
import moduleImage from "../../../assets/sobautofix-new-pictures (1).png";
import heroImage from "../../../assets/sobautofix-new-pictures (2).png";
import aboutImage from "../../../assets/sobautofix-new-pictures (3).png";
import engineImage from "../../../assets/sobautofix-new-pictures (4).png";
import serviceImage from "../../../assets/sobautofix-new-pictures (5).png";
import brakesImage from "../../../assets/sobautofix-new-pictures (6).png";
import diagnosticsImage from "../../../assets/sobautofix-new-pictures (7).png";
import mobileImage from "../../../assets/sobautofix-new-pictures (8).png";
import electricalImage from "../../../assets/sobautofix-new-pictures (9).png";

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

const images: Record<ContextualImageId, { src: StaticImageData; alt: string; objectPosition: string }> = {
  hero: { src: heroImage, alt: "SOB Autofix technician testing a vehicle in the workshop", objectPosition: "center" },
  diagnostics: { src: diagnosticsImage, alt: "SOB Autofix technician using diagnostic equipment beside an open engine bay", objectPosition: "center 38%" },
  mobile: { src: mobileImage, alt: "SOB Autofix technician carrying out a vehicle check at the customer's location", objectPosition: "center 36%" },
  electrical: { src: electricalImage, alt: "SOB Autofix technician carrying out electrical testing inside a vehicle", objectPosition: "center 34%" },
  service: { src: serviceImage, alt: "SOB Autofix technician servicing a vehicle in the workshop", objectPosition: "center 38%" },
  engine: { src: engineImage, alt: "SOB Autofix technician inspecting a vehicle engine", objectPosition: "center 34%" },
  brakes: { src: brakesImage, alt: "SOB Autofix technician checking a vehicle in the workshop", objectPosition: "center 38%" },
  module: { src: moduleImage, alt: "SOB Autofix technician using a diagnostic tablet inside a vehicle", objectPosition: "center 32%" },
  inspection: { src: diagnosticsImage, alt: "SOB Autofix technician carrying out a detailed vehicle inspection", objectPosition: "center 38%" },
  about: { src: aboutImage, alt: "SOB Autofix technician working beside a vehicle in the workshop", objectPosition: "center 36%" },
};

export function ContextualServiceImage({ id, priority = false, className = "" }: { id: ContextualImageId; priority?: boolean; className?: string }) {
  const image = images[id];

  return (
    <figure className={`media-frame relative min-h-72 overflow-hidden bg-[#071127] shadow-2xl ${className}`} data-reveal>
      <Image src={image.src} alt={image.alt} fill preload={priority} sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover transition-transform duration-700 hover:scale-[1.02]" style={{ objectPosition: image.objectPosition }} />
      <span aria-hidden="true" className="absolute inset-0 ring-1 ring-inset ring-white/10" />
    </figure>
  );
}

export { heroImage };
