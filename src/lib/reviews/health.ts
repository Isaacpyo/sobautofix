export type ReviewHealthState = "healthy" | "warning" | "degraded";

export type ReviewHealthCheck = {
  label: string;
  status: string;
  detail: string;
  state: ReviewHealthState;
};

export type ReviewHealthRow = {
  provider: string;
  rating: number;
  text: string;
  source_uri: string;
  visible: boolean;
  fetched_at: string;
};

const FRESH_SYNC_DAYS = 7;

export function createReviewHealthChecks({
  credentialsReady,
  databaseReady,
  reviews,
  now = new Date(),
}: {
  credentialsReady: boolean;
  databaseReady: boolean;
  reviews: ReviewHealthRow[];
  now?: Date;
}): ReviewHealthCheck[] {
  const visible = reviews.filter((review) => review.visible).length;
  const hidden = reviews.length - visible;
  const invalid = reviews.filter((review) => review.provider !== "google" || review.rating < 1 || review.rating > 5 || !review.text.trim() || !isHttpUrl(review.source_uri)).length;
  const latestSync = reviews.reduce<Date | null>((latest, review) => {
    const date = new Date(review.fetched_at);
    if (Number.isNaN(date.getTime())) return latest;
    return !latest || date > latest ? date : latest;
  }, null);
  const syncAgeDays = latestSync ? (now.getTime() - latestSync.getTime()) / 86_400_000 : null;
  const syncFresh = syncAgeDays !== null && syncAgeDays <= FRESH_SYNC_DAYS;

  return [
    {
      label: "Google Places connection",
      status: credentialsReady ? "Configured" : "Action required",
      detail: credentialsReady ? "The server API key and Place ID are configured." : "Add the Google Places server API key and Place ID.",
      state: credentialsReady ? "healthy" : "warning",
    },
    {
      label: "Reviews database",
      status: databaseReady ? "Connected" : "Degraded",
      detail: databaseReady ? `${reviews.length} synced ${reviews.length === 1 ? "review is" : "reviews are"} available for moderation.` : "Review records could not be loaded from the database.",
      state: databaseReady ? "healthy" : "degraded",
    },
    {
      label: "Sync freshness",
      status: !databaseReady ? "Unavailable" : syncFresh ? "Current" : latestSync ? "Sync recommended" : "Awaiting first sync",
      detail: !databaseReady ? "Freshness cannot be checked until the database reconnects." : latestSync ? `Last retrieved ${formatHealthDate(latestSync)}.` : "No successful review retrieval has been recorded yet.",
      state: !databaseReady ? "degraded" : syncFresh ? "healthy" : "warning",
    },
    {
      label: "Moderation queue",
      status: hidden > 0 ? `${hidden} pending` : "Clear",
      detail: hidden > 0 ? `${hidden} hidden ${hidden === 1 ? "review is" : "reviews are"} waiting for a publish decision.` : "There are no hidden reviews waiting for moderation.",
      state: hidden > 0 ? "warning" : "healthy",
    },
    {
      label: "Public display",
      status: visible > 0 ? "Operational" : "No reviews live",
      detail: visible > 0 ? `${visible} approved ${visible === 1 ? "review is" : "reviews are"} available to the public carousel.` : "Publish at least one approved review to activate the public carousel.",
      state: visible > 0 ? "healthy" : "warning",
    },
    {
      label: "Review data integrity",
      status: invalid === 0 ? "Passed" : `${invalid} invalid`,
      detail: invalid === 0 ? "Provider, rating, text and source links pass validation." : `${invalid} ${invalid === 1 ? "record needs" : "records need"} attention before publication.`,
      state: invalid === 0 ? "healthy" : "degraded",
    },
  ];
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatHealthDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(value);
}
