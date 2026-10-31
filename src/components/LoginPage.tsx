import { useState } from "react";
import { isDemo } from "../services/appointments";
import { signIn, signUp } from "../services/auth";

const field = "w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

export default function LoginPage({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState(isDemo ? "admin@demo.com" : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await (mode === "in" ? signIn(email.trim(), password) : signUp(email.trim(), password));
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Sign in" className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8">
      <h2 className="text-xl font-extrabold text-slate-900">{mode === "in" ? "Sign in" : "Create account"}</h2>
      {isDemo && (
        <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Demo mode: use <b>admin@demo.com</b> with any password of 6+ characters to open the admin panel. Other emails sign in as customers.
        </p>
      )}
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block text-sm font-semibold">Email
          <input className={field} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="block text-sm font-semibold">Password
          <input className={field} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} />
        </label>
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 text-sm font-semibold text-indigo-600 hover:underline">
        {mode === "in" ? "No account? Create one" : "Already have an account? Sign in"}
      </button>
    </section>
  );
}
