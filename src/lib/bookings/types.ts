export const bookingStatuses = ["pending", "confirmed", "rescheduled", "cancelled", "completed"] as const;
export type BookingStatus = (typeof bookingStatuses)[number];

export type ProviderSyncState = "pending" | "synced" | "failed";

export type BookingHistoryEntry = {
  id: number;
  action: string;
  actor: "customer" | "provider" | "admin" | "system";
  createdAt: string;
  previousAppointmentStart?: string;
  appointmentStart?: string;
};

export type PublicBooking = {
  reference: string;
  status: BookingStatus;
  customerName: string;
  registration: string;
  vehicleName?: string;
  service: string;
  appointmentStart: string;
  originalAppointmentStart?: string;
  timezone: string;
  location?: string;
  notes?: string;
  history: BookingHistoryEntry[];
  canModify: boolean;
  modificationMessage?: string;
};

export type BookingServiceOption = {
  key: string;
  name: string;
  description: string;
  locationMode: "workshop" | "mobile" | "both";
};

export type BookingConfirmation = {
  reference: string;
  status: BookingStatus;
  appointmentStart: string;
  service: string;
  vehicle: string;
  location: string;
  email: string;
};

export type BookingLookupState = {
  status: "idle" | "error" | "found" | "cancelled";
  message?: string;
  booking?: PublicBooking;
  accessToken?: string;
};

export const initialBookingLookupState: BookingLookupState = { status: "idle" };
