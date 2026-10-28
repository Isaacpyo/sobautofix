# SOB Auto Exchange: decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | One Next.js app and one Supabase project; the exchange is served on its own host through `src/proxy.ts` host rewriting. | Reuses staff auth, MFA, enquiries, email threads, notifications and hosting. No second deploy to keep in step. |
| D2 | Extend `sale_vehicles` instead of a new stock table. Private data (costs, notes, documents, acquisition) in separate admin-only tables. | Existing stock URLs, images, admin tools and the 90-day sold rule keep working. Public RLS exposes every `sale_vehicles` column, so private data cannot live there. |
| D3 | Sales enquiries are `enquiries` rows (`vehicle_sales`); each seller submission also gets an `enquiries` row (`vehicle_purchase`). | Staff reply from the existing email thread UI, notification retries and retention already work for enquiries. |
| D4 | Workshop bookings are read straight from `bookings` in the diary; other appointments are `diary_appointments`. | No duplicate appointments to keep in sync. Cal.com stays the source for workshop bookings. |
| D5 | MOT facts (expiry, history notes, seller's MOT status) are allowed on the exchange and in admin only. The main site keeps the full ban, and MOT services, pricing and booking stay banned everywhere (`guardExchangeContent`). | Owner decision, 28 Oct 2026: buyers expect to see MOT expiry on a used car. |
| D6 | Roles: owner, manager, sales, workshop. Existing admins become owners. | The spec asks who can see financials, edit stock, publish and manage settings. The staff allowlist (`src/config/admin.ts`) still controls who can sign in at all. |
| D7 | Gross margin = selling price - (purchase + recorded direct costs). Labelled "gross margin", never profit. Estimated until the sale completes with all-actual costs. | Overheads, staff time, finance and VAT are not recorded. |
| D8 | Publishing needs core specs, price above zero, at least 4 photos (setting), a condition summary, and listed faults for repair projects. | Spec section 8: prevent incomplete listings. |
| D9 | Customer bottom nav uses **Contact**, not Enquiries. | There are no customer accounts, and the spec says not to add them for this. |
| D10 | Viewings are requests until staff confirm them; the customer is told so. | Spec section 6. |
| D11 | Seller photos are re-encoded on the server (EXIF/GPS removed). Closed or declined submissions lose photos, documents and registration after 12 months (setting). | Spec section 9 and "file uploads and privacy". |
| D12 | Retention removes files through the Storage API, then finalises rows in SQL. | Supabase Storage now refuses direct deletes from `storage.objects`; the previous enquiry retention job failed for this reason. |
| D13 | Main-site redirects to the exchange host stay off until `EXCHANGE_REDIRECTS_ENABLED=true` is set after DNS and HTTPS are verified. | A redirect to a host that does not resolve would break existing stock links. |
| D14 | Pages use the tentative name from settings (`SOB Auto Exchange` by default). | Easy to rename without a deploy. |
| D15 | Branch `claude/nifty-wright-3axbzi` instead of `feature/sob-auto-exchange`. | This session's tooling requires that branch name. |
