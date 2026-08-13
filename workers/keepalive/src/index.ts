const HEALTH_ENDPOINT = "https://sobautofix.com/api/health";

type ScheduledControllerLike = {
  scheduledTime: number;
};

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

export async function runKeepalive(
  fetcher: typeof fetch = fetch,
  scheduledAt: Date = new Date(),
) {
  let response: Response;

  try {
    response = await fetcher(HEALTH_ENDPOINT, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
        "User-Agent": "SOB-Autofix-Keepalive/1.0",
      },
    });
  } catch {
    console.error(JSON.stringify({
      timestamp: scheduledAt.toISOString(),
      status: 0,
      message: "Health check request failed",
    }));
    throw new Error("Keepalive health check request failed");
  }

  if (!response.ok) {
    console.error(JSON.stringify({
      timestamp: scheduledAt.toISOString(),
      status: response.status,
      message: "Health check returned a non-success status",
    }));
    throw new Error(`Keepalive health check failed with status ${response.status}`);
  }

  console.log(JSON.stringify({
    timestamp: scheduledAt.toISOString(),
    status: response.status,
    message: "Health check succeeded",
  }));
}

const keepaliveWorker = {
  scheduled(
    controller: ScheduledControllerLike,
    _env: unknown,
    context: ExecutionContextLike,
  ) {
    context.waitUntil(runKeepalive(fetch, new Date(controller.scheduledTime)));
  },
};

export default keepaliveWorker;
