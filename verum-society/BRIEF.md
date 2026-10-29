# Verum Society: brief voor de volgende Claude-sessie

Kopieer alles onder "PROMPT" in een nieuwe sessie. Zorg dat die sessie toegang heeft tot: (1) de Solace-app-repo, (2) branch `claude/verum-society-app` van `kluivervs-beep/solace-executive-website-`, (3) een lege repo `verum-society`.

---

## PROMPT

Je bouwt **Verum Society**: een besloten members club-app voor iOS (App Store). Wij organiseren feesten, dinners, trips en activiteiten zoals wijnproeverijen. "Verum" is Latijn voor "het ware, het echte". Dat is de kern: echt, uitgekozen, geen massa. Het is exclusief maar chic: strak, rustig, zelfverzekerd. Geen ingewikkelde app; mooi en duidelijk.

### 0. Startpunt en werkwijze
1. Lees `verum-society/HANDOFF.md` en `verum-society/mobile/README.md` op branch `claude/verum-society-app`. Daar staat al een werkende Expo/React Native-app (home met events + RSVP, vragenlijst, ledenactivatie, realtime chat, beheerpaneel, account verwijderen, berichten melden) met Supabase-schema in `verum-society/supabase/schema.sql`.
2. Zet dit over naar de nieuwe repo `verum-society` (los van Solace, eigen Supabase-project, eigen bundle ID).
3. Lees de **Solace-app-repo** en neem de basis over op dezelfde manier: login-flow, instellingen-scherm, build-configuratie, signing en de **update-methode**. Bij Solace pas ik kleine wijzigingen aan en dan herstart de app zichzelf met de update (over-the-air), zonder App Store. Zoek zelf uit hoe dat bij Solace is gebouwd (waarschijnlijk EAS Update/`expo-updates`) en bouw hetzelfde voor Verum. Grote updates gaan via de App Store/TestFlight.
4. **Werkwijze met meerdere agents (zodat niets vergeten wordt):**
   - Begin met een **takenlijst**: haal elke eis uit deze brief eruit (elk onderdeel, elke zin met "moet") en zet ze als losse taken in de takenlijst. Vink pas af wat gebouwd én getest is.
   - Gebruik **meerdere agents**, één per werkstroom, bijvoorbeeld: (a) database/Supabase en rechten, (b) auth, aanvraag, wachtlijst en welkom, (c) events, home en curator, (d) chat, Side Quest en private rooms, (e) profiel, DNA, thema en instellingen, (f) taal NL/EN, privacy en Apple-eisen. Geef elke agent eigen bestanden/mappen zodat ze elkaar niet overschrijven. Alleen de database-agent wijzigt het schema.
   - Laat daarna een **onafhankelijke controle-agent** de hele brief regel voor regel naast de code leggen en een lijst maken van wat ontbreekt of niet klopt (inclusief `APPLE_CHECKLIST.md`). Los alles op voor je "klaar" meldt.
   - Laat een **testagent** de belangrijkste flows doorlopen: aanmelden, vragenlijst, activeren, wachtlijst, RSVP, chat, account verwijderen, rollen (lid/curator/admin: kan de curator écht niet bij ledendata?). Typecheck moet slagen.
   - Houd tokens in de hand: werk in fases, geef agents korte, duidelijke opdrachten en laat ze alleen de relevante bestanden lezen.
   - Sluit elke sessie af met `BRIEF.md` bijwerken (wat klaar is, wat open staat).
5. Werk in fases en lever na elke fase iets dat draait. Begin met fase 1 (MVP). Vraag alleen iets als je echt vastzit. Houd antwoorden kort.

### 0b. Bestaande basic desk-app (referentie)
Onze huidige, basic webversie staat op https://verumsociety.vercel.app/#/home (saai en niet smooth, maar sommige onderdelen horen wel in de echte app). **Bekijk die eerst** (als je er niet bij kan: laat het me weten, ik plak screenshots of tekst). Haal de belangrijkste functies, schermen en teksten eruit, neem over wat werkt, en maak het strakker en soepeler. Overlap met deze brief: volg deze brief, tenzij de desk-app iets heeft dat hier ontbreekt.

