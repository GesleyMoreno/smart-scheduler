// AI assistant for general questions (uses the Anthropic API). Bookings are handled by the app's own flow.
import { cors, json } from "../_shared/google.ts";

const SYSTEM = `You are the virtual assistant of a consulting company.
Services: Intro call (30 min), Consultation (60 min), Project review (45 min).
Opening hours: Monday to Friday, 9:00 to 17:00.
Reply in the customer's language, in at most 3 short sentences.
Never invent prices, policies or availability. If you don't know, say a team member will follow up.
To book, tell the customer to type "book" or use the calendar.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const body = await req.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
  const messages = raw
    .filter((m): m is { role: string; content: string } =>
      !!m && typeof (m as any).content === "string" && ["user", "assistant"].includes((m as any).role))
    .map((m) => ({ role: m.role, content: m.content.slice(0, 500) }));
  while (messages[0]?.role === "assistant") messages.shift(); // must start with a user message
  if (!messages.length) return json({ error: "invalid_input" }, 400);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-5-5",
      max_tokens: 300,
      system: SYSTEM,
      messages,
    }),
  });
  if (!res.ok) return json({ error: "ai_unavailable" }, 502);
  const data = await res.json();
  return json({ reply: data.content?.[0]?.text ?? null });
});
