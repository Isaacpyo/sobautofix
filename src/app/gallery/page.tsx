import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { PageHero } from "@/components/marketing/page-hero";
import { Container } from "@/components/ui/container";
import { getPublishedMedia } from "@/lib/media/repository";
import { createMetadata } from "@/lib/seo";

export async function generateMetadata() { const media = await getPublishedMedia(); return media.length ? createMetadata("Workshop Gallery", "See genuine diagnostics, electrical, servicing and repair work from SOB Autofix in Doncaster.", "/gallery") : { title: "Gallery", robots: { index: false, follow: true } }; }

export default async function GalleryPage() {
  const media = await getPublishedMedia();
  return <><PageHero eyebrow="Workshop gallery" title={media.length ? "Genuine work from the workshop." : "Real workshop media is coming."} body={media.length ? "Approved diagnostics, repair and workshop media from SOB Autofix." : "This gallery remains outside navigation and search indexing until genuine diagnostics, repair and workshop media has been approved."} cta={false} /><section className="bg-[#F4F7FA] py-20"><Container>{media.length ? <div className="grid auto-rows-[13rem] gap-3 sm:grid-cols-2 lg:grid-cols-12">{media.map((asset, index) => <figure key={asset.id} className={`group relative overflow-hidden bg-[#071127] ${index % 5 === 0 ? "sm:row-span-2 lg:col-span-7" : index % 5 === 1 ? "lg:col-span-5" : "lg:col-span-4"}`} data-reveal><Image src={asset.url} alt={asset.alt} fill sizes="(max-width: 768px) 100vw, 55vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.02]" /><figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#030712]/85 to-transparent p-4 pt-12 text-xs font-bold tracking-[.14em] text-white uppercase">{asset.category?.replace("-", " ")}</figcaption></figure>)}</div> : <div className="text-center"><ImageIcon className="mx-auto text-[#1974E2]" size={44} /><h2 className="mt-4 text-3xl font-bold text-[#071127]">No fabricated workshop photography</h2><p className="mx-auto mt-3 max-w-xl leading-7 text-[#586575]">Categories and before-and-after support are ready for real client media.</p></div>}</Container></section></>;
}
