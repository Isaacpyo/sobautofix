// Client navigation tracing is intentionally disabled to keep the monitoring
// SDK off the critical rendering path. Error boundaries report a scrubbed
// error type and framework digest to the server-side Sentry integration.
export function onRouterTransitionStart() {}
