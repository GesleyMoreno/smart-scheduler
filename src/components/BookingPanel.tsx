import { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import { bookAppointment, getBooked, SERVICES } from "../services/appointments";
import { buildSlots, fmtDay, isWorkday, nextWorkday } from "../lib/slots";
import type { Booked, Service } from "../types";

interface Props { version: number; onBooked: () => void }

const field = "w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

export default function BookingPanel({ version, onBooked }: Props) {
  const [service, setService] = useState<Service>(SERVICES[0]);
  const [day, setDay] = useState<Date>(nextWorkday());
  const [booked, setBooked] = useState<Booked[]>([]);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    getBooked(day).then((b) => live && setBooked(b)).catch(() => live && setBooked([]));
    return () => { live = false; };
  }, [day, version]);

  const slots = useMemo(() => buildSlots(day, service.minutes, booked), [day, service, booked]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!time || !name.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      return setMsg({ ok: false, text: "Pick a time and enter a valid name and email." });
    }
    setSaving(true);
    setMsg(null);
    try {
      const r = await bookAppointment({ service, day, time, name: name.trim(), email });
      setMsg({ ok: true, text: `Booked: ${service.name}, ${fmtDay(day)} at ${time}.${r.demo ? " (Demo mode, nothing was sent.)" : ""}` });
      setTime(null); setName(""); setEmail("");
      onBooked();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Book an appointment" className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-extrabold text-slate-900">Book a time</h2>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Service">
        {SERVICES.map((s) => (
          <button key={s.id} onClick={() => { setService(s); setTime(null); }} aria-pressed={s.id === service.id}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${s.id === service.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {s.name} · {s.minutes} min
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Calendar locale="en-US" minDate={new Date()} value={day}
          tileDisabled={({ date, view }) => view === "month" && !isWorkday(date)}
          onChange={(v) => { if (v instanceof Date) { setDay(v); setTime(null); } }} />

        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">{fmtDay(day)}</p>
            {slots.length === 0 ? (
              <p className="text-sm text-slate-500">No free times on this day.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => (
                  <button type="button" key={s} onClick={() => setTime(s)} aria-pressed={s === time}
                    className={`rounded-lg border px-2 py-2 text-sm font-semibold ${s === time ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 hover:border-indigo-400"}`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="block text-sm font-semibold">Name
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="block text-sm font-semibold">Email
            <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving ? "Booking…" : "Confirm booking"}
          </button>
          {msg && <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
        </form>
      </div>
    </section>
  );
}
