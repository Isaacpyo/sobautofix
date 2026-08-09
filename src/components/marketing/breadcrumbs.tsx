import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/config/site";

export function Breadcrumbs({ items }: { items: Array<{ label: string; href: string }> }) {
  return <><nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-[#667586]">{items.map((item, index) => <span key={item.href} className="flex items-center gap-1">{index > 0 && <ChevronRight size={14} />}<Link href={item.href} aria-current={index === items.length - 1 ? "page" : undefined}>{item.label}</Link></span>)}</nav><JsonLd value={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.label, item: new URL(item.href, siteConfig.siteUrl).toString() })) }} /></>;
}
