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
      'network.countries': 'Amsterdam · Parijs · Londen · Madrid · Barcelona',
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
      'form.error.submit': 'Er ging iets mis bij het versturen. Probeer het opnieuw, of mail ons direct op hello@solaceexecutive.example.',
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
      'whatsapp.email': 'Of mail naar <a href="mailto:hello@solaceexecutive.example">hello@solaceexecutive.example</a>',
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
      'network.countries': 'Amsterdam · Paris · London · Madrid · Barcelona',
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
      'form.error.submit': 'Something went wrong while sending. Please try again, or email us directly at hello@solaceexecutive.example.',
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
      'whatsapp.email': 'Or email <a href="mailto:hello@solaceexecutive.example">hello@solaceexecutive.example</a>',
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
