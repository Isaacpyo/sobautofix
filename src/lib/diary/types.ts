// Shared vocabulary for the Autofix Diary: appointment kinds (including
// workshop bookings, which stay in public.bookings), statuses, labels and the
// colours used to tell them apart. Colour is never the only signal; every
// entry also shows its text label.

export const appointmentKinds = ["viewing", "purchase_inspection", "preparation", "collection", "handover", "other"] as const;
export type AppointmentKind = (typeof appointmentKinds)[number];

export const diaryEntryTypes = ["workshop_booking", ...appointmentKinds] as const;
export type DiaryEntryType = (typeof diaryEntryTypes)[number];

export const appointmentStatuses = ["requested", "confirmed", "completed", "cancelled", "no_show"] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];

export const bookingStatuses = ["pending", "confirmed", "rescheduled", "cancelled", "completed"] as const;
export type WorkshopBookingStatus = (typeof bookingStatuses)[number];

export const diaryTypeLabels: Record<DiaryEntryType, string> = {
  workshop_booking: "Workshop booking",
  viewing: "Viewing",
  purchase_inspection: "Purchase inspection",
  preparation: "Preparation",
  collection: "Collection",
  handover: "Handover",
  other: "Other",
};

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

export const bookingStatusLabels: Record<WorkshopBookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  completed: "Completed",
};

/**
 * Type colours: a strong edge colour plus a pale fill with dark text. Text on
 * the fill is at least 7:1; the edge colour is decoration only.
 */
export const diaryTypeStyles: Record<DiaryEntryType, { edge: string; fill: string; text: string }> = {
  workshop_booking: { edge: "#1974E2", fill: "#EAF2FD", text: "#0B3B7A" },
  viewing: { edge: "#067647", fill: "#ECFDF3", text: "#054F31" },
  purchase_inspection: { edge: "#B54708", fill: "#FFFAEB", text: "#7A2E0E" },
  preparation: { edge: "#6941C6", fill: "#F4F3FF", text: "#42307D" },
  collection: { edge: "#0E7090", fill: "#ECFDFF", text: "#0B4A5F" },
  handover: { edge: "#C11574", fill: "#FDF2FA", text: "#851651" },
  other: { edge: "#475467", fill: "#F2F4F7", text: "#1D2939" },
};

export const statusStyles: Record<AppointmentStatus, string> = {
  requested: "bg-[#FFFAEB] text-[#93370D] ring-1 ring-[#FEDF89]",
  confirmed: "bg-[#ECFDF3] text-[#067647] ring-1 ring-[#ABEFC6]",
  completed: "bg-[#F2F4F7] text-[#344054] ring-1 ring-[#E4E7EC]",
  cancelled: "bg-[#FEF3F2] text-[#B42318] ring-1 ring-[#FECDCA]",
  no_show: "bg-[#FEF3F2] text-[#B42318] ring-1 ring-[#FECDCA]",
};

/** Workshop bookings use their own statuses; the diary filters on these groups. */
export function bookingStatusToAppointmentStatus(status: WorkshopBookingStatus): AppointmentStatus {
  if (status === "pending") return "requested";
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  return "confirmed";
}

export function isAppointmentKind(value: unknown): value is AppointmentKind {
  return typeof value === "string" && (appointmentKinds as readonly string[]).includes(value);
}

export function isDiaryEntryType(value: unknown): value is DiaryEntryType {
  return typeof value === "string" && (diaryEntryTypes as readonly string[]).includes(value);
}

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === "string" && (appointmentStatuses as readonly string[]).includes(value);
}

/** One row in the diary, from either source. */
export type DiaryEntry = {
  /** `appointment:<uuid>` or `booking:<uuid>`; unique across both sources. */
  key: string;
  id: string;
  source: "appointment" | "booking";
  type: DiaryEntryType;
  status: AppointmentStatus;
  statusLabel: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  assignedTo: string | null;
  assignedName: string | null;
  customerId: string | null;
  /** Name only. "Anonymised" when the customer has been anonymised. */
  customerName: string | null;
  vehicleLabel: string | null;
  /** sale_vehicles.id for appointments; bookings point at workshop vehicles instead. */
  saleVehicleId: string | null;
  workshopVehicleId: string | null;
  enquiryId: string | null;
  sellerSubmissionId: string | null;
  vehicleSaleId: string | null;
  /** Internal notes, present only when the viewer may see them. */
  notes: string | null;
  reference: string | null;
  /** Where the record that created this entry lives (URL contract), or null. */
  sourceHref: string | null;
  sourceLabel: string | null;
  /** Diary detail page for this entry. */
  href: string;
};

export const workshopKindsWithNotes: readonly DiaryEntryType[] = ["workshop_booking", "preparation", "purchase_inspection", "other"];

/**
 * Appointment lifecycle: requested -> confirmed -> completed / cancelled /
 * no_show. A request can also be cancelled (declined). Completed, no-show and
 * cancelled are final; staff create a new appointment instead.
 */
const statusFlow: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  requested: ["requested", "confirmed", "cancelled"],
  confirmed: ["confirmed", "completed", "no_show", "cancelled"],
  completed: ["completed"],
  no_show: ["no_show"],
  cancelled: [],
};

export function canChangeStatus(from: AppointmentStatus | null, to: AppointmentStatus) {
  if (from === null) return to === "requested" || to === "confirmed";
  return statusFlow[from].includes(to);
}

/** Statuses offered in the edit form for an appointment currently in `from` (cancelling has its own step). */
export function formStatusOptions(from: AppointmentStatus | null): AppointmentStatus[] {
  if (from === null) return ["confirmed", "requested"];
  return statusFlow[from].filter((status) => status !== "cancelled");
}
