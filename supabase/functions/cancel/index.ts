// Admin only: marks the appointment as cancelled and removes the Google Calendar event
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calendarId, cors, googleToken, json } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Check the caller's role using their own JWT
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: admin } = await asUser.rpc("is_admin");
  if (!admin) return json({ error: "forbidden" }, 403);

  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string") return json({ error: "invalid_input" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await db.from("appointments").update({ status: "cancelled" }).eq("id", id).select("google_event_id").single();
  if (error) return json({ error: "db_error" }, 500);

  if (data.google_event_id) {
    try {
      const token = await googleToken();
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId()}/events/${data.google_event_id}?sendUpdates=none`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (_) {
      // Cancelled in the database even if Google is unavailable
    }
  }
  return json({ ok: true });
});