### 0c. Bestaande accounts overzetten
Mensen hebben al een account in de huidige desk-app. Zet ze over naar de nieuwe app:
1. **Zoek uit waar de desk-app accounts opslaat** (Supabase, Firebase, eigen database of alleen in de browser). Alleen in de browser = niet over te zetten; dan melden mensen zich opnieuw aan.
2. Bij een echte database: exporteer naam, e-mail, aanvraagantwoorden en status. Importeer als `profiles` met behoud van status (`active`/`pending`), geef actieve leden een lidnummer. Wachtwoord-hashes alleen importeren als het formaat door Supabase Auth wordt ondersteund (bcrypt); anders stuur elk lid een e-mail "stel je wachtwoord in".
3. Laat bestaande aanvragers meetellen in de wachtlijst-teller.
4. **Privacy:** informeer bestaande gebruikers over de nieuwe app, laat ze het privacybeleid en de voorwaarden accepteren en vraag opnieuw uitdrukkelijke toestemming voor allergieën/dieet (Verum DNA). Neem geen gezondheidsgegevens zonder die toestemming mee.
5. Test de import eerst met een paar testaccounts voor je alle leden verhuist.

### 1. Ontwerp
- Mooi, strak en duidelijk. Donker, chic, rustig. Zwart/wijnrood/goud is de huidige richting (zie `mobile/src/theme.ts`).
- **Loginscherm**: strak en duidelijk. Logo, korte tekst, e-mail + wachtwoord, "Vraag toegang aan". Basis van Solace-login overnemen waar het beter is.
- **Thema wijzigen**: lid kiest een accentkleur uit een paar chique presets (goud, zilver, bordeaux, smaragd, saffier). Onthouden in profiel.
- **Profielfoto**: elk lid kan een foto toevoegen (Supabase Storage, bijsnijden rond).
- **Instellingen**: zoals bij Solace (profiel, thema, meldingen, privacy, uitloggen, account verwijderen).

### 1b. Taal (Nederlands en Engels)
- De app staat **standaard op de taal van het toestel**: Nederlands als het toestel Nederlands is, anders Engels. Het lid kan dit **zelf wisselen onder Instellingen** (Automatisch / Nederlands / English) en de keuze wordt onthouden.
- Alle teksten in de app staan in vertaalbestanden (bijv. `i18n/nl.ts` en `i18n/en.ts`), niets hardcoded in schermen. Gebruik `expo-localization` met `i18n-js` of `react-i18next`. Datums en tijden in de gekozen taal. Controleer hoe Solace dit doet en neem dat over.
- **Het Nederlands moet verzorgd, vlot en correct zijn.** Geen letterlijk vertaalde of stijve zinnen, geen lompe woorden. Schrijf zoals een goed hotel of restaurant: warm, rustig en beleefd, met "je" (niet "u"), korte zinnen. Laat de Engelse tekst even natuurlijk klinken. Dit geldt ook voor foutmeldingen en knoppen.

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

#### Welkom na acceptatie (eenmalig)
- Zodra een admin een lid activeert: **één keer** een korte pushmelding ("Welkom bij Verum") en bij de eerstvolgende opening **één keer** een kort welkomscherm met één knop ("Naar binnen").
- Eenmalig afdwingen met kolom `welcomed_at` in `profiles` (leeg = nog niet gezien). Geen herhaling bij opnieuw inloggen of op een ander toestel.
- Het welkomscherm is **kort en persoonlijk**: een welkom van de oprichters (Kluiver en Keurten) met één zin over respect. De uitgebreide huisregels staan in de **voorwaarden** (bij aanmelden accepteren, terug te lezen onder Instellingen). Leg vast dat het lid de voorwaarden heeft geaccepteerd, met tijdstip.
- Concepttekst (NL), pas gerust aan:

  > **Welkom bij Verum, {voornaam}.**
  > Fijn dat je erbij bent. Verum is wat we samen ervan maken, en dat begint bij respect voor elkaar.
  > Geniet ervan.
  >
  > Kluiver en Keurten

