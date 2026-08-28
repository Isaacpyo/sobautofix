"use client";

import { Star } from "lucide-react";
import { useId, useState } from "react";
import { toggleReview } from "../actions";

const REVIEW_PREVIEW_LENGTH = 180;

type ReviewCardProps = {
  review: {
    id: string;
    author_name: string;
    rating: number;
    text: string;
    visible: boolean;
    source_uri: string;
  };
};

export function ReviewCard({ review }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const reviewTextId = useId();
  const canExpand = review.text.length > REVIEW_PREVIEW_LENGTH;
  const displayedText = canExpand && !expanded
    ? `${review.text.slice(0, REVIEW_PREVIEW_LENGTH).trimEnd()}…`
    : review.text;

  return <article className="flex h-[19rem] flex-col rounded-2xl border border-[#E4EAF0] bg-white p-5">
    <div className="flex h-6 items-center justify-between gap-4">
      <strong className="min-w-0 truncate">{review.author_name}</strong>
      <span className="flex shrink-0 items-center gap-1 font-bold text-amber-600"><Star size={16} fill="currentColor" />{review.rating}</span>
    </div>
    <p id={reviewTextId} tabIndex={expanded ? 0 : undefined} className={`mt-4 h-28 text-sm leading-6 text-[#586575] ${expanded ? "overflow-y-auto pr-2" : "line-clamp-4 overflow-hidden"}`}>{displayedText}</p>
    <div className="h-7 pt-1">
      {canExpand && <button type="button" aria-expanded={expanded} aria-controls={reviewTextId} onClick={() => setExpanded((current) => !current)} className="text-xs font-extrabold text-[#1974E2] underline-offset-4 hover:underline">{expanded ? "Show less" : "Show more"}</button>}
    </div>
    <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#E4EAF0] pt-4">
      <a className="text-xs font-bold text-[#1974E2]" href={review.source_uri} target="_blank" rel="noreferrer">View source ↗</a>
      <form action={toggleReview}>
        <input type="hidden" name="id" value={review.id} />
        <input type="hidden" name="visible" value={String(!review.visible)} />
        <button className="rounded-lg border border-[#1974E2]/30 bg-white px-4 py-2 text-sm font-bold text-[#1974E2] shadow-sm transition-[transform,background-color,color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#1974E2] hover:bg-[#1974E2] hover:text-white hover:shadow-[0_8px_18px_rgba(25,116,226,.22)] active:translate-y-0 active:scale-95 active:shadow-none">{review.visible ? "Hide" : "Publish"}</button>
      </form>
    </div>
  </article>;
}
