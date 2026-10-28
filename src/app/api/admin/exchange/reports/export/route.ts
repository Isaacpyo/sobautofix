import { NextResponse, type NextRequest } from "next/server";
import { loadReport, reportCsv, reportPeriod } from "@/lib/exchange/admin/reports";
import { auditStaffAction, getStaffForRoute } from "@/lib/exchange/staff";

/** Costs & Reporting CSV (finance.view). Vehicle and money columns only. */
export async function GET(request: NextRequest) {
  const { staff, status } = await getStaffForRoute("finance.view");
  if (!staff) return new NextResponse(status === 401 ? "Sign in again." : "Forbidden", { status, headers: { "Cache-Control": "no-store" } });
  const period = reportPeriod(request.nextUrl.searchParams.get("period") || undefined);
  try {
    const { rows } = await loadReport(staff, period);
    await auditStaffAction(staff, "report_exported", "exchange_report", period.key, { rows: rows.length });
    return new NextResponse(reportCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sob-vehicle-costs-${period.from}-to-${period.to}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("The report could not be exported. Try again.", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
