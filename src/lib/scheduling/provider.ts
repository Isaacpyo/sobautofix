import "server-only";

export type AvailableSlot = {
  start: string;
  end?: string;
};

export type SchedulingBooking = {
  uid: string;
  status: "accepted" | "pending" | "cancelled" | "rejected" | "unknown";
  start: string;
  end?: string;
  eventTypeId?: number;
  location?: string;
  metadata: Record<string, string>;
};

export type SlotRequest = {
  eventTypeId: number;
  start: string;
  end: string;
  timeZone: string;
  bookingUidToReschedule?: string;
};

export type CreateSchedulingBookingRequest = {
  eventTypeId: number;
  start: string;
  attendee: {
    name: string;
    email: string;
    phoneNumber?: string;
    timeZone: string;
  };
  metadata: Record<string, string>;
  attendeeAddress?: string;
};

export interface SchedulingProvider {
  getAvailableSlots(input: SlotRequest): Promise<AvailableSlot[]>;
  createBooking(input: CreateSchedulingBookingRequest): Promise<SchedulingBooking>;
  getBooking(bookingUid: string): Promise<SchedulingBooking>;
  rescheduleBooking(bookingUid: string, start: string, reason?: string): Promise<SchedulingBooking>;
  cancelBooking(bookingUid: string, reason?: string): Promise<SchedulingBooking>;
}

export type SchedulingProviderErrorCode =
  | "configuration"
  | "invalid_request"
  | "not_found"
  | "rate_limited"
  | "slot_unavailable"
  | "unavailable";

export class SchedulingProviderError extends Error {
  constructor(
    message: string,
    public readonly code: SchedulingProviderErrorCode,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SchedulingProviderError";
  }
}

