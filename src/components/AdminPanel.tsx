import { useEffect, useMemo, useState } from "react";
import { cancelAppointment, listAppointments } from "../services/appointments";
import type { Appointment } from "../types";

type Filter = "all" | "confirmed" | "cancelled";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();

export default function AdminPanel({ version }: { version: number }) {
  const [rows, setRows] = useState<Appointment[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [filter, setFilter] = useState<Filter>("all");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    listAppointments()
      .then((r) => { if (live) { setRows(r); setState("ready"); } })
      .catch(() => live && setState("error"));
    return () => { live = false; };
  }, [version, tick]);

  const stats = useMemo(() => {
    const now = new Date();
    const confirmed = rows.filter((r) => r.status === "confirmed");
    const cur = monthKey(now);
    const months = Array.from({ length: 6 }, (_, i) => {
      const k = cur - (5 - i);
      return {
        label: new Date(Math.floor(k / 12), k % 12, 1).toLocaleDateString("en-US", { month: "short" }),
        count: confirmed.filter((r) => monthKey(new Date(r.starts_at)) === k).length,
      };
    });
    const [last, current] = [months[4].count, months[5].count];
    return {
      months,
      current,
      delta: last ? Math.round(((current - last) / last) * 100) : null,
      upcoming: confirmed.filter((r) => new Date(r.starts_at) > now).length,
      customers: new Set(rows.map((r) => r.customer_email)).size,
      cancelRate: rows.length ? Math.round((rows.filter((r) => r.status === "cancelled").length / rows.length) * 100) : 0,
    };
  }, [rows]);

  const shown = rows.filter((r) => filter === "all" || r.status === filter).slice(0, 15);
  const max = Math.max(1, ...stats.months.map((m) => m.count));

  async function cancel(a: Appointment) {
    if (!window.confirm(`Cancel ${a.customer_name}'s ${a.service}?`)) return;
    try { await cancelAppointment(a.id); setTick((t) => t + 1); }
    catch { window.alert("Could not cancel. Please try again."); }
  }

  if (state === "loading") return <div aria-busy="true" className="h-96 animate-pulse rounded-2xl bg-slate-200" />;
  if (state === "error") return <p role="alert" className="rounded-xl bg-red-50 p-6 text-center font-semibold text-red-700">Could not load appointments. Make sure you are signed in as an admin.</p>;

  const kpis = [
    { label: "This month", value: stats.current, note: stats.delta === null ? "no data last month" : `${stats.delta >= 0 ? "+" : ""}${stats.delta}% vs last month` },
    { label: "Upcoming", value: stats.upcoming, note: "confirmed" },
    { label: "Customers", value: stats.customers, note: "unique emails" },
    { label: "Cancellation rate", value: `${stats.cancelRate}%`, note: "all time" },
  ];

  return (
    <div className="space-y-6">
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k.label}</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900">{k.value}</p>
            <p className="text-xs text-slate-500">{k.note}</p>
          </div>
        ))}
      </section>

      <section aria-label="Appointments per month" className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-bold text-slate-900">Appointments per month</h2>
        <div className="flex gap-3">
          {stats.months.map((m) => (
            <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-semibold">{m.count}</span>
              <div className="flex h-28 w-full items-end">
                <div className="w-full rounded-t-lg bg-indigo-500" style={{ height: `${(m.count / max) * 100}%`, minHeight: 4 }} />
              </div>
              <span className="text-xs text-slate-500">{m.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Appointments" className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-slate-900">Appointments</h2>
          <div role="group" aria-label="Status filter" className="flex gap-2">
            {(["all", "confirmed", "cancelled"] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} aria-pressed={f === filter}
                className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${f === filter ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}>{f}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="py-2">Customer</th><th>Service</th><th>When</th><th>Status</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((a) => (
                <tr key={a.id}>
                  <td className="py-3"><p className="font-semibold text-slate-900">{a.customer_name}</p><p className="text-xs text-slate-500">{a.customer_email}</p></td>
                  <td>{a.service}</td>
                  <td>{fmt(a.starts_at)}</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.status === "confirmed" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>{a.status}</span></td>
                  <td className="text-right">
                    {a.status === "confirmed" && new Date(a.starts_at) > new Date() && (
                      <button onClick={() => cancel(a)} className="rounded-lg px-3 py-1 font-semibold text-red-600 hover:bg-red-50">Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-500">No appointments.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
