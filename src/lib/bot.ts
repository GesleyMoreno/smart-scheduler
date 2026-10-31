// Small language helpers for the scheduling bot (English + a few Portuguese words)
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function parseDate(text: string, now = new Date()): Date | null {
  const t = text.toLowerCase();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (/\b(today|hoje)\b/.test(t)) return d;
  if (/\b(tomorrow|amanh[aã])\b/.test(t)) { d.setDate(d.getDate() + 1); return d; }
  const i = [...DAYS, ...PT].findIndex((n) => t.includes(n));
  if (i >= 0) {
    const diff = (i % 7 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d;
  }
  return null;
}

export function parseTime(text: string): string | null {
  const t = text.toLowerCase();
  const ampm = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  let h: number, m: number;
  if (ampm) {
    h = Number(ampm[1]) % 12 + (ampm[3] === "pm" ? 12 : 0);
    m = Number(ampm[2] ?? 0);
  } else {
    const h24 = t.match(/\b(\d{1,2})[:h](\d{2})?\b/);
    if (!h24) return null;
    h = Number(h24[1]);
    m = Number(h24[2] ?? 0);
  }
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const parseEmail = (text: string) => text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0] ?? null;
export const wantsNext = (text: string) => /\b(next|earliest|soonest|first available|primeiro)\b/.test(text);
