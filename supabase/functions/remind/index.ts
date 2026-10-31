// Automation: emails customers about appointments starting in about 24 hours.
// Called by a schedule (pg_cron) with the x-cron-secret header. Deploy with --no-verify-jwt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return json({ error: "forbidden" }, 403);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const from = new Date(Date.now() + 23 * 3600_000).toISOString();
  const to = new Date(Date.now() + 25 * 3600_000).toISOString();
  const { data } = await db.from("appointments").select("*")
    .eq("status", "confirmed").is("reminded_at", null).gte("starts_at", from).lte("starts_at", to);

  let sent = 0;
  for (const a of data ?? []) {
    const when = new Date(a.starts_at).toUTCString();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("REMINDER_FROM"),
        to: a.customer_email,
        subject: `Reminder: ${a.service} tomorrow`,
        html: `<p>Hi ${a.customer_name}, this is a reminder of your <b>${a.service}</b> on ${when}.</p>`,
      }),
    });
    if (res.ok) { await db.from("appointments").update({ reminded_at: new Date().toISOString() }).eq("id", a.id); sent++; }
  }
  return json({ sent });
});