- Engelse versie:

  > **Welcome to Verum, {first name}.**
  > We are glad you are here. Verum is what we make of it together, and that starts with respect for one another.
  > Enjoy.
  >
  > Kluiver and Keurten

### 4. Wachtlijst en schaarste
- Admin stelt in: **totaal aantal ledenplekken** (bijv. 150) en eventueel per event capaciteit.
- Toon in de app (aanvraagscherm en home): "X van Y plekken bezet · Z mensen wachten". Dit moet exclusief voelen: niet iedereen kan erbij.
- Wachtlijst: aanvrager ziet zijn positie. Admin kan bij vrijgekomen plek de eerstvolgende of een zelfgekozen persoon toelaten. Bij een vol event kunnen leden ook op de event-wachtlijst.

### 5. Chat
- Chatrooms voor actieve leden (realtime, bestaat al): The Lounge, Aankomend, Trips.
- **The Side Quest** (extra room, alternatief: "Extra Muros"): voor kleine uitstapjes buiten de officiële events. Een lid plaatst een plan ("Zaterdag wijnbar in de Pijp, wie gaat mee?") met plek, tijd en max. aantal personen; anderen reageren "Ik ga mee". Zo neem je een paar leden mee. Zonder ingewikkeld: een bericht met een "Ik ga mee"-knop en teller is genoeg. Ondertitel: "Ergens heen? Neem een paar leden mee."
- **Private room**: besloten ruimte waar leden met elkaar kunnen chatten. Leden kunnen zelf een privéroom of groepschat maken en alleen uitgenodigde leden zien die. Ook 1-op-1 berichten tussen leden.
- Behoud melden van berichten en voeg blokkeren van leden toe (App Store-eis).

### 6. Rollen en beheer
Drie rollen in `profiles.role`: `member`, `curator`, `admin`. Rechten worden **in de database afgedwongen (RLS)**, niet alleen verborgen in de app.

- **Admin (Kluiver en Keurten, de oprichters)**: alles. Leden activeren/weigeren/wachtlijst/pauzeren, vragenlijst-antwoorden lezen, ledenplekken instellen, meldingen (reports) afhandelen, rollen toewijzen, instellingen, én alles wat de curator kan.
- **Curator (de event curator, bijv. onze eventdame)**: mag **alleen events** beheren: events aanmaken, bewerken, verwijderen (met banner, link, capaciteit, prijs), **versturen/publiceren** (inclusief de pushmelding naar leden) en zien wie komt (RSVP-lijst). Zij heeft **geen toegang** tot ledenaanvragen, vragenlijst-antwoorden, wachtlijst, plekken, meldingen, rollen of instellingen. In de app ziet zij alleen een tab "Events beheren", niet het volledige beheerpaneel.
- **Lid**: gewoon gebruiker.

Details:
- Events krijgen een status `concept` / `gepubliceerd`. De curator kan eerst een concept maken en daarna publiceren; leden zien alleen gepubliceerde events. Bij publiceren gaat de pushmelding uit.
- Voor events ziet de curator de naam en RSVP-status van aanwezigen en, alleen voor aanwezigen en alleen voor het organiseren (reservering, menu), hun allergieën en dieet uit het Verum DNA. Geen andere profielgegevens.
- Admin wijst rollen toe in het beheerpaneel. Gebruik `public.is_admin()` en `public.is_curator()` (admin telt ook als curator) in de RLS-policies.

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

### 7b. Verum DNA (smaakprofiel, slim rekening houden met leden)
Elk lid heeft een persoonlijk **DNA-profiel**: wie ben je en wat vind je lekker. Eén keer invullen (in de aanvraag of daarna), altijd aan te passen onder Profiel. Zo kunnen wij bij reserveren en organiseren **snel en zonder rondvragen** rekening houden met iedereen, en voelt het persoonlijk.

- **Veldjes (gestructureerd, met keuzes, geen vrije chaos):**
  - **Allergieën en intoleranties** (noten, gluten, lactose, schaaldieren, ei, vis, soja, sesam, anders) + ernst (voorkeur / echt allergisch).
  - **Dieet** (vegetarisch, veganistisch, halal, geen alcohol, geen varken, anders).
  - **Eten en drinken:** favoriete keukens, wat je niet lust, wijn (rood/wit/bubbels), cocktails, geen alcohol.
  - **Sfeer en interesses:** muziek, soort avonden (feest, diner, kunst, sport), reizen.
  - **Praktisch:** plus-one ja/nee, vervoer (zelf rijden), bijzonderheden.
