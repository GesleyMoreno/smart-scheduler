import { useEffect, useRef, useState } from "react";
import { bookAppointment, getBooked, SERVICES } from "../services/appointments";
import { buildSlots, fmtDay, isWorkday } from "../lib/slots";
import { parseDate, parseEmail, parseTime, wantsNext } from "../lib/bot";
import { askAI } from "../services/ai";
import type { Service } from "../types";

interface Msg { from: "bot" | "you"; text: string }
interface Draft { service?: Service; date?: Date; time?: string; name?: string; email?: string }
interface Props { onBooked: () => void }

// The next piece of information the bot still needs
const missing = (d: Draft) =>
  !d.service ? "service" : !d.date ? "date" : !d.time ? "time" : !d.name ? "name" : !d.email ? "email" : "confirm";

const freeSlots = async (s: Service, day: Date) => buildSlots(day, s.minutes, await getBooked(day));

async function firstFree(s: Service) {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const free = await freeSlots(s, day);
    if (free.length) return { date: new Date(day), time: free[0] };
    day.setDate(day.getDate() + 1);
  }
  return null;
}

export default function ChatBot({ onBooked }: Props) {
  const names = SERVICES.map((s) => s.name);
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: "Hi! I'm the scheduling assistant. Which service would you like?" }]);
  const [chips, setChips] = useState<string[]>(names);
  const [draft, setDraft] = useState<Draft>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs]);

  const say = (text: string, c: string[] = []) => {
    setMsgs((m) => [...m, { from: "bot", text }]);
    setChips(c);
  };

  async function finish(d: Draft) {
    try {
      const r = await bookAppointment({ service: d.service!, day: d.date!, time: d.time!, name: d.name!, email: d.email! });
      onBooked();
      setDraft({});
      say(`You're booked! ${d.service!.name}, ${fmtDay(d.date!)} at ${d.time}.${r.demo ? " (Demo mode, nothing was sent.)" : r.googleLink ? " It's on the calendar." : ""}`, ["Book another"]);
    } catch (e) {
      setDraft({ ...d, time: undefined });
      say((e as Error).message, ["Show free times"]);
    }
  }

  async function advance(text: string): Promise<void> {
    const d: Draft = { ...draft };
    const asked = missing(d);
    const lower = text.toLowerCase();

    if (asked === "confirm") {
      if (/^(y|yes|sim|ok|sure|confirm)/.test(lower)) return finish(d);
      setDraft({});
      return say("No problem, let's start over. Which service would you like?", names);
    }
    if (asked === "service") {
      d.service = SERVICES.find((s) => lower.includes(s.name.toLowerCase()) || lower.includes(s.id));
      if (!d.service) {
        if (/\b(book|schedule|appointment|agendar)\b/.test(lower)) return say("Sure! Which service would you like?", names);
        // Not a booking step: let the AI answer general questions (live mode only)
        const history = [...msgs, { from: "you" as const, text }].map((m) => ({ role: m.from === "you" ? "user" : "assistant", content: m.text }));
        const ai = await askAI(history);
        return say(ai ?? "Please choose one of the services below.", names);
      }
    }
    if (!d.date && (asked === "service" || asked === "date")) {
      if (wantsNext(lower)) {
        const f = await firstFree(d.service!);
        if (!f) return say("No free slots in the next 14 days.");
        d.date = f.date;
        d.time = f.time;
      } else {
        d.date = parseDate(text) ?? undefined;
      }
    }
    if (!d.time && ["service", "date", "time"].includes(asked)) d.time = parseTime(text) ?? undefined;
    if (asked === "name") d.name = text;
    if (asked === "email") d.email = parseEmail(text) ?? undefined;

    if (d.date && !isWorkday(d.date)) {
      d.date = undefined; d.time = undefined;
      setDraft(d);
      return say("We're closed on weekends. Please pick a weekday.", ["Tomorrow", "Next available"]);
    }
    if (d.date && d.time) {
      const free = await freeSlots(d.service!, d.date);
      if (!free.includes(d.time)) {
        const day = d.date;
        d.time = undefined;
        if (!free.length) d.date = undefined;
        setDraft(d);
        return say(free.length ? `That time isn't available on ${fmtDay(day)}. Free times:` : `${fmtDay(day)} is fully booked. Try another day.`, free.slice(0, 8));
      }
    }

    setDraft(d);
    switch (missing(d)) {
      case "date":
        return say("Which day works for you? Try “tomorrow”, “Friday” or “next available”.", ["Tomorrow", "Next available"]);
      case "time": {
        const day = d.date!;
        const free = await freeSlots(d.service!, day);
        if (!free.length) { d.date = undefined; setDraft(d); return say(`${fmtDay(day)} is fully booked. Pick another day.`, ["Next available"]); }
        return say(`Free times on ${fmtDay(day)}:`, free.slice(0, 8));
      }
      case "name":
        return say("Great. What's your name?");
      case "email":
        return say(asked === "email" ? "That doesn't look like a valid email. Try again?" : `Thanks, ${d.name!.split(" ")[0]}. What's your email?`);
      default:
        return say(`Book ${d.service!.name} on ${fmtDay(d.date!)} at ${d.time}? (yes / no)`, ["Yes, book it", "No, start over"]);
    }
  }

  async function handle(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setMsgs((m) => [...m, { from: "you", text }]);
    setChips([]);
    setInput("");
    setBusy(true);
    try { await advance(text); }
    catch { say("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <section aria-label="Scheduling assistant" className="flex h-[640px] flex-col rounded-2xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-extrabold text-slate-900">Scheduling assistant</h2>
        <p className="text-xs text-slate-500">Try: “Consultation tomorrow at 3pm”</p>
      </header>
      <div ref={box} className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === "you" ? "justify-end" : ""}`}>
            <p className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.from === "you" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}>{m.text}</p>
          </div>
        ))}
        {busy && <p className="animate-pulse text-sm text-slate-400">typing…</p>}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {chips.map((c) => (
            <button key={c} onClick={() => handle(c)} className="rounded-full border border-indigo-200 px-3 py-1 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">{c}</button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); handle(input); }} className="flex gap-2 border-t border-slate-100 p-4">
        <label className="flex-1"><span className="sr-only">Message</span>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message…"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" />
        </label>
        <button type="submit" disabled={busy} className="rounded-xl bg-indigo-600 px-5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Send</button>
      </form>
    </section>
  );
}
