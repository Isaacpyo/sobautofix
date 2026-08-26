import { GoogleReviewsCarousel } from "@/components/reviews/google-reviews-carousel";
import { Container, Eyebrow } from "@/components/ui/container";
import { getVisibleReviews } from "@/lib/reviews/repository";

export async function GoogleReviewsSection() {
  const reviews = await getVisibleReviews();
  if (reviews.length === 0) return null;

  return (
    <section className="border-t border-[#E4EAF0] bg-[#F4F7FA] py-16 sm:py-20" aria-labelledby="google-reviews-heading" data-google-reviews>
      <Container>
        <div className="mx-auto mb-9 max-w-3xl text-center">
          <Eyebrow>Customer reviews</Eyebrow>
          <h2 id="google-reviews-heading" className="text-4xl font-extrabold text-[#071127] sm:text-5xl">What our customers say</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-[#586575]">Showing the newest Google reviews that SOB Autofix has selected for public display.</p>
        </div>
        <GoogleReviewsCarousel reviews={reviews} />
      </Container>
    </section>
  );
}
