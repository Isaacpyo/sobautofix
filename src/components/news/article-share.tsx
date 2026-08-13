"use client";

import { Check, Copy, Facebook, Linkedin, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type ArticleShareProps = {
  title: string;
  url: string;
};

type CopyStatus = "idle" | "copied" | "error";

export function buildArticleShareLinks(title: string, url: string) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedMessage = encodeURIComponent(`${title} ${url}`);

  return [
    {
      label: "Share on Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: <Facebook aria-hidden="true" size={18} />,
    },
    {
      label: "Share on X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      icon: <span aria-hidden="true" className="text-sm font-extrabold">X</span>,
    },
    {
      label: "Share on LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: <Linkedin aria-hidden="true" size={18} />,
    },
    {
      label: "Share on WhatsApp",
      href: `https://wa.me/?text=${encodedMessage}`,
      icon: <MessageCircle aria-hidden="true" size={18} />,
    },
  ];
}

export function ArticleShare({ title, url }: ArticleShareProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const links = buildArticleShareLinks(title, url);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  async function copyLink() {
    if (resetTimer.current) clearTimeout(resetTimer.current);

    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }

    resetTimer.current = setTimeout(() => setCopyStatus("idle"), 2500);
  }

  return (
    <>
      <div className="sticky top-[4.5rem] z-40 border-y border-[#D9E2EB] bg-white/95 shadow-sm backdrop-blur lg:hidden">
        <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center gap-2 px-5 sm:px-7">
          <span className="mr-auto text-xs font-extrabold tracking-[0.12em] text-[#586575] uppercase">Share</span>
          <ShareActions links={links} copyStatus={copyStatus} onCopy={copyLink} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-full max-w-3xl -translate-x-1/2 lg:block">
        <div className="pointer-events-auto absolute top-0 right-full mr-5 h-full">
          <aside className="sticky top-28" aria-label="Share this article">
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#D9E2EB] bg-white p-2 shadow-[0_12px_35px_rgba(7,17,39,0.12)]">
              <span className="px-1 py-1 text-[0.65rem] font-extrabold tracking-[0.12em] text-[#586575] uppercase">Share</span>
              <ShareActions links={links} copyStatus={copyStatus} onCopy={copyLink} />
            </div>
          </aside>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {copyStatus === "copied" ? "Article link copied" : copyStatus === "error" ? "Article link could not be copied" : ""}
      </span>
    </>
  );
}

function ShareActions({
  links,
  copyStatus,
  onCopy,
}: {
  links: Array<{ label: string; href: string; icon: ReactNode }>;
  copyStatus: CopyStatus;
  onCopy: () => void;
}) {
  const actionClasses = "grid size-10 shrink-0 place-items-center rounded-full border border-[#D9E2EB] bg-white text-[#145CAD] transition hover:border-[#1974E2] hover:bg-[#EAF3FF] hover:text-[#071127] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1974E2]";
  const copyLabel = copyStatus === "copied" ? "Article link copied" : copyStatus === "error" ? "Try copying article link again" : "Copy article link";

  return (
    <nav className="flex items-center gap-1.5 lg:flex-col" aria-label="Share this article">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={link.label}
          title={link.label}
          className={actionClasses}
        >
          {link.icon}
        </a>
      ))}
      <button type="button" onClick={onCopy} aria-label={copyLabel} title={copyLabel} className={actionClasses}>
        {copyStatus === "copied" ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
      </button>
    </nav>
  );
}
