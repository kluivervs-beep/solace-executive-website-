(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------------------------------------------------------------------
     Header: solid background after scroll
  --------------------------------------------------------------------- */
  const header = document.getElementById('siteHeader');
  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------------------------------------------------------------
     Mobile nav toggle
  --------------------------------------------------------------------- */
  const navToggle = document.getElementById('navToggle');
  const mobileNav = document.getElementById('mobileNav');
  navToggle.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'Menu sluiten' : 'Menu openen');
  });
  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* ---------------------------------------------------------------------
     Intake modal: every "Aan de Slag" / #lidmaatschap link opens the
     intake form as an overlay instead of scrolling down the page.
  --------------------------------------------------------------------- */
  const intakeModal = document.getElementById('intakeModal');

  let intakeTrigger = null;

  function openIntakeModal() {
    if (!intakeModal) return;
    if (!intakeModal.classList.contains('is-open')) intakeTrigger = document.activeElement;
    intakeModal.classList.add('is-open');
    intakeModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    // Deferred with setTimeout so this runs after the browser's own
    // post-click focus handling on the trigger link, which would
    // otherwise steal focus back from the field right after this.
    setTimeout(() => {
      const firstField = intakeModal.querySelector('input:not([type="hidden"]), select, textarea');
      firstField?.focus({ preventScroll: true });
    }, 0);
  }

  function closeIntakeModal() {
    if (!intakeModal) return;
    intakeModal.classList.remove('is-open');
    intakeModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    // After a finished application the next opening starts a fresh form.
    resetIntakeAfterDone();
    if (intakeTrigger && document.contains(intakeTrigger)) intakeTrigger.focus({ preventScroll: true });
    intakeTrigger = null;
  }

  document.querySelectorAll('a[href="#lidmaatschap"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openIntakeModal();
    });
  });

  intakeModal?.querySelectorAll('[data-modal-close]').forEach((el) => {
    el.addEventListener('click', closeIntakeModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && intakeModal?.classList.contains('is-open')) closeIntakeModal();

    // Keep Tab inside the open intake dialog.
    if (e.key === 'Tab' && intakeModal?.classList.contains('is-open')) {
      const nodes = Array.from(intakeModal.querySelectorAll('a[href], button, input, textarea, select'))
        .filter((el) => !el.disabled && !el.hidden && el.type !== 'hidden'
          && !el.closest('[inert], [hidden]') && el.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!intakeModal.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  if (window.location.hash === '#lidmaatschap') {
    openIntakeModal();
  }

  /* The intro overlay is handled by the inline script in index.html and the
     .transition-overlay rules in styles.css (CSS only, no GSAP). */

  /* ---------------------------------------------------------------------
     GSAP setup
  --------------------------------------------------------------------- */
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    if (!reducedMotion) {
      // Hero title: line-level stagger (keeps nested <em> emphasis intact,
      // unlike a textContent-based word split which would flatten it away)
      gsap.set('.hero-title .line', { yPercent: 110, opacity: 0 });
      gsap
        .timeline({ delay: 0.5 })
        .to('.hero-title .line', {
          yPercent: 0,
          opacity: 1,
          duration: 0.9,
          ease: 'expo.out',
          stagger: 0.1,
        })
        .from(
          '.hero .eyebrow',
          { opacity: 0, y: 10, duration: 0.5, ease: 'power1.out' },
          '<-0.3'
        )
        .from(
          '.hero-sub, .hero-actions, .hero-ticker',
          { opacity: 0, y: 16, duration: 0.6, ease: 'power1.out', stagger: 0.12 },
          '-=0.4'
        );

      // Slow ambient rotation of the hero ring
      const ringSpin = gsap.to('.hero-ring', {
        rotate: 360,
        duration: 120,
        repeat: -1,
        ease: 'none',
      });
      // The endless spin only runs while the hero is on screen.
      ScrollTrigger.create({
        trigger: '.hero',
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => (self.isActive ? ringSpin.resume() : ringSpin.pause()),
      });

      // Subtle hero parallax on scroll
      gsap.to('.hero-ring', {
        yPercent: 15,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5 },
      });
      gsap.to('.hero-glow', {
        yPercent: 25,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5 },
      });

      // Generic scroll reveals
      // The hero has its own intro timeline; with the globe layout its text can sit
      // below the 88% line, which left it hidden until the first scroll.
      gsap.utils.toArray('.reveal').filter((el) => !el.closest('.hero')).forEach((el, i) => {
        gsap.from(el, {
          opacity: 0,
          y: 20,
          duration: 0.55,
          ease: 'power1.out',
          delay: (i % 6) * 0.04,
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            toggleActions: 'play none none reverse',
          },
        });
      });

      // Count-up stats
      document.querySelectorAll('.stat-number').forEach((el) => {
        const target = parseInt(el.dataset.count, 10);
        const counter = { val: 0 };
        ScrollTrigger.create({
          trigger: el,
          start: 'top 90%',
          once: true,
          onEnter: () => {
            gsap.to(counter, {
              val: target,
              duration: 1.4,
              ease: 'power1.out',
              onUpdate: () => {
                el.textContent = Math.round(counter.val);
              },
            });
          },
        });
      });
    } else {
      // Reduced motion: ensure final state is applied immediately
      document.querySelectorAll('.stat-number').forEach((el) => {
        el.textContent = el.dataset.count;
      });
    }
  }

  /* ---------------------------------------------------------------------
     Magnetic hover on primary buttons (desktop only, subtle)
  --------------------------------------------------------------------- */
  if (!reducedMotion && window.matchMedia('(hover: hover)').matches && window.gsap) {
    document.querySelectorAll('.btn-primary, .btn-outline').forEach((btn) => {
      let bounds;
      btn.addEventListener('pointerenter', () => {
        bounds = btn.getBoundingClientRect();
      });
      btn.addEventListener('pointermove', (e) => {
        if (!bounds) return;
        const relX = e.clientX - bounds.left - bounds.width / 2;
        const relY = e.clientY - bounds.top - bounds.height / 2;
        gsap.to(btn, {
          x: relX * 0.18,
          y: relY * 0.35,
          duration: 0.3,
          ease: 'power2.out',
        });
      });
      btn.addEventListener('pointerleave', () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }

  /* ---------------------------------------------------------------------
     Intake form: client-side validation + Formspree submission
  --------------------------------------------------------------------- */
  const form = document.getElementById('intakeForm');
  const successMsg = document.getElementById('formSuccess');
  const formErrorMsg = document.getElementById('formError');

  const referralField = document.getElementById('referralSourceField');
  if (referralField) {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
      referralField.value = ref;
      try { sessionStorage.setItem('solace_referral_source', ref); } catch (e) {}
    } else {
      try {
        const stored = sessionStorage.getItem('solace_referral_source');
        if (stored) referralField.value = stored;
      } catch (e) {}
    }
  }

  /* Real-looking details only: this keeps out spam, typos and throw-away addresses. */
  const DISPOSABLE = ['mailinator.com','guerrillamail.com','guerrillamail.net','sharklasers.com','10minutemail.com','10minutemail.net','tempmail.com','temp-mail.org','temp-mail.io','yopmail.com','trashmail.com','getnada.com','throwawaymail.com','dispostable.com','maildrop.cc','fakeinbox.com','mohmal.com','emailondeck.com','tempail.com','mailnesia.com','spamgourmet.com','mintemail.com','moakt.com','burnermail.io','tempinbox.com','discard.email','mailcatch.com','tmpmail.org','fakemail.net','inboxkitten.com'];
  const FAKE_LOCAL = /^(test|tester|testing|asdf|asd|qwerty|abc|abcd|xxx|aaa|none|noreply|no-reply|fake|spam|example|mail|email|info@info)$/i;

  function cleanPhone(v) { return String(v || '').replace(/[\s().\-\/]/g, ''); }
  function validPhone(v) {
    // Optional field: empty is fine. When filled, it only has to look like a phone number (not a made-up one).
    let n = cleanPhone(v);
    if (!n) return true;
    if (!/^\+?[0-9]+$/.test(n)) return false;
    const digits = n.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) return false;
    if (/^(\d)\1+$/.test(digits) || /(\d)\1{5,}/.test(digits)) return false;                      // 0000000000
    if ('01234567890123456789'.includes(digits.slice(-7)) || '98765432109876543210'.includes(digits.slice(-7))) return false; // 1234567
    return true;                                                                                 // +31 6 4827 1953, 06 4827 1953, 31648271953
  }
  // An address that looks typed at random ("kjkakdmk"): we ask once, we do not block.
  function looksRandom(email) {
    const local = String(email || '').toLowerCase().split('@')[0].replace(/[^a-z]/g, '');
    if (local.length < 7) return false;
    const vowels = (local.match(/[aeiouy]/g) || []).length;
    return vowels / local.length <= 0.16 || /[^aeiouy]{6,}/.test(local);
  }
  function validEmailSyntax(v) {
    const e = String(v || '').trim().toLowerCase();
    if (e.length > 254 || !/^[a-z0-9._%+\-]+@[a-z0-9\-]+(\.[a-z0-9\-]+)*\.[a-z]{2,}$/.test(e)) return false;
    const [local, domain] = e.split('@');
    if (local.length < 2 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
    if (FAKE_LOCAL.test(local) && /^(test|example|domain)\./.test(domain)) return false;
    if (/^(test|example|invalid|localhost)\.|\.(test|example|invalid|local)$/.test(domain)) return false;
    return true;
  }
  const validators = {
    name: (v) => {
      const t = String(v || '').trim();
      return t.length > 1 && /\p{L}{2}/u.test(t) && !/[0-9@]|https?:|www\./i.test(t) && !/^(.)\1+$/.test(t.replace(/\s/g, ''));
    },
    email: validEmailSyntax,
    phone: validPhone,
  };
  const isDisposable = (v) => DISPOSABLE.includes(String(v).trim().toLowerCase().split('@')[1] || '');

  // Does the e-mail domain really receive mail? Asks a public DNS service for its MX (or A) records.
  // If the lookup itself fails (offline, blocked), we let the visitor through rather than block a real person.
  const dnsCache = {};
  async function domainReceivesMail(email) {
    const domain = String(email).trim().toLowerCase().split('@')[1];
    if (!domain) return false;
    if (domain in dnsCache) return dnsCache[domain];
    const ask = async (type) => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 3500);
      try {
        const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, { headers: { accept: 'application/dns-json' }, signal: ctl.signal });
        const j = await r.json();
        return { ok: true, status: j.Status, has: Array.isArray(j.Answer) && j.Answer.some((a) => a.type === (type === 'MX' ? 15 : 1)) };
      } catch (err) { return { ok: false }; } finally { clearTimeout(timer); }
    };
    const mx = await ask('MX');
    if (!mx.ok) return true;
    if (mx.has) return (dnsCache[domain] = true);
    const a = await ask('A');
    if (!a.ok) return true;
    return (dnsCache[domain] = a.has);
  }

  const showError = (field, message) => {
    const wrapper = field.closest('.field') || field.closest('.form-step');
    if (!wrapper) return;
    wrapper.classList.toggle('has-error', Boolean(message));
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    const errorEl = wrapper.querySelector('.field-error');
    if (errorEl) errorEl.textContent = message || '';
  };

  const showGroupError = (message) => {
    const errorEl = document.getElementById('servicesError');
    if (errorEl) errorEl.textContent = message || '';
    const wrapper = errorEl?.closest('.form-step');
    wrapper?.classList.toggle('has-error', Boolean(message));
  };

  /* ---------------------------------------------------------------------
     Intake form: step-by-step ("Typeform-style") navigation
  --------------------------------------------------------------------- */
  const steps = form ? Array.from(form.querySelectorAll('.form-step')) : [];
  const stepBackBtn = document.getElementById('stepBack');
  const stepProgressBar = document.getElementById('stepProgressBar');
  let stepIndex = 0;

  const stepFieldValidators = {
    name: () => {
      const el = form.querySelector('#name');
      const t = window.SolaceI18n ? window.SolaceI18n.t : (k) => k;
      if (!validators.name(el.value)) {
        showError(el, t('form.error.name'));
        return false;
      }
      showError(el, '');
      return true;
    },
    email: () => {
      const el = form.querySelector('#email');
      const t = window.SolaceI18n ? window.SolaceI18n.t : (k) => k;
      if (!validators.email(el.value)) {
        showError(el, t('form.error.email'));
        return false;
      }
      if (isDisposable(el.value)) {
        showError(el, t('form.error.email.temp'));
        return false;
      }
      showError(el, '');
      return true;
    },
    phone: () => {
      const el = form.querySelector('#phone');
      const t = window.SolaceI18n ? window.SolaceI18n.t : (k) => k;
      if (!validators.phone(el.value)) {
        showError(el, t('form.error.phone'));
        return false;
      }
      showError(el, '');
      return true;
    },
    services: () => {
      const t = window.SolaceI18n ? window.SolaceI18n.t : (k) => k;
      const checked = form.querySelectorAll('input[name="services"]:checked');
      if (checked.length === 0) {
        showGroupError(t('form.error.services'));
        return false;
      }
      showGroupError('');
      return true;
    },
  };

  const stepLabelEl = document.getElementById('stepLabel');
  const intakePanel = intakeModal?.querySelector('.intake-modal-panel');
  const tr = (k) => (window.SolaceI18n ? window.SolaceI18n.t(k) : k);

  function updateStepProgress() {
    if (!stepProgressBar || !steps.length) return;
    const done = form.classList.contains('is-done');
    stepProgressBar.style.width = done ? '100%' : `${((stepIndex + 1) / steps.length) * 100}%`;
  }

  function updateStepLabel() {
    if (!stepLabelEl || !steps.length) return;
    if (stepIndex === steps.length - 1) { stepLabelEl.textContent = tr('form.step.final'); return; }
    if (steps[stepIndex].hasAttribute('data-intro')) { stepLabelEl.textContent = tr('form.step.intro'); return; }
    const total = steps.length - 2;       // without the welcome and the review screen
    const n = stepIndex;
    const ratio = n / total;
    const cheer = n === total ? tr('form.cheer.last') : ratio >= 0.75 ? tr('form.cheer.q3') : ratio >= 0.5 ? tr('form.cheer.half') : ratio >= 0.25 ? tr('form.cheer.q1') : '';
    stepLabelEl.textContent = tr('form.step.label').replace('{n}', n).replace('{total}', total) + (cheer ? ` · ${cheer}` : '');
  }

  // Summary on the last screen, so people can see what they are sending.
  function fillReview() {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || '-';
    };
    const labelOf = (input) => input.closest('label')?.querySelector('.choice-text')?.textContent.trim() || input.value;
    set('sumName', form.querySelector('#name').value.trim());
    set('sumEmail', form.querySelector('#email').value.trim());
    set('sumPhone', form.querySelector('#phone').value.trim());
    set('sumServices', Array.from(form.querySelectorAll('input[name="services"]:checked')).map(labelOf).join(', '));
    const freq = form.querySelector('input[name="frequency"]:checked');
    set('sumFrequency', freq ? labelOf(freq) : '');
    set('sumRegion', (form.querySelector('#region')?.value || '').trim());
    const pick = (name) => { const el = form.querySelector(`input[name="${name}"]:checked`); return el ? labelOf(el) : ''; };
    set('sumIncome', pick('income'));
    set('sumBudget', pick('budget'));
    set('sumTiming', pick('timing'));
  }

  function showStep(index, { focus = true } = {}) {
    steps.forEach((step, i) => {
      const active = i === index;
      step.classList.toggle('is-active', active);
      step.classList.toggle('is-before', i < index);
      step.toggleAttribute('inert', !active);
    });
    if (stepBackBtn) stepBackBtn.hidden = index === 0;
    updateStepProgress();
    updateStepLabel();
    if (index === steps.length - 1) fillReview();
    if (!focus) return;
    const active = steps[index];
    const focusable = active?.querySelector('input:checked, input:not([type="hidden"]), select, textarea')
      || active?.querySelector('button[type="submit"]');
    focusable?.focus({ preventScroll: true });
  }

  // The mail via Formspree stays the full record. The same application also
  // goes into access_requests so it can be approved from the dashboard or
  // the team app with one tap, like an application from the app. Best
  // effort: a failure here never blocks the thank-you screen.
  const SB_URL = 'https://weiihajterqholxppgsl.supabase.co/rest/v1/access_requests';
  const SB_KEY = 'sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr';
  function buildAccessRequestRow(fd) {
    const get = (k) => String(fd.get(k) || '').trim();
    const services = fd.getAll('services').map(String);
    const summary = [
      services.length ? `Interesse: ${services.join(', ')}` : '',
      get('frequency') && `Frequentie: ${get('frequency')}`,
      get('budget') && get('budget') !== 'weet-ik-niet' ? `Budget: ${get('budget')}` : '',
      get('timing') && `Wanneer: ${get('timing')}`,
    ].filter(Boolean).join('. ');
    const intake = {};
    ['company', 'role', 'services', 'frequency', 'income', 'budget', 'timing', 'referrer', 'message', 'referral_source'].forEach((k) => {
      const v = k === 'services' ? services : get(k);
      if (Array.isArray(v) ? v.length : v) intake[k] = v;
    });
    intake.lang = (document.documentElement.lang || 'nl').slice(0, 2);
    return {
      id: (crypto.randomUUID && crypto.randomUUID()) || undefined,
      full_name: get('name').slice(0, 120),
      email: get('email').slice(0, 200),
      phone: get('phone').slice(0, 40) || null,
      city: get('region').slice(0, 120) || null,
      looking_for: summary.slice(0, 500) || null,
      source: 'website',
      intake,
    };
  }
  function saveAccessRequest(row) {
    try {
      fetch(SB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: 'return=minimal' },
        body: JSON.stringify(row),
        keepalive: true,
      }).then((r) => { if (!r.ok) console.warn('Solace: access request not stored', r.status); }).catch(() => {});
    } catch (e) { /* the mail already went out */ }
  }

  // Terminal state after a successful send: thank-you + app teaser.
  function showDone(firstName) {
    form.classList.add('is-done');
    intakePanel?.classList.add('is-done');
    const nameEl = document.getElementById('doneName');
    if (nameEl) nameEl.textContent = firstName ? `, ${firstName}.` : '.';
    successMsg.hidden = false;
    updateStepProgress();
    successMsg.focus({ preventScroll: true });
    if (intakeModal) intakeModal.scrollTop = 0;
  }

  function resetIntakeAfterDone() {
    if (!form || !form.classList.contains('is-done')) return;
    form.classList.remove('is-done');
    intakePanel?.classList.remove('is-done');
    successMsg.hidden = true;
    stepIndex = 0;
    showStep(0, { focus: false });
  }

  let intakeOpenedAt = Date.now();
  intakeModal?.addEventListener('transitionend', () => {}, { once: true });
  new MutationObserver(() => { if (intakeModal.classList.contains('is-open')) intakeOpenedAt = Date.now(); }).observe(intakeModal || document.body, { attributes: true, attributeFilter: ['class'] });
  let softWarnedEmail = '';
  let checkingStep = false;
  async function goToNextStep() {
    if (checkingStep) return;
    const validate = stepFieldValidators[steps[stepIndex]?.dataset.validate];
    if (validate && !validate()) {
      steps[stepIndex].querySelector('.has-error input, .has-error textarea')?.focus();
      return;
    }
    if (steps[stepIndex]?.dataset.validate === 'email') {
      const mailEl = form.querySelector('#email');
      const v = mailEl.value.trim().toLowerCase();
      if (looksRandom(v) && softWarnedEmail !== v) {
        softWarnedEmail = v;
        showError(mailEl, tr('form.error.email.confirm').replace('{email}', mailEl.value.trim()));
        mailEl.focus();
        return;
      }
    }
    // The e-mail domain must really exist (can receive mail).
    if (steps[stepIndex]?.dataset.validate === 'email') {
      const el = form.querySelector('#email');
      const btn = steps[stepIndex].querySelector('.step-next');
      checkingStep = true;
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = '…'; }
      const ok = await domainReceivesMail(el.value);
      checkingStep = false;
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || btn.textContent; }
      if (!ok) {
        showError(el, tr('form.error.email.real'));
        el.focus();
        return;
      }
    }
    if (stepIndex < steps.length - 1) {
      stepIndex += 1;
      showStep(stepIndex);
    }
  }

  function goToPrevStep() {
    if (stepIndex > 0) {
      stepIndex -= 1;
      showStep(stepIndex);
    }
  }

  if (form && steps.length) {
    showStep(stepIndex, { focus: false });

    form.querySelectorAll('.step-next').forEach((btn) => {
      btn.addEventListener('click', goToNextStep);
    });
    stepBackBtn?.addEventListener('click', goToPrevStep);

    form.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const step = steps[stepIndex];
      if (!step || !step.contains(e.target)) return;

      // Textareas keep plain Enter as a newline; Shift/Ctrl/Cmd+Enter advances.
      if (e.target.tagName === 'TEXTAREA' && !(e.shiftKey || e.ctrlKey || e.metaKey)) {
        return;
      }

      e.preventDefault();
      if (stepIndex === steps.length - 1) {
        form.querySelector('button[type="submit"]')?.click();
      } else {
        goToNextStep();
      }
    });
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;

    const nameField = form.querySelector('#name');
    const emailField = form.querySelector('#email');
    const phoneField = form.querySelector('#phone');
    const servicesChecked = form.querySelectorAll('input[name="services"]:checked');

    const t = window.SolaceI18n ? window.SolaceI18n.t : (k) => k;

    if (!validators.name(nameField.value)) {
      showError(nameField, t('form.error.name'));
      valid = false;
    } else {
      showError(nameField, '');
    }

    if (!validators.email(emailField.value)) {
      showError(emailField, t('form.error.email'));
      valid = false;
    } else {
      showError(emailField, '');
    }

    if (!validators.phone(phoneField.value)) {
      showError(phoneField, t('form.error.phone'));
      valid = false;
    } else {
      showError(phoneField, '');
    }

    if (servicesChecked.length === 0) {
      showGroupError(t('form.error.services'));
      valid = false;
    } else {
      showGroupError('');
    }

    if (!valid) {
      const badStep = steps.findIndex((st) => st.classList.contains('has-error'));
      if (badStep >= 0) {
        stepIndex = badStep;
        showStep(stepIndex);
      } else {
        form.querySelector('.has-error input')?.focus();
      }
      return;
    }

    // Bots: a hidden field real people never see, and nobody fills in 12 questions in a few seconds.
    const trap = form.querySelector('input[name="_gotcha"]');
    const tooFast = intakeOpenedAt && Date.now() - intakeOpenedAt < 5000;
    if ((trap && trap.value) || tooFast) {
      form.reset();
      stepIndex = 0;
      showDone(nameField.value.trim().split(/\s+/)[0]);
      return;
    }
    if (isDisposable(emailField.value)) {
      showError(emailField, t('form.error.email.temp'));
      const bad = steps.findIndex((st) => st.classList.contains('has-error'));
      if (bad >= 0) { stepIndex = bad; showStep(stepIndex); }
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-label').textContent = t('form.submitting');
    formErrorMsg.hidden = true;

    const fd = new FormData(form);
    const requestRow = buildAccessRequestRow(fd);
    fetch(form.action, {
      method: 'POST',
      body: fd,
      headers: { Accept: 'application/json' },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Formspree responded with ${response.status}`);
        saveAccessRequest(requestRow);
        const firstName = nameField.value.trim().split(/\s+/)[0];
        form.reset();
        stepIndex = 0;
        showDone(firstName);
      })
      .catch((err) => {
        console.warn('Solace: intake form submission failed.', err);
        formErrorMsg.hidden = false;
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-label').textContent = t('form.submit');
      });
  });

  // Clear field error as the user corrects it
  form?.querySelectorAll('input, textarea').forEach((el) => {
    el.addEventListener('input', () => showError(el, ''));
  });
  form?.querySelectorAll('input[name="services"]').forEach((el) => {
    el.addEventListener('change', () => showGroupError(''));
  });

  // Hide the error banner again once the user starts editing
  form?.addEventListener('focusin', (e) => {
    if (formErrorMsg && !formErrorMsg.hidden && !e.target.closest('button[type="submit"]')) formErrorMsg.hidden = true;
  });

  // Keep the step label and summary in the active language after a language switch
  if (form && steps.length) {
    new MutationObserver(() => {
      updateStepLabel();
      if (stepIndex === steps.length - 1) fillReview();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  /* ---------------------------------------------------------------------
     Membership benefits: interactive tabs
  --------------------------------------------------------------------- */
  const benefitsTabs = document.querySelectorAll('.benefits-tab');
  benefitsTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      benefitsTabs.forEach((t) => {
        t.classList.toggle('is-active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      document.querySelectorAll('.benefits-tab-panel').forEach((panel) => {
        panel.classList.toggle('is-active', panel.dataset.panel === target);
      });
    });
  });

  /* ---------------------------------------------------------------------
     Endless CSS animations (ticker, shiny text, live dots) are paused while
     they are off screen, so the browser does not repaint them for nothing.
  --------------------------------------------------------------------- */
  if ('IntersectionObserver' in window && !reducedMotion) {
    const pauser = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        en.target.style.animationPlayState = en.isIntersecting ? '' : 'paused';
      });
    }, { rootMargin: '80px' });
    document.querySelectorAll('.shiny-text, .ticker-track, .lf-live i, .hero-live i').forEach((el) => pauser.observe(el));
  }
})();


/* Services dropdown: hover/focus on desktop, tap to toggle on touch */
(() => {
  const dd = document.getElementById('navServices');
  if (!dd) return;
  const trigger = dd.querySelector('.nav-dropdown-trigger');
  let closeTimer = null;
  const setOpen = (open) => {
    dd.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
  };
  const canHover = window.matchMedia('(hover: hover)').matches;
  if (canHover) {
    dd.addEventListener('mouseenter', () => { clearTimeout(closeTimer); setOpen(true); });
    dd.addEventListener('mouseleave', () => { closeTimer = setTimeout(() => setOpen(false), 140); });
  }
  dd.addEventListener('focusin', () => setOpen(true));
  dd.addEventListener('focusout', (e) => { if (!dd.contains(e.relatedTarget)) setOpen(false); });
  trigger.addEventListener('click', (e) => {
    if (!canHover) { e.preventDefault(); setOpen(!dd.classList.contains('is-open')); }
  });
  document.addEventListener('click', (e) => { if (!dd.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setOpen(false); trigger.blur(); } });
})();
