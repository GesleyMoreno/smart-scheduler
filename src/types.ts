export interface Service { id: string; name: string; minutes: number }
export interface Booked { starts_at: string; ends_at: string }

export interface BookingInput {
  service: Service;
  day: Date;
  time: string; // "HH:MM"
  name: string;
  email: string;
}

export interface BookingResult { id: string; startsAt: string; googleLink?: string; demo: boolean }

export interface Appointment {
  id: string;
  service: string;
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_email: string;
  status: "confirmed" | "cancelled";
}

export interface Session { email: string; role: "admin" | "customer" }
