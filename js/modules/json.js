'use strict';

(function () {
  const JSON_PATH = 'json/qa.json';

  function waitForApp(maxAttempts = 120, delay = 100) {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      const timer = setInterval(() => {
        attempts += 1;

        const app = window.FibraLogics;
        const termsList = document.getElementById('terms-list');
        const toggle = document.getElementById('multi-city-toggle');

        if (app && termsList && toggle && app.TermManager?.listEl) {
          clearInterval(timer);
          resolve(app);
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(timer);
          reject(new Error('Fibra app was not initialized in time.'));
        }
      }, delay);
    });
  }

  function flattenPayload(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.terms)) {
      return payload.terms;
    }

    if (Array.isArray(payload?.pages)) {
      return payload.pages.flatMap((page) => {
        const city = page.city || '';
        const terms = Array.isArray(page.terms) ? page.terms : [];

        return terms.map((term) => ({
          ...term,
          termCity: term.termCity || city
        }));
      });
    }

    return [];
  }

  function normalizeTerm(term) {
    return {
      termCity: String(term.termCity || '').trim(),
      clientAddr: String(term.clientAddr || '').trim(),
      cabinetAddr: String(term.cabinetAddr || '').trim(),
      boxMid: String(term.boxMid || '').trim(),
      boxSuffix: String(term.boxSuffix || '').trim(),
      couplerNum: String(term.couplerNum || '').trim(),
      couplerPhase: Number(term.couplerPhase || 1),
      vzkNum: String(term.vzkNum || '').trim(),
      hasTA: Boolean(term.hasTA),
      smNum: String(term.smNum || '').trim(),
      comment: String(term.comment || '').trim()
    };
  }

  function setField(card, field, value) {
    const el = card.querySelector(`[data-field="${field}"]`);
    if (!el) return;

    if (el.type === 'checkbox') {
      el.checked = Boolean(value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    el.value = value ?? '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function clearInitialState(app) {
    const { State, PreviewManager } = app;
    const termsList = document.getElementById('terms-list');

    State.city = '';
    State.terms = [];
    State._nextId = 1;
    State.markSaved();

    if (termsList) {
      termsList.innerHTML = '';
    }

    PreviewManager.render();
  }

  function enableMultiCity(app) {
    const multiToggle = document.getElementById('multi-city-toggle');

    if (!multiToggle.checked) {
      multiToggle.checked = true;
      multiToggle.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      app.toggleMultiCity(true);
    }
  }

  async function preloadTerms() {
    try {
      const app = await waitForApp();
      const response = await fetch(JSON_PATH, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`Failed to load ${JSON_PATH}: ${response.status}`);
      }

      const payload = await response.json();
      const terms = flattenPayload(payload).map(normalizeTerm);

      if (!terms.length) {
        console.warn('[json.js] qa.json is empty. Nothing to preload.');
        return;
      }

      clearInitialState(app);
      enableMultiCity(app);

      terms.forEach((termData) => {
        app.TermManager.add();

        const term = app.State.terms[app.State.terms.length - 1];
        const card = document.querySelector(`.term-card[data-id="${term.id}"]`);

        if (!card) return;

        Object.entries(termData).forEach(([field, value]) => {
          term[field] = value;
          setField(card, field, value);
        });

        app.validateAndPaintTerm(term.id);
        app.refreshQRs(term.id);
      });

      app.PreviewManager.render();
      app.State.markSaved();
    } catch (error) {
      console.error('[json.js] preload error:', error);
    }
  }

  window.addEventListener('load', preloadTerms);
})();
