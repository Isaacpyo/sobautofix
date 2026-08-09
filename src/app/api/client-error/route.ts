import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit } from "@/lib/rate-limit";

const reportSchema = z.object({
  name: z.string().regex(/^[A-Za-z][A-Za-z0-9 ]{0,79}$/).default("Error"),
  digest: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/).optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await consumeRateLimit(ip, "client_error", 10, 60))) return new NextResponse(null, { status: 204 });
  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  Sentry.withScope((scope) => {
    scope.setLevel("error");
    scope.setTag("source", "client_error_boundary");
    if (parsed.data.digest) scope.setExtra("digest", parsed.data.digest);
    Sentry.captureMessage(`Client error boundary: ${parsed.data.name}`);
  });
  return new NextResponse(null, { status: 204 });
}
