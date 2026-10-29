# Apple App Store-checklist voor Verum Society

Doel: de eerste keer goedgekeurd. Vink af voor je indient. (Controleer bij Solace wat al klaarstaat en neem dat over.)

## In de app
- [ ] **Account verwijderen in de app** (Profiel, Account verwijderen), met bevestiging, verwijdert echt alles: account, profiel, foto's in Storage, aanmelding, RSVP's, berichten. Bij Supabase: `delete_my_account()` + ook bestanden in Storage opruimen (nog toevoegen zodra profielfoto's bestaan).
- [ ] **Berichten melden** en **leden blokkeren** (verplicht bij chat/user-generated content), met een kanaal om meldingen af te handelen binnen 24 uur.
- [ ] **Voorwaarden/huisregels accepteren** bij aanmelden; link naar privacybeleid en voorwaarden bij het aanmaken van een account en onder Instellingen.
- [ ] **Toestemming voor dieet/allergie** (gezondheidsinformatie) apart en uitdrukkelijk, of het veld weglaten.
- [ ] **Pushmeldingen**: vraag toestemming op een logisch moment, niet meteen bij het openen; app werkt ook zonder.
- [ ] **Inloggen**: als je inlogt met Google/Facebook moet ook "Inloggen met Apple" er zijn. Alleen e-mail + wachtwoord vermijdt dit.
- [ ] Geen verborgen of ongedocumenteerde functies; geen verwijzing naar andere platforms of beta-versies.
- [ ] App is volledig werkend (geen placeholders), alle knoppen doen iets. Crasht niet bij leeg of offline.

## App Store Connect
- [ ] **Privacybeleid-URL** (publiek bereikbaar): de pagina `/privacy` van de webversie, of een eigen site.
- [ ] **Support-URL** en contact-e-mail.
- [ ] **App Privacy ("voedingslabel")**: geef eerlijk aan wat je verzamelt: naam, e-mail, gebruikersinhoud (berichten, foto), gezondheid (dieet, optioneel), identifiers (push-token). "Gebruikt voor tracking": nee. Gekoppeld aan identiteit: ja.
- [ ] **Leeftijdsclassificatie**: chat met gebruikers en alcohol (wijnproeverijen) betekent 17+ of hoger. Vul eerlijk in.
- [ ] **Review-account**: actief demo-lid (en indien nodig een admin) met inloggegevens in de reviewnotities, plus een korte uitleg dat de app alleen op aanvraag toegankelijk is.
- [ ] Screenshots (6,9" en 6,5"), beschrijving, trefwoorden, categorie (Lifestyle of Social Networking).
- [ ] **Exportcompliance**: `ITSAppUsesNonExemptEncryption = false` staat al in `app.json`.

## Betalingen (let op)
- Digitale goederen binnen de app (bijv. abonnement, lidmaatschap) moeten via Apple In-App Purchase. **Fysieke events/tickets via een externe link zijn toegestaan.** Verkoop dus geen lidmaatschap in de app zonder IAP. Houd lidmaatschap buiten de app of regel het via IAP.

## Privacybeleid
Concept in `legal/privacy.nl.md` en `legal/privacy.en.md`. Vul de [haakjes] in (bedrijfsnaam, KvK, adres, e-mail) en laat het voor livegang door iemand die ervan weet controleren (dit is geen juridisch advies).
