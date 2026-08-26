# Google Reviews Carousel

## Task

Add a native-looking Google Reviews section immediately before the shared footer on these public routes:

- `/`
- `/contact`
- `/about`
- `/cars-for-sale`
- `/news`

The section must reuse the existing CMS sync and moderation workflow. It must not call Google Places from the browser, expose API or privileged database keys, display unpublished reviews, introduce a third-party widget, or redesign the existing site.

## Existing review pipeline

Google reviews are already managed locally:

1. An authorised administrator runs `syncGoogleReviews` from `/admin/reviews`.
2. The server calls the Google Places API using `GOOGLE_PLACES_API_KEY` and `GOOGLE_PLACE_ID`.
3. Synced reviews are upserted into the Supabase `public.reviews` table.
4. New reviews remain hidden because `visible` defaults to `false`.
5. An administrator explicitly publishes or hides each review in the CMS.
6. Supabase Row Level Security allows public reads only when `visible = true`.

Available stored fields include the provider review ID, author name and profile URI, rating, review text, publication date, Google Maps source URI, moderation state, and sync timestamps.

## Implementation

The feature is implemented using two shared components:

- `src/components/reviews/google-reviews-section.tsx` is a Server Component. It retrieves approved reviews and omits the entire section when none exist.
- `src/components/reviews/google-reviews-carousel.tsx` is the smallest client boundary. It owns only the active-review index and Previous/Next interactions.

Public data is retrieved through `src/lib/reviews/repository.ts`. The query:

- uses the publishable Supabase client;
- requests only display-safe fields;
- requires `provider = 'google'`;
- requires `visible = true`;
- sorts newest first;
- limits the result to five reviews.

The shared section is appended as the final content block in each required page. The footer remains owned by the existing shared site chrome, so the section appears directly before it without duplicating or modifying the footer.

## Carousel behaviour

- One review is rendered at a time at every breakpoint.
- Next and Previous wrap continuously through multiple reviews.
- The carousel does not auto-advance.
- Navigation is omitted when exactly one review exists.
- The complete section is omitted when no approved reviews exist.
- Long reviews remain readable and are not aggressively truncated.
- The card uses the existing colour, spacing, border, radius, shadow, button, and icon conventions.

## Accessibility

- Previous and Next buttons have explicit accessible names.
- Global visible focus styling applies to the controls and links.
- Review changes are announced through a polite live region.
- Only the active review article exists in the DOM.
- The star graphic is hidden from assistive technology and accompanied by text such as `Rated 5 out of 5 stars`.
- Review publication dates use semantic `time` elements.
- External source and author links use safe new-tab attributes.

## Google attribution

Each card:

- identifies the source as `Google Maps`;
- credits the stored review author;
- links the author name to the stored author profile when available;
- links to the review's Google Maps source;
- displays a clear notice that the carousel contains the newest reviews selected by SOB Autofix for public display.

The sync workflow prefers the review-level `googleMapsUri` and falls back to the place-level Maps URI for older or incomplete API responses. Existing rows should be synced again to populate review-level links where Google supplies them.

## Cache invalidation

Syncing or changing review visibility revalidates:

- `/admin/reviews`
- `/reviews`
- `/`
- `/contact`
- `/about`
- `/cars-for-sale`
- `/news`
- `/sitemap.xml`

This ensures published, hidden, or refreshed review content is reflected on every affected page.

## Remaining live-data work

The feature code is complete. To make the section visible in a deployed environment:

1. Confirm the server environment contains valid `GOOGLE_PLACES_API_KEY` and `GOOGLE_PLACE_ID` values.
2. Confirm the public Supabase URL and publishable key are configured.
3. Open `/admin/reviews` using an authorised admin account.
4. Run **Sync Google reviews**.
5. Review the imported content and explicitly publish at least one suitable review.
6. Resync older approved rows so they receive individual review source links where available.
7. Verify the five required public routes on desktop and mobile.

Do not add placeholder reviews to make the section appear.

## Verification

Run:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The focused tests are in `src/__tests__/google-reviews.test.tsx`. They cover:

- the public `provider` and `visible` filters;
- the safe selected-field list;
- zero-review omission;
- the one-review state;
- one review in the DOM at a time;
- Next and Previous navigation;
- wrap-around at both boundaries;
- accessible rating output;
- author and Google Maps attribution;
- all five page integrations;
- the client-side secret boundary.

## Acceptance checklist

- [x] Shared implementation rather than five independent carousels
- [x] Server-side retrieval from locally stored reviews
- [x] Only Google reviews marked `visible` are returned
- [x] No Google Places or privileged Supabase key reaches the client
- [x] One review per view on mobile, tablet, and desktop
- [x] Manual Previous and Next controls with wrap-around
- [x] Correct zero-review and one-review behaviour
- [x] Accessible stars, controls, links, and review announcements
- [x] Google Maps and author attribution
- [x] Section is the final content block on all five required routes
- [x] Moderation changes revalidate every affected route
- [x] Lint, type-check, unit/component tests, and production build pass
- [ ] At least one genuine review is synced and approved in the target environment
- [ ] Populated carousel is visually confirmed on desktop and mobile using live review data
