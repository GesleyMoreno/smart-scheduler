// Saves the booking in Postgres and creates the Google Calendar event
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calendarId, cors, googleToken, json } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const { service, startsAt, endsAt, name, email } = await req.json().catch(() => ({}));
  const start = new Date(startsAt), end = new Date(endsAt);
  const valid =
    typeof service === "string" && service.length < 80 &&
    typeof name === "string" && name.trim().length > 0 && name.length < 100 &&
    typeof email === "string" && /^\S+@\S+\.\S+$/.test(email) && email.length < 200 &&
    start.getTime() > Date.now() && end > start && end.getTime() - start.getTime() <= 2 * 3600_000;
  if (!valid) return json({ error: "invalid_input" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await db
    .from("appointments")
    .insert({ service, starts_at: start.toISOString(), ends_at: end.toISOString(), customer_name: name.trim(), customer_email: email })
    .select("id")
    .single();
  if (error) return json({ error: error.code === "23P01" ? "slot_taken" : "db_error" }, error.code === "23P01" ? 409 : 500);

  let googleLink: string | undefined;
  try {
    const token = await googleToken();
    // sendUpdates=none: no invitation emails. Use "all" to notify the attendee.
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId()}/events?sendUpdates=none`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `${service} with ${name.trim()}`,
        description: `Booked online. Contact: ${email}`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: [{ email }],
      }),
    });
    if (res.ok) {
      const ev = await res.json();
      googleLink = ev.htmlLink;
      await db.from("appointments").update({ google_event_id: ev.id }).eq("id", data.id);
    }
  } catch (_) {
    // The booking stays saved even if Google is unavailable
  }
  return json({ id: data.id, googleLink });
});
