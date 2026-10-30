// Real SOB Autofix workshop photography used across the exchange.
import diagnosticsInCar from "../../../assets/sobautofix-new-pictures (1).png";
import engineBayWide from "../../../assets/sobautofix-new-pictures (2).png";
import technicianRedCar from "../../../assets/sobautofix-new-pictures (3).png";
import engineBayPortrait from "../../../assets/sobautofix-new-pictures (4).png";
import workshopNight from "../../../assets/sobautofix-new-pictures (5).png";
import mercedesCheck from "../../../assets/sobautofix-new-pictures (7).png";
import interiorScan from "../../../assets/sobautofix-new-pictures (8).png";

export const workshopPhotos = {
  hero: { src: engineBayWide, alt: "An SOB Autofix technician checking the engine bay of a blue car in the Doncaster workshop" },
  buy: { src: technicianRedCar, alt: "An SOB Autofix technician with a red hatchback in the workshop" },
  sell: { src: interiorScan, alt: "A technician running a diagnostic scan from the driver's seat" },
  repairs: { src: engineBayPortrait, alt: "A technician working under the bonnet of a car" },
  about: { src: workshopNight, alt: "The SOB Autofix workshop with a car on the ramp" },
  inspection: { src: diagnosticsInCar, alt: "A technician using a diagnostic tablet inside a car" },
  partExchange: { src: mercedesCheck, alt: "A technician checking a silver Mercedes with a diagnostic tablet" },
};

// Home page imagery supplied by the owner (30 Oct 2026). These are styled
// marketing images, not photos of SOB Autofix stock or premises, so the alt
// text describes the scene without claiming either.
import homeHero from "../../../assets/exchange-hero-showroom.webp";
import homeInspection from "../../../assets/exchange-inspection-red-car.webp";
import homeBuy from "../../../assets/exchange-card-buy.webp";
import homeSell from "../../../assets/exchange-card-sell.webp";

export const homePhotos = {
  hero: { src: homeHero, alt: "A blue BMW saloon parked outside a car showroom at sunset" },
  inspection: { src: homeInspection, alt: "A red hatchback with its door and bonnet open and an inspection checklist on the driver's seat" },
  buy: { src: homeBuy, alt: "A blue BMW saloon in a car showroom" },
  sell: { src: homeSell, alt: "Car keys being handed over in front of a silver hatchback" },
};
