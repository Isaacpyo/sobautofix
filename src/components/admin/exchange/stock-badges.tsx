import { CheckCircle2, CircleAlert } from "lucide-react";
import type { PublishReadiness } from "@/lib/exchange/readiness";
import type { SaleVehicleStatus } from "@/types/domain";
import { stockStatusLabels, stockStatusTones } from "./labels";
import { Badge } from "./ui";

export function StockStatusBadge({ status }: { status: SaleVehicleStatus }) {
  return <Badge tone={stockStatusTones[status]}>{stockStatusLabels[status]}</Badge>;
}

export function ReadinessBadge({ readiness, status }: { readiness: PublishReadiness; status: SaleVehicleStatus }) {
  if (status === "sold" || status === "archived") return <span className="text-xs font-semibold text-[#667586]">Not listed</span>;
  const missing = readiness.missing.length;
  return readiness.ready
    ? <Badge tone="success"><CheckCircle2 size={13} aria-hidden="true" />Ready to publish</Badge>
    : <Badge tone={status === "available" || status === "reserved" ? "danger" : "warning"}><CircleAlert size={13} aria-hidden="true" />{missing} {missing === 1 ? "item" : "items"} missing</Badge>;
}
