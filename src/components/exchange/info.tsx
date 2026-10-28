import type { StaticImageData } from "next/image";
import Image from "next/image";
import type { ReactNode } from "react";
import { NOT_PUBLISHED_COPY } from "@/config/exchange";
import { cn } from "@/lib/utils";
import { Container, Eyebrow } from "./ui";

export function InfoHero({ eyebrow, title, intro, photo, children }: { eyebrow: string; title: string; intro?: ReactNode; photo?: { src: StaticImageData; alt: string }; children?: ReactNode }) {
  return (
    <section className="border-b border-[#E3E8EF] bg-[#F3F5F8]">
      <Container className={cn("grid items-center gap-6 py-8 sm:py-12", photo && "lg:grid-cols-[1.3fr_1fr]")}>
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-1 text-[40px] leading-none font-bold text-balance text-[#0B1220] sm:text-[54px]">{title}</h1>
          {intro && <div className="mt-4 max-w-2xl text-[17px] leading-7 text-[#344054]">{intro}</div>}
          {children}
        </div>
        {photo && (
          <div className="relative hidden aspect-[16/10] overflow-hidden rounded-3xl lg:block">
            <Image src={photo.src} alt={photo.alt} fill sizes="440px" className="object-cover object-[50%_35%]" preload />
          </div>
        )}
      </Container>
    </section>
  );
}

/** Settings copy split into paragraphs; NOT_PUBLISHED_COPY when staff have not published any. */
export function SettingsCopy({ value, className }: { value?: string; className?: string }) {
  const text = value?.trim();
  if (!text) return <p className={cn("rounded-2xl border border-dashed border-[#C9D3E0] bg-white px-4 py-3 text-[#5B6575]", className)}>{NOT_PUBLISHED_COPY}</p>;
  return <div className={cn("space-y-3", className)}>{text.split(/\n{2,}|\r?\n/).filter((part) => part.trim()).map((part) => <p key={part}>{part}</p>)}</div>;
}

export function InfoSection({ id, title, icon, children }: { id: string; title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-28 border-t border-[#E3E8EF] py-8 first:border-t-0 first:pt-0">
      <h2 id={id} className="flex items-center gap-3 text-[28px] leading-tight font-bold text-[#0B1220]">
        {icon && <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF2FD] text-[#1462C4]">{icon}</span>}
        {title}
      </h2>
      <div className="mt-4 text-[16px] leading-7 text-[#344054]">{children}</div>
    </section>
  );
}

export function Steps({ items }: { items: Array<{ title: string; body: ReactNode }> }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <li key={item.title} className="rounded-2xl border border-[#E3E8EF] bg-white p-5">
          <span className="exchange-display grid size-10 place-items-center rounded-full bg-[#1974E2] text-[20px] font-bold text-white">{index + 1}</span>
          <h3 className="mt-3 text-[22px] font-bold text-[#0B1220]">{item.title}</h3>
          <div className="mt-1 text-[15px] leading-6 text-[#5B6575]">{item.body}</div>
        </li>
      ))}
    </ol>
  );
}

export const STATUTORY_RIGHTS_NOTE = "Any warranty is in addition to, and does not reduce, your legal rights as a consumer when you buy a car from a business.";
