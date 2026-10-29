# Verum Society: overdracht naar een eigen project

Alles staat op branch `claude/verum-society-app` van `kluivervs-beep/solace-executive-website-`, in de map `verum-society/`. Er is niets van Solace gewijzigd.

## Inhoud
- `/` (Next.js web-versie, `src/`): handig als beheer-/webversie.
- `/mobile`: **de iOS-app** (Expo / React Native). Dit is de basis voor de App Store.
- `/supabase/schema.sql`: database, rechten (RLS), account verwijderen, meldingen. Gedeeld door web en app.

## Overzetten naar een nieuwe repo (thuis)
```bash
git clone https://github.com/kluivervs-beep/solace-executive-website-.git tmp && cd tmp
git checkout claude/verum-society-app
cp -r verum-society ../verum-society && cd .. && rm -rf tmp
cd verum-society && git init && git add . && git commit -m "Initial import"
# maak een lege repo (bv. verum-society) op GitHub, dan:
git remote add origin <url> && git push -u origin main
```

## Daarna
1. Eigen Supabase-project voor Verum, voer `supabase/schema.sql` uit.
2. Geef Claude de Solace-**app**-repo, dan volgen we dezelfde build-/TestFlight-opzet (zie `mobile/README.md`).
3. Open punten: blokkeren van leden, meldingen lezen in beheer, pushmeldingen, privacybeleid-URL, demo-account voor Apple-review.
