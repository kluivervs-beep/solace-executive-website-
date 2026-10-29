# Verum Society: brief voor de volgende Claude-sessie

Kopieer alles onder "PROMPT" in een nieuwe sessie. Zorg dat die sessie toegang heeft tot: (1) de Solace-app-repo, (2) branch `claude/verum-society-app` van `kluivervs-beep/solace-executive-website-`, (3) een lege repo `verum-society`.

---

## PROMPT

Je bouwt **Verum Society**: een besloten members club-app voor iOS (App Store). Wij organiseren feesten, dinners, trips en activiteiten zoals wijnproeverijen. "Verum" is Latijn voor "het ware, het echte". Dat is de kern: echt, uitgekozen, geen massa. Het is exclusief maar chic: strak, rustig, zelfverzekerd. Geen ingewikkelde app; mooi en duidelijk.

### 0. Startpunt en werkwijze
1. Lees `verum-society/HANDOFF.md` en `verum-society/mobile/README.md` op branch `claude/verum-society-app`. Daar staat al een werkende Expo/React Native-app (home met events + RSVP, vragenlijst, ledenactivatie, realtime chat, beheerpaneel, account verwijderen, berichten melden) met Supabase-schema in `verum-society/supabase/schema.sql`.
2. Zet dit over naar de nieuwe repo `verum-society` (los van Solace, eigen Supabase-project, eigen bundle ID).
3. Lees de **Solace-app-repo** en neem de basis over op dezelfde manier: login-flow, instellingen-scherm, build-configuratie, signing en de **update-methode**. Bij Solace pas ik kleine wijzigingen aan en dan herstart de app zichzelf met de update (over-the-air), zonder App Store. Zoek zelf uit hoe dat bij Solace is gebouwd (waarschijnlijk EAS Update/`expo-updates`) en bouw hetzelfde voor Verum. Grote updates gaan via de App Store/TestFlight.
4. Werk in fases en lever na elke fase iets dat draait. Begin met fase 1 (MVP). Vraag alleen iets als je echt vastzit. Houd antwoorden kort.

### 1. Ontwerp
- Mooi, strak en duidelijk. Donker, chic, rustig. Zwart/wijnrood/goud is de huidige richting (zie `mobile/src/theme.ts`).
- **Loginscherm**: strak en duidelijk. Logo, korte tekst, e-mail + wachtwoord, "Vraag toegang aan". Basis van Solace-login overnemen waar het beter is.
- **Thema wijzigen**: lid kiest een accentkleur uit een paar chique presets (goud, zilver, bordeaux, smaragd, saffier). Onthouden in profiel.
- **Profielfoto**: elk lid kan een foto toevoegen (Supabase Storage, bijsnijden rond).
- **Instellingen**: zoals bij Solace (profiel, thema, meldingen, privacy, uitloggen, account verwijderen).

### 2. Home
- Duidelijk welke events eraan komen. Eerstvolgende event groot met **banner-afbeelding**, daaronder de rest.
- Per event: banner, titel, datum/tijd, locatie, prijs, beschrijving, wie komt, "Ik ben erbij / Misschien / Kan niet".
- **Admin kan per event een link toevoegen** (bijv. ticket-, betaal- of inschrijflink) die als knop in het event staat.
- Bovenaan een compact "hype"-blok: aantal leden, vrije plekken, aantal op de wachtlijst (zie §4).

### 3. Ledenproces (application)
- Aanvraag-vragenlijst = de vragen uit deze Typeform: https://form.typeform.com/to/qA5IJkQ6
  **[PLAK HIER DE VRAGEN, in volgorde, met antwoordtype/opties]**
  Bouw ze native in de app (stap voor stap, geen webview) en bewaar de antwoorden in Supabase.
- Status: `onboarding` → `pending` (in behandeling) → `active` of `waitlist`/`suspended`.
- Admin bekijkt antwoorden, activeert, weigert of zet op de wachtlijst.

