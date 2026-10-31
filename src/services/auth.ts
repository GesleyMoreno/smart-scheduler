import { supabase } from "../lib/supabase";
import type { Session } from "../types";

const DEMO_KEY = "smart-scheduler-session";
const demoRole = (email: string): Session["role"] => (email.toLowerCase() === "admin@demo.com" ? "admin" : "customer");

export async function getSession(): Promise<Session | null> {
  if (!supabase) {
    try { return JSON.parse(localStorage.getItem(DEMO_KEY) ?? "null"); } catch { return null; }
  }
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { email: user.email ?? "", role: profile?.role === "admin" ? "admin" : "customer" };
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) {
    if (password.length < 6) throw new Error("Password must have at least 6 characters.");
    localStorage.setItem(DEMO_KEY, JSON.stringify({ email, role: demoRole(email) }));
    return;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signUp(email: string, password: string): Promise<void> {
  if (!supabase) return signIn(email, password);
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  if (!supabase) localStorage.removeItem(DEMO_KEY);
  else await supabase.auth.signOut();
}

export function onAuthChange(cb: () => void): () => void {
  if (!supabase) return () => {};
  // setTimeout avoids calling Supabase inside its own auth callback
  const { data } = supabase.auth.onAuthStateChange(() => setTimeout(cb, 0));
  return () => data.subscription.unsubscribe();
}
