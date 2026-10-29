# Verum Society: iOS-app (Expo / React Native)

Native app voor de App Store. Zelfde Supabase-backend en schema als de web-versie in `../` (`../supabase/schema.sql`).
Gebruik hiervoor een **eigen Supabase-project voor Verum**, los van Solace.

## Starten

```bash
cd verum-society/mobile
npm install
npx expo start        # scan de QR met Expo Go, of druk op "i" voor de iOS-simulator (Mac)
```

Zonder `.env` draait de app in **demo-modus** (data lokaal op het toestel). Log in met een e-mail met "admin" voor het beheerpaneel.
Echte backend: kopieer `.env.example` naar `.env` en vul de Supabase URL + anon key in.

## Naar de App Store

1. Apple Developer-account (€99/jaar). Zet in `app.json` je eigen `ios.bundleIdentifier` (nu `nl.verumsociety.app`).
2. `npm i -g eas-cli && eas login && eas build:configure`
3. Zet de Supabase-keys als EAS-secrets: `eas secret:create --name EXPO_PUBLIC_SUPABASE_URL ...`
4. `eas build --platform ios --profile production`
5. `eas submit --platform ios`, daarna vul je App Store Connect in (screenshots, beschrijving).

### Wat Apple controleert (staat al in de app)
- **Account verwijderen in de app** (Profiel → Account verwijderen), verplicht bij accounts. Backend: `delete_my_account()` in het schema.
- **Berichten melden** (lang indrukken in de chat), verplicht bij user-generated content. Meldingen komen in tabel `reports`.

### Nog zelf te doen
- **Privacybeleid-URL** (verplicht in App Store Connect).
- **Review-account**: geef Apple een actief demo-lid + wachtwoord in de review-notities, want de app is op aanvraag.
- **Blokkeren van leden** en een scherm om meldingen te lezen in het beheerpaneel (nu alleen via Supabase).
- Optioneel: pushmeldingen (`expo-notifications`) voor nieuwe events.
