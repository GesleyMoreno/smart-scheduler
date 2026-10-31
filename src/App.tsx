import { useState } from "react";
import AdminPanel from "./components/AdminPanel";
import BookingPanel from "./components/BookingPanel";
import ChatBot from "./components/ChatBot";
import LoginPage from "./components/LoginPage";
import { useSession } from "./hooks";
import { isDemo } from "./services/appointments";
import { signOut } from "./services/auth";

type View = "book" | "admin" | "login";

export default function App() {
  const { session, refresh } = useSession();
  const [view, setView] = useState<View>("book");
  const [version, setVersion] = useState(0); // bumps after each booking so panels refresh
  const bump = () => setVersion((v) => v + 1);

  const isAdmin = session?.role === "admin";
  const current: View = view === "admin" && !isAdmin ? "book" : view;
  const tab = (v: View, label: string) => (
    <button onClick={() => setView(v)} aria-current={current === v ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${current === v ? "bg-white text-indigo-950" : "text-indigo-200 hover:text-white"}`}>{label}</button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-indigo-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Smart Scheduler</h1>
            <p translate="no" className="text-sm text-indigo-300">Business suite · React · TypeScript · Supabase · Google Calendar · AI</p>
          </div>
          <nav aria-label="Main" className="flex flex-wrap items-center gap-2">
            {tab("book", "Book")}
            {isAdmin && tab("admin", "Admin")}
            {session ? (
              <button onClick={async () => { await signOut(); refresh(); setView("book"); }}
                className="rounded-lg border border-indigo-400 px-3 py-1.5 text-sm font-semibold">Sign out ({session.email})</button>
            ) : (
              tab("login", "Sign in")
            )}
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${isDemo ? "bg-amber-400 text-amber-950" : "bg-emerald-400 text-emerald-950"}`}>
              {isDemo ? "Demo mode" : "Live"}
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {current === "login" && <LoginPage onDone={() => { refresh(); setView("book"); }} />}
        {current === "admin" && <AdminPanel version={version} />}
        {current === "book" && (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <BookingPanel version={version} onBooked={bump} />
            <ChatBot onBooked={bump} />
          </div>
        )}
      </main>
    </div>
  );
}
