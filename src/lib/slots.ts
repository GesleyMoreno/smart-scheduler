import type { Booked } from "../types";

export const OPEN = 9;   // business hours, browser time zone
export const CLOSE = 17;
export const STEP = 30;  // minutes between slot starts

export const isWorkday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

export function atTime(day: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

export function nextWorkday(from = new Date()): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  while (!isWorkday(d)) d.setDate(d.getDate() + 1);
  return d;
}

// Free start times for a day: inside business hours, in the future, not overlapping a booking
export function buildSlots(day: Date, minutes: number, booked: Booked[], now = new Date()): string[] {
  if (!isWorkday(day)) return [];
  const out: string[] = [];
  for (let t = OPEN * 60; t + minutes <= CLOSE * 60; t += STEP) {
    const time = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    const start = atTime(day, time);
    const end = new Date(start.getTime() + minutes * 60_000);
    const busy = booked.some((b) => start < new Date(b.ends_at) && end > new Date(b.starts_at));
    if (start > now && !busy) out.push(time);
  }
  return out;
}

export const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