- **DNA-kaart:** een mooi, strak overzicht in Profiel ("jouw Verum DNA"), met iconen. Voor jezelf, leden zien alleen wat je zelf deelt.
- **Privacy, belangrijk:** allergieën en dieet kunnen gezondheidsinformatie zijn. Vraag **uitdrukkelijke toestemming** met een aparte schakelaar, uit te zetten wanneer je wilt. Andere leden zien dit **nooit**. Alleen het team ziet het, en alleen voor events waarvoor een lid zich heeft aangemeld (zie hieronder). Verwijderen van account wist ook het DNA.
- **Slim bij events (voor admin en curator):**
  - Per event een **Gastenoverzicht**: aantal gasten ("Ik ben erbij") en een samenvatting van allergieën en diëten (bijv. "2x notenallergie (echt allergisch), 3x vegetarisch, 1x geen alcohol"), met namen erbij.
  - Knop **"Kopieer voor het restaurant"**: een nette tekst met aantal personen en alle bijzonderheden, om te mailen of appen.
  - Een **waarschuwing** bij het samenstellen van een menu of bij het bevestigen van een event als er een ernstige allergie bij de aanwezigen zit.
  - Past op het moment van RSVP: wijzigt iemand van "Misschien" naar "Ik ben erbij", dan telt zijn DNA direct mee.
- **Slim voor leden:** op basis van het DNA suggesties ("Past bij jou") bij events en een korte melding als er een event aankomt dat bij hun smaak past. Houd het simpel, geen ingewikkelde algoritmes: een eenvoudige match op interesses is genoeg.
- Bouw in `profiles` of een aparte tabel `member_dna` met strikte RLS: lid ziet en wijzigt alleen zijn eigen rij; admin en curator mogen alleen DNA lezen van leden met een RSVP "going" voor een event. Opslaan van de toestemming (`dna_consent_at`).

### 8. Techniek en eisen
- Expo/React Native + TypeScript, Supabase (auth, Postgres met RLS, Realtime, Storage). **Eigen Supabase-project voor Verum**, nooit dat van Solace.
- App Store: account verwijderen in de app, berichten melden/blokkeren, privacybeleid-URL, demo-account voor Apple-review, geen verwijzing naar niet-Apple betaalmethodes voor digitale goederen. Fysieke events/tickets via externe link zijn toegestaan.
- Bouw en test: TypeScript moet slagen; test de flow in de browser/simulator. Zet bouwen via EAS klaar voor TestFlight (zie `mobile/README.md`).
- Raak niets van Solace aan.

### 8b. Privacy en Apple-goedkeuring (eerste keer goed)
- Lees `APPLE_CHECKLIST.md` en `legal/privacy.nl.md` / `legal/privacy.en.md` (conceptbeleid, vul de [haakjes] in). De webversie toont het beleid publiek op `/privacy`; deploy dat en gebruik die URL als Privacybeleid-URL in App Store Connect. Neem in de app links naar privacybeleid en voorwaarden op bij het aanmaken van een account en onder Instellingen.
- **Account verwijderen** moet echt **alles** wissen: account, profiel, profielfoto's in Storage, aanvraag, RSVP's, berichten, meldingen. Gebruik `delete_my_account()` in het schema en ruim ook Storage-bestanden op (bijvoorbeeld via een database-trigger of Edge Function). Test dit end-to-end met een echt testaccount.
- Dieet/allergie is gezondheidsinformatie: vraag uitdrukkelijke toestemming of laat het veld weg.
- **Controleer eerst wat de Solace-app hiervan al heeft** (verwijderen, melden, privacy-links, review-notities) en neem dat over, verbeter waar nodig, in plaats van opnieuw te bouwen.
- Lidmaatschap/digitale goederen niet in de app verkopen zonder In-App Purchase. Fysieke events via externe link mag.

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