### 4. Wachtlijst en schaarste
- Admin stelt in: **totaal aantal ledenplekken** (bijv. 150) en eventueel per event capaciteit.
- Toon in de app (aanvraagscherm en home): "X van Y plekken bezet · Z mensen wachten". Dit moet exclusief voelen: niet iedereen kan erbij.
- Wachtlijst: aanvrager ziet zijn positie. Admin kan bij vrijgekomen plek de eerstvolgende of een zelfgekozen persoon toelaten. Bij een vol event kunnen leden ook op de event-wachtlijst.

### 5. Chat
- Chatrooms voor actieve leden (realtime, bestaat al): The Lounge, Aankomend, Trips.
- **Private room**: besloten ruimte waar leden met elkaar kunnen chatten. Leden kunnen zelf een privéroom of groepschat maken en alleen uitgenodigde leden zien die. Ook 1-op-1 berichten tussen leden.
- Behoud melden van berichten en voeg blokkeren van leden toe (App Store-eis).

### 6. Admin
- Leden: activeren/weigeren/wachtlijst/pauzeren, vragenlijst-antwoorden lezen, plekken instellen.
- Events: aanmaken/bewerken/verwijderen met banner, link, capaciteit, prijs; zien wie komt.
- Meldingen (reports) lezen en afhandelen.

### 7. Wat Verum uniek maakt (neem mee en bouw in fases)
Kies zelf een slimme volgorde; deze horen bij een club die "echt" wil zijn:
- **Lidnummer en founding members**: elk lid krijgt een nummer (No. 001 t/m). Eerste leden zijn "Founding Members". Maakt het persoonlijk en schaars.
- **Introductie door een lid (sponsor)**: een lid kan iemand voordragen; voorgedragen aanvragen wegen zwaarder. Vertrouwen als kern ("verum").
- **Adres pas onthullen kort voor het event** (alleen voor bevestigde aanwezigen) en **mystery events** (details pas op het laatste moment).
- **Aanwezigheid serieus**: voorkom no-shows (bijv. bevestigen 48 uur van tevoren, of een kleine borg). Wie vaak niet komt zakt op de lijst.
- **"Wat ik breng"-profielen**: de vragenlijst wordt een zichtbaar ledenprofiel (expertise, interesses), zodat leden elkaar vinden en helpen. Een kleine ledengids.
- **Plus-one op goedkeuring** van de admin.
- **Besloten foto's per event** alleen voor aanwezigen, met afspraak "geen foto's delen buiten de club".
- **Seizoenen/hoofdstukken**: het jaar in seizoenen met een hoogtepunt-event (bijv. jaarlijks diner).
- **Partner-voordelen** (restaurants, wijnhuizen, hotels) alleen voor leden.
- **Concierge-koppeling met Solace** (optioneel, later): leden kunnen via Verum iets regelen (vervoer, villa).
- **Pushmeldingen** bij nieuw event, plek vrij, bevestigd van wachtlijst.

### 8. Techniek en eisen
- Expo/React Native + TypeScript, Supabase (auth, Postgres met RLS, Realtime, Storage). **Eigen Supabase-project voor Verum**, nooit dat van Solace.
- App Store: account verwijderen in de app, berichten melden/blokkeren, privacybeleid-URL, demo-account voor Apple-review, geen verwijzing naar niet-Apple betaalmethodes voor digitale goederen. Fysieke events/tickets via externe link zijn toegestaan.
- Bouw en test: TypeScript moet slagen; test de flow in de browser/simulator. Zet bouwen via EAS klaar voor TestFlight (zie `mobile/README.md`).
- Raak niets van Solace aan.

### 9. Eerste fase (MVP) die ik wil zien
1. Nieuwe repo + overnemen basis van Solace-app (login, instellingen, update-methode).
2. Strak loginscherm, aanvraag met Typeform-vragen, wachtlijst met plekken-teller.
3. Home met bannerevents + link-knop, RSVP.
4. Profielfoto, thema-keuze, instellingen.
5. Privéroom/chat met melden en blokkeren.
6. Beheerpaneel voor leden, plekken en events.
7. EAS-build → TestFlight.

---

## Notities (voor jezelf, niet in de prompt plakken)
- Typeform-vragen kon ik niet ophalen (netwerk geblokkeerd). Plak ze zelf in §3.
- Vul bij ideeën hieronder aan wat je nog bedenkt, en plak het dan mee:

(nieuwe ideeën hier)
