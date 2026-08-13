import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

export function createMetadata(title: string, description: string, path = "/"): Metadata {
  const canonical = new URL(path, siteConfig.siteUrl).toString();
  const fullTitle = title.includes(siteConfig.name) ? title : `${title} | ${siteConfig.name}`;

  return {
    // createMetadata already owns the complete title. Mark it absolute so the
    // root layout template does not append the business name a second time.
    title: { absolute: fullTitle },
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: siteConfig.name,
      title: fullTitle,
      description,
    },
    twitter: { card: "summary_large_image", title: fullTitle, description },
  };
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["AutoRepair", "LocalBusiness"],
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    url: siteConfig.siteUrl,
    telephone: siteConfig.phone,
    email: siteConfig.email,
    sameAs: Object.values(siteConfig.socials).filter((url): url is string => Boolean(url)),
    address: {
      "@type": "PostalAddress",
      streetAddress: `${siteConfig.address.building}, ${siteConfig.address.street}`,
      addressLocality: siteConfig.address.city,
      postalCode: siteConfig.address.postcode,
      addressCountry: siteConfig.address.countryCode,
    },
    areaServed: ["Doncaster", "South Yorkshire"],
  };
}

export function serviceJsonLd(name: string, description: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    url: new URL(path, siteConfig.siteUrl).toString(),
    serviceType: name,
    areaServed: { "@type": "AdministrativeArea", name: "Doncaster" },
    provider: { "@type": "AutoRepair", name: siteConfig.name, url: siteConfig.siteUrl },
  };
}
