(() => {
  'use strict';

  const STORAGE_KEY = 'solace-lang';
  const SUPPORTED = ['nl', 'en'];

  const dict = {
    nl: {
      'meta.title': 'Solace Executive | Executive Concierge',
      'meta.description': 'Solace Executive: besloten conciergedienst voor privévervoer, private jets, jachten en luxegoederen.',
      'a11y.skip': 'Ga naar hoofdinhoud',
      'nav.services': 'Diensten',
      'nav.network': 'Netwerk',
      'nav.philosophy': 'Filosofie',
      'nav.intake': 'Lidmaatschap',
      'nav.contact': 'Contact',
      'nav.cta': 'Aan de Slag',
      'nav.login': 'Leden',
      'hero.eyebrow': 'PRIVÉ CONCIERGE · OP UITNODIGING',
      'hero.title.line1': 'Uw tijd.',
      'hero.title.line2': 'Onze <em>zorg</em>.',
      'hero.sub': 'Eén aanspreekpunt voor vervoer, vluchten, jachten en persoonlijke aanschaffingen. Wereldwijd inzetbaar. Zonder ruis.',
      'cta.intake': 'Aan de Slag',
      'cta.discover': 'Ontdek de Diensten',
      'service.transport': 'Executive Transport',
      'service.jets': 'Private Jets',
      'service.yachts': 'Jachten',
      'services.eyebrow': 'ONZE DIENSTEN',
      'services.title': 'Drie domeinen. Eén aanspreekpunt.',
      'service.transport.desc': 'Discrete, representatieve voertuigen. Wereldwijd inzetbaar en voorgereden op de minuut.',
      'service.jets.desc': 'Charter op korte termijn. Wereldwijde toegang tot vlootpartners, cabine ingericht naar wens.',
      'service.yachts.desc': 'Van dagcharter tot seizoenshuur. Bemanning, route en catering vooraf op elkaar afgestemd.',
      'services.cta.title': 'Nog geen lid?',
      'services.cta.desc': 'Lidmaatschap is op uitnodiging of persoonlijke aanbeveling.',
      'jet.eyebrow': 'PRIVATE JETS',
      'jet.title': 'Vertrek wanneer u wilt, wereldwijd geregeld.',
      'jet.desc': 'Onze vlootpartners staan klaar in meer dan 180 steden. Eén telefoontje volstaat.',
      'philosophy.quote': 'Wij meten onszelf niet af aan wat we leveren, maar aan wat u <em>nooit heeft hoeven vragen.</em>',
      'philosophy.attr': 'Het Solace Executive Handvest',
      'philosophy.eyebrow': 'OVER ONS',
      'philosophy.p1': 'Solace Executive is een persoonlijke concierge-, travel- en event managementdienst voor drukke professionals, ondernemers en particulieren die weinig tijd hebben om reizen, evenementen en persoonlijke zaken zelf te regelen.',
      'philosophy.p2': 'Solace Executive neemt dit regelwerk volledig uit handen: van complete reizen en weekendtrips tot verjaardagen, zakelijke bijeenkomsten en losse persoonlijke verzoeken.',
      'stat.response': 'uur, wereldwijde respons',
      'stat.cities': 'steden met direct netwerk',
      'network.label': 'ACTIEF IN',
      'network.countries': 'Amsterdam · Londen · Parijs · Milaan · Genève · Madrid · Dubai · New York · Singapore · Sydney',
      'ticker.cities': '180+ STEDEN',
      'ticker.response': '24U RESPONS',
      'intake.eyebrow': 'LIDMAATSCHAP · OP AANVRAAG',
      'intake.title': 'Vertel ons over uzelf.',
      'intake.sub': 'Wij beoordelen elke aanvraag persoonlijk. Vertel ons wie u bent en wat u nodig heeft. Bij een match nemen wij per e-mail contact op.',
      'form.name': 'Wat is uw naam?',
      'form.company.label': 'Voor welk bedrijf werkt u? <span class="optional">(optioneel)</span>',
      'form.email': 'Wat is uw e-mailadres?',
      'form.phone': 'Wat is uw telefoonnummer?',
      'form.services.legend': 'Welke diensten hebben uw interesse?',
      'form.frequency': 'Hoe vaak verwacht u gebruik te maken van Solace Executive?',
      'form.freq.occasional': 'Incidenteel',
      'form.freq.monthly': 'Maandelijks',
      'form.freq.weekly': 'Wekelijks',
      'form.freq.daily': 'Dagelijks',
      'form.region.label': 'Wat is uw standplaats of regio? <span class="optional">(optioneel)</span>',
      'form.message.label': 'Nog iets dat wij moeten weten? <span class="optional">(optioneel)</span>',
      'form.hint.enter': 'druk op Enter ↵',
      'form.review.title': 'Klaar om te versturen?',
      'form.review.note': 'Wij beoordelen uw aanvraag persoonlijk en nemen bij een match per e-mail contact op.',
      'form.submit': 'Aan de Slag',
      'form.submitting': 'Versturen…',
      'form.success': 'Bedankt. Wij beoordelen uw aanvraag persoonlijk. Bij een match ontvangt u binnen enkele dagen bericht van ons per e-mail.',
      'form.error.submit': 'Er ging iets mis bij het versturen. Probeer het opnieuw, of mail ons direct op hello@solaceexecutive.com.',
      'form.error.name': 'Vul uw volledige naam in.',
      'form.error.email': 'Vul een geldig e-mailadres in.',
      'form.error.phone': 'Vul een geldig telefoonnummer in.',
      'form.error.services': 'Kies minimaal één dienst.',
      'footer.copyright': 'Solace Executive. Lidmaatschap op aanvraag.',
      'whatsapp.eyebrow': 'CONTACT',
      'whatsapp.title': 'Chat met ons team.',
      'whatsapp.sub': 'Stuur ons een bericht via WhatsApp voor persoonlijk en snel contact.',
      'whatsapp.prospect.title': 'Nieuwe aanvraag',
      'whatsapp.prospect.lead': 'Nog geen lid?',
      'whatsapp.prospect.body': 'Stuur ons een bericht via WhatsApp — wij beantwoorden uw vragen en bespreken de mogelijkheden.',
      'whatsapp.prospect.cta': 'Chat via WhatsApp',
      'whatsapp.member.title': 'Voor leden',
      'whatsapp.member.lead': 'Al lid?',
      'whatsapp.member.body': 'Ons concierge-team staat voor u klaar via WhatsApp, voor elk verzoek.',
      'whatsapp.member.cta': 'Chat met concierge',
      'whatsapp.email': 'Of mail naar <a href="mailto:hello@solaceexecutive.com">hello@solaceexecutive.com</a>',

      'login.meta.title': 'Inloggen | Solace Executive',
      'login.title': 'Ledenportaal',
      'login.sub': 'Log in met de gegevens die u van ons heeft ontvangen.',
      'login.email': 'E-mail',
      'login.email.placeholder': 'naam@voorbeeld.nl',
      'login.password': 'Wachtwoord',
      'login.submit': 'Inloggen',
      'login.submitting': 'Bezig met inloggen…',
      'login.error': 'Inloggen mislukt. Controleer uw e-mail en wachtwoord.',
      'login.back': 'Wachtwoord vergeten of nog geen lid? <a href="index.html#lidmaatschap">Neem contact op</a>',

      'dash.meta.title': 'Dashboard | Solace Executive',
      'dash.nav.dashboard': 'Dashboard',
      'dash.nav.requests': 'Aanvragen',
      'dash.nav.concierge': 'Concierge',
      'dash.nav.account': 'Account',
      'dash.logout': 'Uitloggen',
      'dash.eyebrow': 'LEDENOMGEVING',
      'dash.welcome': 'Welkom terug.',
      'dash.welcome.name': 'Welkom terug, {name}.',
      'dash.stat.review': 'Lopende aanvragen',
      'dash.stat.confirmed': 'Bevestigd',
      'dash.stat.response': 'Gemiddelde responstijd',
      'dash.stat.response.value': '< 24u',
      'dash.recent.title': 'Recente aanvragen',
      'dash.recent.viewall': 'Bekijk alles &rarr;',
      'dash.requests.eyebrow': 'AANVRAGEN',
      'dash.requests.title': 'Al uw aanvragen.',
      'dash.filter.all': 'Alles',
      'dash.filter.review': 'In behandeling',
      'dash.filter.confirmed': 'Bevestigd',
      'dash.filter.done': 'Afgerond',
      'dash.status.review': 'In beoordeling',
      'dash.status.confirmed': 'Bevestigd',
      'dash.status.done': 'Afgerond',
      'dash.empty.filtered': 'Geen aanvragen in deze categorie.',
      'dash.empty.none': 'Nog geen aanvragen. Gebruik de intake op de website om er een in te dienen.',
      'dash.error.load': 'Aanvragen konden niet worden geladen.',
      'dash.time.today': 'vandaag',
      'dash.time.oneDay': '1 dag geleden',
      'dash.time.days': '{n} dagen geleden',
      'dash.time.oneWeek': '1 week geleden',
      'dash.time.weeks': '{n} weken geleden',
      'dash.submitted': 'Ingediend {time}',
      'dash.concierge.eyebrow': 'CONCIERGE',
      'dash.concierge.title': 'Chat met uw concierge.',
      'dash.concierge.panel': 'AI Concierge',
      'dash.concierge.msg1': 'Goedemiddag. Waarmee kan ik u vandaag helpen?',
      'dash.concierge.placeholder': 'Typ een bericht…',
      'dash.concierge.send': 'Stuur',
      'dash.account.eyebrow': 'ACCOUNT',
      'dash.account.title': 'Uw gegevens.',
      'dash.account.email': 'E-mail',
      'dash.account.name': 'Naam',
      'dash.account.company': 'Bedrijf',
      'dash.account.save': 'Opslaan',
      'dash.account.saved': 'Opgeslagen.',
    },
    en: {
      'meta.title': 'Solace Executive | Executive Concierge',
      'meta.description': 'Solace Executive: a private concierge service for executive transport, private jets, yachts and curated luxury goods.',
      'a11y.skip': 'Skip to main content',
      'nav.services': 'Services',
      'nav.network': 'Network',
      'nav.philosophy': 'Philosophy',
      'nav.intake': 'Membership',
      'nav.contact': 'Contact',
      'nav.cta': 'Get Started',
      'nav.login': 'Members',
      'hero.eyebrow': 'PRIVATE CONCIERGE · BY INVITATION',
      'hero.title.line1': 'Your time.',
      'hero.title.line2': 'Our <em>care</em>.',
      'hero.sub': 'One point of contact for transport, flights, yachts and personal acquisitions. Available worldwide. Without the noise.',
      'cta.intake': 'Get Started',
      'cta.discover': 'Explore the Services',
      'service.transport': 'Executive Transport',
      'service.jets': 'Private Jets',
      'service.yachts': 'Yachts',
      'services.eyebrow': 'OUR SERVICES',
      'services.title': 'Three domains. One point of contact.',
      'service.transport.desc': 'Discreet, representative vehicles. Deployed worldwide and on the doorstep to the minute.',
      'service.jets.desc': 'Charter at short notice. Worldwide access to fleet partners, cabin arranged to your preference.',
      'service.yachts.desc': 'From day charter to full-season hire. Crew, route and catering aligned in advance.',
      'services.cta.title': 'Not a member yet?',
      'services.cta.desc': 'Membership is by invitation or personal referral.',
      'jet.eyebrow': 'PRIVATE JETS',
      'jet.title': 'Depart when you wish, arranged worldwide.',
      'jet.desc': 'Our fleet partners stand ready in more than 180 cities. One call is all it takes.',
      'philosophy.quote': 'We do not measure ourselves by what we deliver, but by what you <em>never had to ask.</em>',
      'philosophy.attr': 'The Solace Executive Charter',
      'philosophy.eyebrow': 'ABOUT US',
      'philosophy.p1': 'Solace Executive is a personal concierge, travel and event management service for busy professionals, entrepreneurs and individuals who have little time to arrange travel, events and personal matters themselves.',
      'philosophy.p2': 'Solace Executive takes this off your hands entirely: from complete trips and weekend getaways to birthdays, business gatherings and one-off personal requests.',
      'stat.response': 'hour worldwide response',
      'stat.cities': 'cities with direct network',
      'network.label': 'ACTIVE IN',
      'network.countries': 'Amsterdam · London · Paris · Milan · Geneva · Madrid · Dubai · New York · Singapore · Sydney',
      'ticker.cities': '180+ CITIES',
      'ticker.response': '24H RESPONSE',
      'intake.eyebrow': 'MEMBERSHIP · BY APPLICATION',
      'intake.title': 'Tell us about yourself.',
      'intake.sub': 'We review every application personally. Tell us who you are and what you need. If it is a match, we will follow up by email.',
      'form.name': 'What is your name?',
      'form.company.label': 'Which company do you work for? <span class="optional">(optional)</span>',
      'form.email': 'What is your email address?',
      'form.phone': 'What is your phone number?',
      'form.services.legend': 'Which services interest you?',
      'form.frequency': 'How often do you expect to use Solace Executive?',
      'form.freq.occasional': 'Occasional',
      'form.freq.monthly': 'Monthly',
      'form.freq.weekly': 'Weekly',
      'form.freq.daily': 'Daily',
      'form.region.label': 'What is your base or region? <span class="optional">(optional)</span>',
      'form.message.label': 'Anything else we should know? <span class="optional">(optional)</span>',
      'form.hint.enter': 'press Enter ↵',
      'form.review.title': 'Ready to send?',
      'form.review.note': 'We review every application personally and follow up by email if it is a match.',
      'form.submit': 'Get Started',
      'form.submitting': 'Sending…',
      'form.success': 'Thank you. We review every application personally. If it is a match, you will hear from us by email within a few days.',
      'form.error.submit': 'Something went wrong while sending. Please try again, or email us directly at hello@solaceexecutive.com.',
      'form.error.name': 'Please enter your full name.',
      'form.error.email': 'Please enter a valid email address.',
      'form.error.phone': 'Please enter a valid phone number.',
      'form.error.services': 'Select at least one service.',
      'footer.copyright': 'Solace Executive. Membership by application.',
      'whatsapp.eyebrow': 'CONTACT',
      'whatsapp.title': 'Chat with our team.',
      'whatsapp.sub': 'Message us on WhatsApp for quick, personal contact.',
      'whatsapp.prospect.title': 'New inquiry',
      'whatsapp.prospect.lead': 'Not a member yet?',
      'whatsapp.prospect.body': 'Message us on WhatsApp — we’ll answer your questions and discuss the possibilities.',
      'whatsapp.prospect.cta': 'Chat on WhatsApp',
      'whatsapp.member.title': 'For members',
      'whatsapp.member.lead': 'Already a member?',
      'whatsapp.member.body': 'Our concierge team is on hand via WhatsApp for any request.',
      'whatsapp.member.cta': 'Chat with concierge',
      'whatsapp.email': 'Or email <a href="mailto:hello@solaceexecutive.com">hello@solaceexecutive.com</a>',

      'login.meta.title': 'Log in | Solace Executive',
      'login.title': 'Member portal',
      'login.sub': 'Log in with the details we sent you.',
      'login.email': 'Email',
      'login.email.placeholder': 'name@example.com',
      'login.password': 'Password',
      'login.submit': 'Log in',
      'login.submitting': 'Signing in…',
      'login.error': 'Login failed. Check your email and password.',
      'login.back': 'Forgot your password or not a member yet? <a href="index.html#lidmaatschap">Get in touch</a>',

      'dash.meta.title': 'Dashboard | Solace Executive',
      'dash.nav.dashboard': 'Dashboard',
      'dash.nav.requests': 'Requests',
      'dash.nav.concierge': 'Concierge',
      'dash.nav.account': 'Account',
      'dash.logout': 'Log out',
      'dash.eyebrow': 'MEMBER AREA',
      'dash.welcome': 'Welcome back.',
      'dash.welcome.name': 'Welcome back, {name}.',
      'dash.stat.review': 'Open requests',
      'dash.stat.confirmed': 'Confirmed',
      'dash.stat.response': 'Average response time',
      'dash.stat.response.value': '< 24h',
      'dash.recent.title': 'Recent requests',
      'dash.recent.viewall': 'View all &rarr;',
      'dash.requests.eyebrow': 'REQUESTS',
      'dash.requests.title': 'All your requests.',
      'dash.filter.all': 'All',
      'dash.filter.review': 'In review',
      'dash.filter.confirmed': 'Confirmed',
      'dash.filter.done': 'Completed',
      'dash.status.review': 'In review',
      'dash.status.confirmed': 'Confirmed',
      'dash.status.done': 'Completed',
      'dash.empty.filtered': 'No requests in this category.',
      'dash.empty.none': 'No requests yet. Use the intake on the website to submit one.',
      'dash.error.load': 'Requests could not be loaded.',
      'dash.time.today': 'today',
      'dash.time.oneDay': '1 day ago',
      'dash.time.days': '{n} days ago',
      'dash.time.oneWeek': '1 week ago',
      'dash.time.weeks': '{n} weeks ago',
      'dash.submitted': 'Submitted {time}',
      'dash.concierge.eyebrow': 'CONCIERGE',
      'dash.concierge.title': 'Chat with your concierge.',
      'dash.concierge.panel': 'AI concierge',
      'dash.concierge.msg1': 'Good afternoon. How can I help you today?',
      'dash.concierge.placeholder': 'Type a message…',
      'dash.concierge.send': 'Send',
      'dash.account.eyebrow': 'ACCOUNT',
      'dash.account.title': 'Your details.',
      'dash.account.email': 'Email',
      'dash.account.name': 'Name',
      'dash.account.company': 'Company',
      'dash.account.save': 'Save',
      'dash.account.saved': 'Saved.',
    },
  };

  function detectLang() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.includes(stored)) return stored;
    } catch (err) {
      /* localStorage unavailable (private mode etc.) — fall through */
    }
    const browserLangs = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || 'en'];
    const hasDutch = browserLangs.some((l) => l.toLowerCase().startsWith('nl'));
    return hasDutch ? 'nl' : 'en';
  }

  let currentLang = detectLang();

  function apply(lang) {
    const table = dict[lang] || dict.en;

    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const value = table[key];
      if (value === undefined) return;
      if (el.hasAttribute('data-i18n-attr')) {
        el.setAttribute(el.getAttribute('data-i18n-attr'), value);
      } else {
        el.textContent = value;
      }
    });

    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      const value = table[key];
      if (value !== undefined) el.innerHTML = value;
    });

    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.lang === lang);
      btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
    });

    // Transient validation messages aren't tagged with data-i18n (they're
    // set at submit-time by script.js) — clear any currently shown ones so
    // a language switch never leaves stale-language error text behind.
    document.querySelectorAll('.field-error').forEach((el) => {
      el.textContent = '';
    });
    document.querySelectorAll('.field.has-error').forEach((el) => {
      el.classList.remove('has-error');
    });
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang) || lang === currentLang) return;
    currentLang = lang;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (err) {
      /* ignore persistence failure */
    }
    apply(currentLang);
  }

  function t(key) {
    return (dict[currentLang] && dict[currentLang][key]) || dict.en[key] || key;
  }

  apply(currentLang);

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });
    apply(currentLang);
  });

  window.SolaceI18n = {
    t,
    setLang,
    get lang() {
      return currentLang;
    },
  };
})();
