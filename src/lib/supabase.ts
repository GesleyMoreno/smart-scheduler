import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// null = demo mode (no keys configured): data stays in the browser
export const supabase = url && key && !url.includes("YOUR-PROJECT") ? createClient(url, key) : null;
