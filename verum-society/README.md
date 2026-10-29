# Verum Society

Private members club web-app: events + RSVP, ledenactivatie met vragenlijst vooraf, chatrooms (realtime) en een beheerpaneel.

**Stack:** Next.js (App Router) · Supabase (auth, Postgres, RLS, Realtime) · installeerbaar als PWA.

## Starten

```bash
cd verum-society
npm install
npm run dev        # http://localhost:3000
```

Zonder `.env.local` draait de app in **demo-modus** (data in je browser). Log in met een e-mail met "admin" (bv. `admin@verum.nl`) om het beheerpaneel te zien.

## Echte backend

1. Maak een Supabase-project en plak `supabase/schema.sql` in de SQL editor.
2. Kopieer `.env.example` naar `.env.local` en vul URL + anon key in.
3. Registreer jezelf in de app en maak jezelf admin:
   `update public.profiles set role='admin', status='active' where email='jij@email.nl';`

## Ledenflow

registreren → vragenlijst ("wat breng jij naar Verum?") → status `pending` → admin activeert → toegang tot events en chat.
RLS dwingt dit af in de database: niet-actieve leden kunnen geen events, RSVP's of chat lezen, en leden kunnen zichzelf niet activeren.
