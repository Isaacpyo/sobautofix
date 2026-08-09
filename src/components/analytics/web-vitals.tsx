"use client";

import { useReportWebVitals } from "next/web-vitals";
import { track } from "@/lib/analytics/events";

export function WebVitals() {
  useReportWebVitals((metric) => {
    track("web_vital", {
      metric_name: metric.name,
      metric_value: Math.round(metric.value),
      metric_rating: metric.rating,
      navigation_type: metric.navigationType,
    });
  });

  return null;
}
