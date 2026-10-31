import { supabase } from "../lib/supabase";

export interface ChatTurn { role: string; content: string }

// Returns null in demo mode or when the AI service is unavailable
export async function askAI(history: ChatTurn[]): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke("chat", { body: { messages: history.slice(-10) } });
  return error ? null : ((data as { reply?: string }).reply ?? null);
}
