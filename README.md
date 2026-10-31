# Smart Scheduler: Business Suite

Appointment system for a company: public booking with a chatbot, customer accounts, and an admin panel. React + TypeScript + Tailwind CSS, Supabase (Auth, Postgres, Edge Functions), Google Calendar API and the Anthropic API.

## Run in demo mode (no keys needed)
```bash
npm install
npm run dev
```
Demo mode keeps data in the browser. Sign in with `admin@demo.com` (any password with 6+ characters) to open the admin panel with sample data.

## Go live
1. **Supabase**: create a project and run `supabase/migrations/001_init.sql` in the SQL editor. In Authentication settings, turn off "Confirm email" for testing.
2. **Frontend keys**: copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. **First admin**: create an account in the app, then run `update public.profiles set role = 'admin' where email = 'you@example.com';`
4. **Google Calendar**: enable the Calendar API, create an OAuth client and get a refresh token (scope `https://www.googleapis.com/auth/calendar.events`).
5. **Functions and secrets**:
```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... GOOGLE_CALENDAR_ID=primary ANTHROPIC_API_KEY=... CRON_SECRET=... RESEND_API_KEY=... REMINDER_FROM="Name <you@yourdomain.com>"
npx supabase functions deploy book
npx supabase functions deploy cancel
npx supabase functions deploy chat
npx supabase functions deploy remind --no-verify-jwt
```
6. **Reminders schedule**: enable the `pg_cron` and `pg_net` extensions, then run in the SQL editor:
```sql
select cron.schedule('appointment-reminders', '0 * * * *', $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/remind',
    headers := '{"x-cron-secret": "YOUR-CRON-SECRET"}'::jsonb
  );
$$);
```
7. **Publish**: `npm run build` and deploy `dist` with the two `VITE_` variables set in the host.

## What it demonstrates
- **Front-end**: typed React components, react-calendar, responsive layout, loading and error states
- **Auth and roles**: Supabase Auth, `profiles` table, admin-only data protected by Row Level Security
- **Database**: Postgres with an exclusion constraint that blocks double bookings
- **Back-end**: Edge Functions with input validation (`book`, `cancel`, `chat`, `remind`)
- **Integrations**: Google Calendar (create and delete events), Anthropic API (chat), Resend (email)
- **Automation**: hourly job that sends 24-hour reminders
- **Admin dashboard**: KPIs, month-over-month comparison, bar chart, status filter, cancellation
- **Chatbot**: guided booking flow plus AI answers to general questions

## Known limits
- Business hours (09:00 to 17:00, Mon to Fri) use the visitor's browser time zone
- Public Edge Functions (`book`, `chat`) have no rate limiting yet. Add it before production, since `chat` calls a paid API
- Customers cannot cancel their own appointments yet
