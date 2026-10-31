import { supabase } from "../lib/supabase";
import { atTime } from "../lib/slots";
import type { Appointment, Booked, BookingInput, BookingResult, Service } from "../types";

export const SERVICES: Service[] = [
  { id: "intro", name: "Intro call", minutes: 30 },
  { id: "consult", name: "Consultation", minutes: 60 },
  { id: "review", name: "Project review", minutes: 45 },
];

export const isDemo = !supabase;
const DEMO_KEY = "smart-scheduler-demo-v2";

// ---- Demo mode: full records kept in localStorage, seeded with sample data ----
function seedDemo(): Appointment[] {
  const names = ["Ana Souza", "Carlos Lima", "Marina Rocha", "Diego Alves", "Bruna Costa", "Pedro Nunes"];
  return Array.from({ length: 24 }, (_, i) => {
    const s = SERVICES[i % 3];
    const start = new Date();
    start.setDate(start.getDate() + (i < 4 ? (i + 1) * 2 : -(i - 3) * 6));
    start.setHours(10 + (i % 5), 0, 0, 0);
    const name = names[i % names.length];
    return {
      id: `seed-${i}`, service: s.name,
      starts_at: start.toISOString(), ends_at: new Date(start.getTime() + s.minutes * 60_000).toISOString(),
      customer_name: name, customer_email: `${name.split(" ")[0].toLowerCase()}@example.com`,
      status: i % 8 === 0 ? "cancelled" : "confirmed",
    } as Appointment;
  });
}

function readDemo(): Appointment[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* fall through to seed */ }
  const seed = seedDemo();
  localStorage.setItem(DEMO_KEY, JSON.stringify(seed));
  return seed;
}
const writeDemo = (list: Appointment[]) => localStorage.setItem(DEMO_KEY, JSON.stringify(list));

// ---- Public reads: only busy times, no personal data ----
export async function getBooked(day: Date): Promise<Booked[]> {
  const from = atTime(day, "00:00");
  const to = new Date(from.getTime() + 86_400_000);
  if (!supabase) {
    return readDemo().filter((a) => a.status === "confirmed" && new Date(a.starts_at) >= from && new Date(a.starts_at) < to);
  }
  const { data, error } = await supabase.rpc("booked_slots", { from_ts: from.toISOString(), to_ts: to.toISOString() });
  if (error) throw new Error(error.message);
  return data as Booked[];
}

// ---- Booking goes through the Edge Function (Postgres + Google Calendar) ----
export async function bookAppointment(i: BookingInput): Promise<BookingResult> {
  const start = atTime(i.day, i.time);
  const end = new Date(start.getTime() + i.service.minutes * 60_000);
  const payload = { service: i.service.name, startsAt: start.toISOString(), endsAt: end.toISOString(), name: i.name, email: i.email };

  if (!supabase) {
    const id = crypto.randomUUID();
    writeDemo([...readDemo(), { id, service: payload.service, starts_at: payload.startsAt, ends_at: payload.endsAt, customer_name: i.name, customer_email: i.email, status: "confirmed" }]);
    return { id, startsAt: payload.startsAt, demo: true };
  }
  const { data, error } = await supabase.functions.invoke("book", { body: payload });
  if (error) throw new Error("That time was just taken or the server is unavailable. Please pick another slot.");
  return { ...(data as { id: string; googleLink?: string }), startsAt: payload.startsAt, demo: false };
}

// ---- Admin ----
export async function listAppointments(): Promise<Appointment[]> {
  if (!supabase) return readDemo().sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const { data, error } = await supabase
    .from("appointments")
    .select("id,service,starts_at,ends_at,customer_name,customer_email,status")
    .order("starts_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Appointment[];
}

export async function cancelAppointment(id: string): Promise<void> {
  if (!supabase) {
    writeDemo(readDemo().map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)));
    return;
  }
  const { error } = await supabase.functions.invoke("cancel", { body: { id } });
  if (error) throw new Error("Could not cancel this appointment.");
}
