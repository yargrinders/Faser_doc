'use strict';

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function mapsUrl(city, addr) {
  if (!addr || !addr.trim()) return null;
  const q = city ? `${addr.trim()}, ${city.trim()}` : addr.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function forcePositiveInt(value, fallback = 1) {
  const n = parseInt(String(value || '').replace(/\D+/g, ''), 10);
  if (Number.isNaN(n) || n < 1) return fallback;
  return n;
}

function formatDateForFilename(date = new Date()) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

function sanitizeFilenamePart(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

function buildPdfFilename() {
  const title = sanitizeFilenamePart('Glasfaser-Anschluss', 'Dokument');
  const city = sanitizeFilenamePart(State.city, 'Ohne_Stadt');
  return `FibraGen_${title}_${city}_${formatDateForFilename()}.pdf`;
}

function makeQRDataUrl(url, size = 100) {
  return new Promise(resolve => {
    if (!url || !window.QRCode) { resolve(null); return; }
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden;';
    document.body.appendChild(wrap);

    try {
      new QRCode(wrap, {
        text: url,
        width: size,
        height: size,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (e) {
      wrap.remove();
      resolve(null);
      return;
    }

    let attempts = 0;
    const timer = setInterval(() => {
      const canvas = wrap.querySelector('canvas');
      if (canvas) {
        clearInterval(timer);
        const data = canvas.toDataURL('image/png');
        wrap.remove();
        resolve(data);
      } else if (++attempts > 30) {
        clearInterval(timer);
        wrap.remove();
        resolve(null);
      }
    }, 40);
  });
}

function renderQRInto(el, url, size = 64) {
  el.innerHTML = '';
  if (!url || !window.QRCode) {
    el.classList.add('empty');
    return;
  }
  el.classList.remove('empty');
  try {
    new QRCode(el, {
      text: url,
      width: size,
      height: size,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  } catch (e) {
    el.classList.add('empty');
  }
}

const REQUIRED_FIELDS = ['clientAddr', 'cabinetAddr', 'boxMid', 'boxSuffix', 'couplerNum', 'vzkNum', 'smNum'];
const REQUIRED_LABELS = {
  clientAddr: 'Kundenadresse',
  cabinetAddr: 'Schrank-Adresse',
  boxMid: 'Box-Nummer 2P',
  boxSuffix: 'Box-Suffix',
  couplerNum: 'Koppler Nummer',
  vzkNum: 'Kassette VZK',
  smNum: 'SM-Nummer',
};

const State = {
  city: '',
  terms: [],
  _nextId: 1,
  _dirty: false,

  markSaved() { this._dirty = false; },
  markDirty() { this._dirty = true; },
  isDirty() { return this._dirty; },

  addTerm() {
    const term = {
      id: this._nextId++,
      clientAddr: '',
      cabinetAddr: '',
      boxMid: '',
      boxSuffix: '',
      couplerNum: '',
      couplerPhase: 1,
      vzkNum: '',
      hasTA: false,
      smNum: '',
      comment: '',
    };
    this.terms.push(term);
    this.markDirty();
    return term;
  },

  removeTerm(id) {
    this.terms = this.terms.filter(t => t.id !== id);
    this.markDirty();
  },

  update(id, field, value) {
    const term = this.terms.find(t => t.id === id);
    if (!term) return;
    term[field] = field === 'couplerPhase' ? forcePositiveInt(value, 1) : value;
    this.markDirty();
  },

  setCity(value) {
    this.city = value;
    this.markDirty();
  },
};

function getTermById(id) {
  return State.terms.find(t => t.id === id);
}

function validateCity() {
  const input = document.getElementById('global-city');
  const errorEl = document.getElementById('city-error');
  const valid = Boolean(String(State.city || '').trim());
  if (input) input.classList.toggle('error', !valid);
  if (errorEl) errorEl.textContent = valid ? '' : 'Stadt ist erforderlich.';
  return valid;
}

function validateTerm(term) {
  const errors = {};
  REQUIRED_FIELDS.forEach(field => {
    if (!String(term[field] || '').trim()) {
      errors[field] = `${REQUIRED_LABELS[field]} ist erforderlich.`;
    }
  });
  term.couplerPhase = forcePositiveInt(term.couplerPhase, 1);
  return { isValid: Object.keys(errors).length === 0, errors };
}

function validateAllTerms() {
  return {
    cityValid: validateCity(),
    results: State.terms.map(term => ({ id: term.id, ...validateTerm(term) })),
    get isValid() {
      return this.cityValid && this.results.every(r => r.isValid);
    },
  };
}

function applyValidationState(card, validation) {
  if (!card) return;
  card.classList.toggle('has-errors', !validation.isValid);
  const alert = card.querySelector('[data-form-alert]');
  if (alert) {
    alert.classList.toggle('show', !validation.isValid);
    alert.textContent = validation.isValid ? '' : 'Bitte alle Pflichtfelder ausfüllen.';
  }

  card.querySelectorAll('[data-field]').forEach(el => {
    if (el.type === 'checkbox') return;
    const field = el.dataset.field;
    const hasError = Boolean(validation.errors[field]);
    el.classList.toggle('error', hasError);
    const msg = card.querySelector(`[data-error-for="${field}"]`);
    if (msg) msg.textContent = hasError ? validation.errors[field] : '';
  });

  const boxError = card.querySelector('[data-error-for="boxCombo"]');
  if (boxError) {
    if (validation.errors.boxMid || validation.errors.boxSuffix) {
      boxError.textContent = 'Box-Nummer 2P — Box-Suffix ist erforderlich.';
    } else {
      boxError.textContent = '';
    }
  }

  const boxMidMsg = card.querySelector('[data-error-for="boxMid"]');
  const boxSuffixMsg = card.querySelector('[data-error-for="boxSuffix"]');
  if (boxMidMsg) boxMidMsg.textContent = '';
  if (boxSuffixMsg) boxSuffixMsg.textContent = '';
}

function validateAndPaintTerm(id) {
  const term = getTermById(id);
  const card = document.querySelector(`.term-card[data-id="${id}"]`);
  if (!term || !card) return true;
  const validation = validateTerm(term);
  applyValidationState(card, validation);
  return validation.isValid;
}

function refreshCardHeader(card, term) {
  if (!card || !term) return;
  const nameEl = card.querySelector('[data-name]');
  const addrEl = card.querySelector('[data-addr]');
  if (nameEl) nameEl.textContent = term.clientAddr || `Terminal #${term.id}`;
  if (addrEl) addrEl.textContent = term.cabinetAddr ? `→ ${term.cabinetAddr}` : '';
}

function buildErrorRow(field) {
  return `<div class="error-text" data-error-for="${field}"></div>`;
}

function refreshQRs(id) {
  const term = getTermById(id);
  if (!term) return;
  const clientUrl = mapsUrl(State.city, term.clientAddr);
  const cabinetUrl = mapsUrl(State.city, term.cabinetAddr);
  const cEl = document.getElementById(`qrc-c-${id}`);
  const kEl = document.getElementById(`qrc-k-${id}`);
  if (cEl) renderQRInto(cEl, clientUrl, 60);
  if (kEl) renderQRInto(kEl, cabinetUrl, 60);
}

function refreshAllQRs() {
  State.terms.forEach(term => refreshQRs(term.id));
}

function buildCard(term) {
  term.couplerPhase = forcePositiveInt(term.couplerPhase, 1);
  const card = document.createElement('div');
  card.className = 'term-card';
  card.dataset.id = term.id;

  card.innerHTML = `
  <div class="term-card-header">
    <div class="term-num">${term.id}</div>
    <div class="term-card-name" data-name>Terminal #${term.id}</div>
    <div class="term-card-addr" data-addr></div>
    <button class="btn-remove" data-del type="button">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13">
        <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/>
      </svg>
      Löschen
    </button>
    <svg class="collapse-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
      <polyline points="4 6 8 10 12 6"/>
    </svg>
  </div>
  <div class="term-card-body">
    <div class="form-alert" data-form-alert></div>

    <div class="fg full">
      <div class="fl">Adressen &amp; QR-Codes</div>
      <div class="qr-pair">
        <div class="qr-item">
          <div class="qr-lbl">Kundenadresse</div>
          <div class="qr-addr-row">
            <input class="fi alone" data-field="clientAddr" type="text" placeholder="Ritterstr. 77" value="${esc(term.clientAddr)}">
            <div class="qr-canvas-wrap empty" id="qrc-c-${term.id}"></div>
          </div>
          ${buildErrorRow('clientAddr')}
          <div class="qr-lbl" style="color:var(--sky);font-size:0.6rem;">→ Google Maps</div>
        </div>

        <div class="qr-item">
          <div class="qr-lbl">Schrank-Adresse</div>
          <div class="qr-addr-row">
            <input class="fi alone" data-field="cabinetAddr" type="text" placeholder="Ritterstr. 69" value="${esc(term.cabinetAddr)}">
            <div class="qr-canvas-wrap empty" id="qrc-k-${term.id}"></div>
          </div>
          ${buildErrorRow('cabinetAddr')}
          <div class="qr-lbl" style="color:var(--sky);font-size:0.6rem;">→ Google Maps</div>
        </div>
      </div>
    </div>

    <div class="fg full">
      <div class="fl">Kommentare</div>
      <textarea class="comment-textarea" data-field="comment" placeholder="Kommentare eingeben...">${esc(term.comment)}</textarea>
      ${buildErrorRow('comment')}
    </div>

    <div class="fg full">
      <div class="fl">Box-Nummer</div>
      <div class="input-row">
        <span class="pfx red">2P</span>
        <input class="fi mid" data-field="boxMid" type="text" placeholder="3025" value="${esc(term.boxMid)}" style="max-width:100px;">
        <span class="sep">—</span>
        <input class="fi last" data-field="boxSuffix" type="text" placeholder="033" value="${esc(term.boxSuffix)}" style="max-width:80px;">
      </div>
      ${buildErrorRow('boxCombo')}
      ${buildErrorRow('boxMid')}
      ${buildErrorRow('boxSuffix')}
    </div>

    <div class="fg">
      <div class="fl">Koppler</div>
      <div class="input-row">
        <span class="pfx sky">K</span>
        <input class="fi mid" data-field="couplerNum" type="text" placeholder="21" value="${esc(term.couplerNum)}" style="max-width:80px;">
        <span class="sep">—</span>
        <button class="step-btn minus" type="button" data-step="-1">−</button>
        <input class="fi mid step-input" data-field="couplerPhase" inputmode="numeric" type="text" value="${term.couplerPhase}">
        <button class="step-btn plus" type="button" data-step="1">+</button>
        <span class="sfx">x</span>
      </div>
      ${buildErrorRow('couplerNum')}
      ${buildErrorRow('couplerPhase')}
    </div>

    <div class="fg">
      <div class="fl">Kassette VZK</div>
      <div class="input-row">
        <span class="pfx">VZK</span>
        <input class="fi last" data-field="vzkNum" type="text" placeholder="33" value="${esc(term.vzkNum)}">
      </div>
      ${buildErrorRow('vzkNum')}
    </div>

    <div class="fg">
      <div class="fl">+TA</div>
      <div class="ta-check ${term.hasTA ? 'active' : ''}" id="ta-${term.id}">
        <div class="ta-box">
          <svg viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2.5" width="9" height="9">
            <polyline points="2 6 5 9 10 3"/>
          </svg>
        </div>
        <span class="ta-lbl">+TA aktiviert</span>
        <input type="checkbox" data-field="hasTA" ${term.hasTA ? 'checked' : ''} style="display:none;">
      </div>
    </div>

    <div class="fg">
      <div class="fl">SM-Nummer</div>
      <div class="input-row">
        <span class="pfx">SM</span>
        <input class="fi last" data-field="smNum" type="text" placeholder="210885400" value="${esc(term.smNum)}">
      </div>
      ${buildErrorRow('smNum')}
    </div>
  </div>`;

  refreshCardHeader(card, term);

  const header = card.querySelector('.term-card-header');
  header.addEventListener('click', e => {
    if (e.target.closest('[data-del]') || e.target.closest('[data-step]')) return;
    card.classList.toggle('collapsed');
  });

  card.querySelector('[data-del]').addEventListener('click', () => TermManager.remove(term.id));

  const taEl = card.querySelector(`#ta-${term.id}`);
  const taCb = taEl.querySelector('input');
  taEl.addEventListener('click', () => {
    const next = !taCb.checked;
    taCb.checked = next;
    State.update(term.id, 'hasTA', next);
    taEl.classList.toggle('active', next);
    PreviewManager.render();
  });

  card.querySelectorAll('[data-field]').forEach(el => {
    if (el.type === 'checkbox') return;

    if (el.dataset.field === 'couplerPhase') {
      el.addEventListener('blur', () => {
        const fixed = forcePositiveInt(el.value, 1);
        el.value = String(fixed);
        State.update(term.id, 'couplerPhase', fixed);
        validateAndPaintTerm(term.id);
        PreviewManager.render();
      });
    }

    el.addEventListener('input', () => {
      const field = el.dataset.field;
      const value = field === 'couplerPhase' ? forcePositiveInt(el.value, 1) : el.value;
      if (field === 'couplerPhase') el.value = String(value);
      State.update(term.id, field, value);
      refreshCardHeader(card, getTermById(term.id));
      if (field === 'clientAddr' || field === 'cabinetAddr') refreshQRs(term.id);
      validateAndPaintTerm(term.id);
      PreviewManager.render();
    });
  });

  card.querySelectorAll('[data-step]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const input = card.querySelector('[data-field="couplerPhase"]');
      const current = forcePositiveInt(input.value, 1);
      const next = Math.max(1, current + Number(btn.dataset.step || 0));
      input.value = String(next);
      State.update(term.id, 'couplerPhase', next);
      validateAndPaintTerm(term.id);
      PreviewManager.render();
    });
  });

  setTimeout(() => {
    refreshQRs(term.id);
    validateAndPaintTerm(term.id);
  }, 50);

  return card;
}

const TermManager = {
  listEl: null,
  init(el) { this.listEl = el; },
  add() {
    const term = State.addTerm();
    const card = buildCard(term);
    this.listEl.appendChild(card);
    PreviewManager.render();
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },
  remove(id) {
    State.removeTerm(id);
    const card = this.listEl.querySelector(`[data-id="${id}"]`);
    if (card) card.remove();
    PreviewManager.render();
    validateCity();
  },
};

const TERMS_PER_PAGE = 6;

const PreviewManager = {
  pagesEl: null,
  countEl: null,
  init(pagesEl, countEl) {
    this.pagesEl = pagesEl;
    this.countEl = countEl;
  },
  render() {
    this.countEl.textContent = `${State.terms.length} Termine`;
    this.pagesEl.innerHTML = '';

    if (!State.terms.length) {
      this.pagesEl.innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--text-3)"><p style="font-size:.75rem">Keine Termine</p></div>';
      return;
    }

    const pageCount = Math.ceil(State.terms.length / TERMS_PER_PAGE);
    for (let p = 0; p < pageCount; p++) {
      const slice = State.terms.slice(p * TERMS_PER_PAGE, (p + 1) * TERMS_PER_PAGE);
      const wrap = document.createElement('div');
      wrap.className = 'preview-page-wrap';
      const page = document.createElement('div');
      page.className = 'preview-page';
      const inner = document.createElement('div');
      const scale = 0.31;
      inner.style.cssText = `transform:scale(${scale});transform-origin:top left;width:${100 / scale}%;font-family:Poppins,sans-serif;`;
      inner.innerHTML = buildPageInnerHTML(slice, p + 1, pageCount, 'prev');
      page.appendChild(inner);
      page.style.height = `${297 * scale * (360 / 210)}px`;
      wrap.appendChild(page);
      const lbl = document.createElement('div');
      lbl.className = 'preview-page-label';
      lbl.textContent = `Seite ${p + 1} von ${pageCount}`;
      wrap.appendChild(lbl);
      this.pagesEl.appendChild(wrap);
    }

    setTimeout(() => this.renderPreviewQRs(), 60);
  },
  renderPreviewQRs() {
    State.terms.forEach(term => {
      const cEl = document.getElementById(`prev-qrc-c-${term.id}`);
      const kEl = document.getElementById(`prev-qrc-k-${term.id}`);
      if (cEl) renderQRInto(cEl, mapsUrl(State.city, term.clientAddr), 78);
      if (kEl) renderQRInto(kEl, mapsUrl(State.city, term.cabinetAddr), 78);
    });
  },
};

function buildPageInnerHTML(terms, pageNum, totalPages, idPrefix) {
  let termsHTML = '';

  terms.forEach(t => {
    const boxHTML = `<span class="r">2P${esc(t.boxMid)}</span><span class="k">-${esc(t.boxSuffix)}</span>`;
    const coupler = t.couplerNum ? `K${t.couplerNum} - ${forcePositiveInt(t.couplerPhase, 1)}x` : '—';
    const vzk = t.vzkNum ? `VZK ${t.vzkNum}` : '—';
    const sm = t.smNum ? `SM${t.smNum}` : '—';
    const ta = t.hasTA ? '<span class="a4-ta-badge">+TA</span>' : '';
    const comment = String(t.comment || '').trim() || '—';

    termsHTML += `
      <div class="a4-term">
        <div class="a4-term-hdr">
          <div class="a4-term-hdr-left">
            <span class="a4-term-num">${t.id}</span>
            <span class="a4-term-client">${esc(t.clientAddr) || '—'}</span>
          </div>
          ${ta}
        </div>
        <div class="a4-term-body">
          <div class="a4-fields">
            <div class="a4-field">
              <div class="a4-field-key">Schrank</div>
              <div class="a4-field-val">${esc(t.cabinetAddr) || '—'}</div>
            </div>
            <div class="a4-field">
              <div class="a4-field-key">Box-Nr.</div>
              <div class="a4-field-val">${boxHTML}</div>
            </div>
            <div class="a4-field">
              <div class="a4-field-key">Koppler</div>
              <div class="a4-field-val">${esc(coupler)}</div>
            </div>
            <div class="a4-field">
              <div class="a4-field-key">VZK</div>
              <div class="a4-field-val">${esc(vzk)}</div>
            </div>
            <div class="a4-field">
              <div class="a4-field-key">SM-Nummer</div>
              <div class="a4-field-val">${esc(sm)}</div>
            </div>
            <div class="a4-field full">
              <div class="a4-field-key">Kommentare</div>
              <div class="a4-field-val">${esc(comment)}</div>
            </div>
          </div>
          <div class="a4-qrs">
            <div class="a4-qr-item">
              <div id="${idPrefix}-qrc-c-${t.id}" style="width:75px;height:75px;background:#fff;display:flex;align-items:center;justify-content:center;"></div>
              <div class="a4-qr-lbl">Kunde</div>
              <div class="a4-qr-addr">${esc(t.clientAddr)}</div>
            </div>
            <div class="a4-qr-item">
              <div id="${idPrefix}-qrc-k-${t.id}" style="width:75px;height:75px;background:#fff;display:flex;align-items:center;justify-content:center;"></div>
              <div class="a4-qr-lbl">Schrank</div>
              <div class="a4-qr-addr">${esc(t.cabinetAddr)}</div>
            </div>
          </div>
        </div>
      </div>`;
  });

  return `
    <div class="a4-doc-header">
      <div class="a4-logo-placeholder">LOGO</div>
      <div class="a4-doc-meta">
        <div class="a4-doc-title">Glasfaser-Anschluss</div>
        <div class="a4-doc-city">${esc(State.city)}</div>
        <div class="a4-doc-page">Seite ${pageNum} von ${totalPages}</div>
      </div>
    </div>
    <div class="a4-terms-list">${termsHTML}</div>`;
}

function buildPageHTML(terms, pageNum, totalPages, idPrefix) {
  return `<div class="a4-sheet">${buildPageInnerHTML(terms, pageNum, totalPages, idPrefix)}</div>`;
}

async function collectQRDataUrls() {
  const map = {};
  for (const term of State.terms) {
    const clientUrl = mapsUrl(State.city, term.clientAddr);
    const cabinetUrl = mapsUrl(State.city, term.cabinetAddr);
    if (clientUrl) map[`c-${term.id}`] = await makeQRDataUrl(clientUrl, 110);
    if (cabinetUrl) map[`k-${term.id}`] = await makeQRDataUrl(cabinetUrl, 110);
  }
  return map;
}

function injectQRImages(container, qrMap, idPrefix) {
  Object.entries(qrMap).forEach(([key, dataUrl]) => {
    if (!dataUrl) return;
    const [type, id] = key.split('-');
    const el = container.querySelector(`#${idPrefix}-qrc-${type}-${id}`);
    if (el) el.innerHTML = `<img src="${dataUrl}" style="width:75px;height:75px;display:block;">`;
  });
}

function buildPrintableRoot(qrMap, idPrefixBase) {
  const root = document.createElement('div');
  root.style.cssText = 'background:#fff;width:210mm;';
  const pageCount = Math.ceil(State.terms.length / TERMS_PER_PAGE);
  for (let p = 0; p < pageCount; p++) {
    const slice = State.terms.slice(p * TERMS_PER_PAGE, (p + 1) * TERMS_PER_PAGE);
    const holder = document.createElement('div');
    holder.innerHTML = buildPageHTML(slice, p + 1, pageCount, `${idPrefixBase}-p${p}`);
    root.appendChild(holder.firstElementChild);
    injectQRImages(root, qrMap, `${idPrefixBase}-p${p}`);
  }
  return root;
}

const PDFBuilder = {
  async save() {
    if (!State.terms.length) {
      alert('Keine Termine zum Exportieren!');
      return false;
    }

    const validation = validateAllTerms();
    validation.results.forEach(r => applyValidationState(document.querySelector(`.term-card[data-id="${r.id}"]`), r));
    if (!validation.isValid) {
      alert(!validation.cityValid ? 'Bitte Stadt ausfüllen.' : 'Bitte alle Pflichtfelder ausfüllen. PDF wurde nicht erstellt.');
      return false;
    }

    const qrMap = await collectQRDataUrls();
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;background:#fff;';
    const printable = buildPrintableRoot(qrMap, 'pdf');
    container.appendChild(printable);
    document.body.appendChild(container);
    await new Promise(r => setTimeout(r, 200));

    try {
      await html2pdf().set({
        margin: [0, 0, 0, 0],
        filename: buildPdfFilename(),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      }).from(printable).save();
      State.markSaved();
      return true;
    } finally {
      container.remove();
    }
  },
};

const PrintManager = {
  async print() {
    if (!State.terms.length) {
      alert('Keine Termine zum Drucken!');
      return false;
    }

    const validation = validateAllTerms();
    validation.results.forEach(r => applyValidationState(document.querySelector(`.term-card[data-id="${r.id}"]`), r));
    if (!validation.isValid) {
      alert(!validation.cityValid ? 'Bitte Stadt ausfüllen.' : 'Bitte alle Pflichtfelder ausfüllen. Druck wurde abgebrochen.');
      return false;
    }

    const qrMap = await collectQRDataUrls();
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    let pagesHTML = '';
    const pageCount = Math.ceil(State.terms.length / TERMS_PER_PAGE);
    for (let p = 0; p < pageCount; p++) {
      const slice = State.terms.slice(p * TERMS_PER_PAGE, (p + 1) * TERMS_PER_PAGE);
      pagesHTML += buildPageHTML(slice, p + 1, pageCount, `print-p${p}`);
    }

    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>FibraGen Print</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="css/main.css">
      <style>@page{size:A4;margin:0}html,body{background:#fff!important;margin:0;padding:0}</style>
    </head><body>${pagesHTML}</body></html>`);
    doc.close();

    setTimeout(() => {
      for (let p = 0; p < pageCount; p++) {
        const slice = State.terms.slice(p * TERMS_PER_PAGE, (p + 1) * TERMS_PER_PAGE);
        slice.forEach(term => {
          ['c', 'k'].forEach(type => {
            const dataUrl = qrMap[`${type}-${term.id}`];
            if (!dataUrl) return;
            const el = doc.getElementById(`print-p${p}-qrc-${type}-${term.id}`);
            if (el) el.innerHTML = `<img src="${dataUrl}" style="width:75px;height:75px;display:block;">`;
          });
        });
      }

      const cleanUp = () => setTimeout(() => iframe.remove(), 300);
      iframe.contentWindow.onafterprint = cleanUp;
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 150);
    }, 300);

    State.markSaved();
    return true;
  },
};

function initBeforeUnload() {
  window.addEventListener('beforeunload', e => {
    if (State.isDirty() && State.terms.length > 0) {
      e.preventDefault();
      e.returnValue = 'Sie haben Änderungen. Haben Sie bereits gespeichert oder gedruckt?';
    }
  });
}

window.FibraLogics = {
  State,
  TermManager,
  PreviewManager,
  PDFBuilder,
  PrintManager,
  refreshAllQRs,
  refreshQRs,
  initBeforeUnload,
  validateAllTerms,
  validateAndPaintTerm,
  validateCity,
};