import { createAdminReadClient as createClient } from "@/lib/supabase/server";
import { ReviewCard } from "./review-card";
import { ReviewSyncButton } from "./review-sync-button";

export default async function ReviewsAdminPage() {
  const client = await createClient();
  const { data } = client
    ? await client.from("reviews").select("id,author_name,rating,text,visible,fetched_at,source_uri").order("fetched_at", { ascending: false })
    : { data: [] };

  return <>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Verified sources</p>
        <h1 className="mt-2 text-4xl font-extrabold text-[#071127]">Reviews</h1>
      </div>
      <ReviewSyncButton />
    </div>
    <p className="mt-4 max-w-2xl text-sm leading-6 text-[#667586]">Google Places supplies at most five relevant reviews. Each remains hidden until a staff member explicitly publishes it.</p>
    <div className="mt-8 grid max-w-5xl gap-4 md:grid-cols-2 xl:grid-cols-3">
      {(data || []).map((review) => <ReviewCard key={review.id} review={review} />)}
      {!data?.length && <p className="rounded-2xl bg-white p-8 text-center text-[#667586]">No reviews synced.</p>}
    </div>
  </>;
}
