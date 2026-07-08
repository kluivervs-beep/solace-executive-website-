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
     Transition overlay: brief curtain wipe on first load only
  --------------------------------------------------------------------- */
  if (window.gsap && !reducedMotion) {
    gsap.to('.transition-overlay', {
      yPercent: -100,
      duration: 0.7,
      ease: 'power2.inOut',
      delay: 0.15,
    });
  } else {
    document.querySelector('.transition-overlay')?.style.setProperty('display', 'none');
  }

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
      gsap.to('.hero-ring', {
        rotate: 360,
        duration: 120,
        repeat: -1,
        ease: 'none',
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
      gsap.utils.toArray('.reveal').forEach((el, i) => {
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

      const jetPath = document.getElementById('jetPathProgress');
      const jetIcon = document.getElementById('jetIcon');
      if (jetPath && jetIcon) {
        const total = jetPath.getTotalLength();
        const point = jetPath.getPointAtLength(total);
        jetIcon.setAttribute('transform', `translate(${point.x} ${point.y})`);
        jetPath.style.strokeDasharray = 'none';
        jetPath.style.strokeDashoffset = '0';
      }
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
     Intake form: client-side validation + local "submit" (no backend)
  --------------------------------------------------------------------- */
  const form = document.getElementById('intakeForm');
  const successMsg = document.getElementById('formSuccess');

  const validators = {
    name: (v) => v.trim().length > 1,
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    phone: (v) => v.replace(/[^0-9]/g, '').length >= 8,
  };

  const showError = (field, message) => {
    const wrapper = field.closest('.field') || field.closest('.form-step');
    if (!wrapper) return;
    wrapper.classList.toggle('has-error', Boolean(message));
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
    0: () => {
      const el = form.querySelector('#name');
      const t = window.SolaceI18n ? window.SolaceI18n.t : (k) => k;
      if (!validators.name(el.value)) {
        showError(el, t('form.error.name'));
        return false;
      }
      showError(el, '');
      return true;
    },
    1: () => {
      const el = form.querySelector('#email');
      const t = window.SolaceI18n ? window.SolaceI18n.t : (k) => k;
      if (!validators.email(el.value)) {
        showError(el, t('form.error.email'));
        return false;
      }
      showError(el, '');
      return true;
    },
    2: () => {
      const el = form.querySelector('#phone');
      const t = window.SolaceI18n ? window.SolaceI18n.t : (k) => k;
      if (!validators.phone(el.value)) {
        showError(el, t('form.error.phone'));
        return false;
      }
      showError(el, '');
      return true;
    },
    4: () => {
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

  function updateStepProgress() {
    if (!stepProgressBar || !steps.length) return;
    stepProgressBar.style.width = `${((stepIndex + 1) / steps.length) * 100}%`;
  }

  function showStep(index) {
    steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
    if (stepBackBtn) stepBackBtn.hidden = index === 0;
    updateStepProgress();
    const active = steps[index];
    const focusable = active?.querySelector('input, select, textarea') || active?.querySelector('button[type="submit"]');
    focusable?.focus({ preventScroll: true });
  }

  function goToNextStep() {
    const validate = stepFieldValidators[stepIndex];
    if (validate && !validate()) {
      steps[stepIndex].querySelector('.has-error input, .has-error textarea')?.focus();
      return;
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
    showStep(stepIndex);

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
      form.querySelector('.has-error input')?.focus();
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-label').textContent = t('form.submitting');

    // No backend wired up yet — simulate a submit so the flow is demonstrable.
    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-label').textContent = t('form.submit');
      successMsg.hidden = false;
      form.reset();
      if (steps.length) {
        stepIndex = 0;
        showStep(stepIndex);
      }
    }, 700);
  });

  // Clear field error as the user corrects it
  form?.querySelectorAll('input, textarea').forEach((el) => {
    el.addEventListener('input', () => showError(el, ''));
  });
  form?.querySelectorAll('input[name="services"]').forEach((el) => {
    el.addEventListener('change', () => showGroupError(''));
  });

  // Hide the success banner again once the user starts a new application
  form?.addEventListener('focusin', () => {
    if (successMsg && !successMsg.hidden) successMsg.hidden = true;
  });
})();
