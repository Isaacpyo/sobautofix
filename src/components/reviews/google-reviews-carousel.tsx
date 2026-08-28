"use client";

import { ChevronLeft, ChevronRight, ExternalLink, Star } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PublicReview } from "@/lib/reviews/repository";
import styles from "./google-reviews-carousel.module.css";

const SWIPE_THRESHOLD = 48;

function formatReviewDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function GoogleReviewsCarousel({ reviews }: { reviews: PublicReview[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<-1 | 1>(1);
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null);
  if (reviews.length === 0) return null;

  const review = reviews[activeIndex] ?? reviews[0]!;
  const reviewDate = formatReviewDate(review.publishedAt);
  const hasNavigation = reviews.length > 1;

  function move(direction: -1 | 1) {
    setDirection(direction);
    setActiveIndex((current) => (current + direction + reviews.length) % reviews.length);
  }

  function finishSwipe(pointerId: number, clientX: number, clientY: number) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== pointerId) return;

    const horizontalDistance = clientX - start.x;
    const verticalDistance = clientY - start.y;
    if (Math.abs(horizontalDistance) < SWIPE_THRESHOLD || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return;
    move(horizontalDistance < 0 ? 1 : -1);
  }

  return (
    <div className="mx-auto max-w-3xl" role="region" aria-roledescription="carousel" aria-label="Google customer reviews">
      <div
        className={`min-h-[19rem] ${styles.viewport}`}
        aria-live="polite"
        aria-atomic="true"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => finishSwipe(event.pointerId, event.clientX, event.clientY)}
        onPointerCancel={() => { pointerStart.current = null; }}
      >
        <article key={review.id} className={`premium-card flex min-h-[19rem] flex-col rounded-[1.6rem_.35rem_1.6rem_.35rem] border border-[#E4EAF0] bg-white p-6 shadow-sm sm:p-8 ${direction === 1 ? styles.slideNext : styles.slidePrevious}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 text-amber-600" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => <Star key={index} size={19} fill={index < review.rating ? "currentColor" : "none"} />)}
            </div>
            <span className="sr-only">Rated {review.rating} out of 5 stars</span>
            <span className="text-sm font-normal tracking-normal whitespace-nowrap text-[#5E5E5E]" translate="no">Google Maps</span>
          </div>
          <blockquote className="mt-7 flex-1 text-lg leading-8 text-[#3F4B59] sm:text-xl">
            <p>“{review.text}”</p>
          </blockquote>
          <footer className="mt-7 flex flex-wrap items-end justify-between gap-4 border-t border-[#E4EAF0] pt-5">
            <div>
              <cite className="not-italic font-extrabold text-[#071127]">
                {review.authorUri ? <a href={review.authorUri} target="_blank" rel="noopener noreferrer" className="hover:text-[#1974E2]">{review.authorName}</a> : review.authorName}
              </cite>
              {reviewDate && <time className="mt-1 block text-sm text-[#667586]" dateTime={review.publishedAt}>{reviewDate}</time>}
            </div>
            <a className="inline-flex items-center gap-1.5 text-sm font-bold text-[#145CAD] hover:text-[#1974E2]" href={review.sourceUri} target="_blank" rel="noopener noreferrer">
              View on Google <ExternalLink size={15} aria-hidden="true" />
            </a>
          </footer>
        </article>
      </div>

      {hasNavigation && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3" aria-label="Review carousel controls">
          <Button type="button" variant="outline" onClick={() => move(-1)} aria-label="Previous review" className="min-w-32">
            <ChevronLeft size={18} aria-hidden="true" /> Previous
          </Button>
          <p className="min-w-16 text-center text-sm font-bold text-[#586575]" aria-hidden="true">{activeIndex + 1} / {reviews.length}</p>
          <Button type="button" variant="outline" onClick={() => move(1)} aria-label="Next review" className="min-w-32">
            Next <ChevronRight size={18} aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
