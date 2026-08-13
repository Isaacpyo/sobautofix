import { afterEach, describe, expect, it, vi } from "vitest";
import keepaliveWorker, { runKeepalive } from "../../workers/keepalive/src/index";

describe("Cloudflare Supabase keepalive Worker", () => {
  afterEach(() => vi.restoreAllMocks());

  it("performs one uncached read-only health request", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runKeepalive(fetcher as typeof fetch, new Date("2026-08-13T06:00:00.000Z"));

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("https://sobautofix.com/api/health", {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
        "User-Agent": "SOB-Autofix-Keepalive/1.0",
      },
    });
  });

  it("rejects non-2xx responses without reading or logging their body", async () => {
    const response = new Response("sensitive upstream response", { status: 503 });
    const text = vi.spyOn(response, "text");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(runKeepalive(vi.fn(async () => response) as typeof fetch, new Date("2026-08-13T14:00:00.000Z")))
      .rejects.toThrow("Keepalive health check failed with status 503");

    expect(text).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(JSON.stringify({
      timestamp: "2026-08-13T14:00:00.000Z",
      status: 503,
      message: "Health check returned a non-success status",
    }));
  });

  it("registers scheduled work with waitUntil", async () => {
    const waitUntil = vi.fn();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    keepaliveWorker.scheduled(
      { scheduledTime: Date.parse("2026-08-13T22:00:00.000Z") },
      {},
      { waitUntil },
    );

    expect(waitUntil).toHaveBeenCalledOnce();
    expect(waitUntil.mock.calls[0]?.[0]).toBeInstanceOf(Promise);
    await (waitUntil.mock.calls[0]?.[0] as Promise<void>);
    expect(log).toHaveBeenCalledWith(JSON.stringify({
      timestamp: "2026-08-13T22:00:00.000Z",
      status: 200,
      message: "Health check succeeded",
    }));
  });
});
