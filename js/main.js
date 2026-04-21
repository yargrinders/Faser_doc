'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const Fibra = window.FibraLogics;

  if (!Fibra) {
    console.error('FibraLogics was not loaded. Check js/modules/logics.js path.');
    return;
  }

  const {
    State,
    TermManager,
    PreviewManager,
    PDFBuilder,
    PrintManager,
    refreshAllQRs,
    initBeforeUnload,
    validateCity,
    toggleMultiCity,
  } = Fibra;

  TermManager.init(document.getElementById('terms-list'));
  PreviewManager.init(
    document.getElementById('preview-pages'),
    document.getElementById('preview-count')
  );

  const cityEl = document.getElementById('global-city');
  cityEl.addEventListener('input', () => {
    State.setCity(cityEl.value);
    validateCity();
    refreshAllQRs();
    PreviewManager.render();
  });

  const multiToggle = document.getElementById('multi-city-toggle');
  multiToggle.addEventListener('change', () => {
    toggleMultiCity(multiToggle.checked);
    validateCity();
  });

  document.getElementById('btn-add-term').addEventListener('click', () => {
    TermManager.add();
  });

  document.getElementById('btn-pdf').addEventListener('click', async () => {
    const btn = document.getElementById('btn-pdf');
    btn.disabled = true;
    btn.innerHTML = '⏳ Generiere PDF…';
    try {
      await PDFBuilder.save();
    } catch (error) {
      console.error(error);
      alert('PDF konnte nicht erstellt werden. Bitte Konsole prüfen.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15">
        <path d="M11.5 2H5a1 1 0 00-1 1v14a1 1 0 001 1h10a1 1 0 001-1V7.5L11.5 2z"/>
        <path d="M11 2v6h6M10 10v5M8 13l2 2 2-2"/>
      </svg> PDF speichern`;
    }
  });

  document.getElementById('btn-print').addEventListener('click', async () => {
    try {
      await PrintManager.print();
    } catch (error) {
      console.error(error);
      alert('Druck konnte nicht gestartet werden.');
    }
  });

  // ── Календарь ──────────────────────────────────────────────────────────
  if (window.CalendarPicker) {
    CalendarPicker.init();
    // При смене даты — перерисовываем превью (дата обновится через getDocDate())
    CalendarPicker.onChange(() => {
      PreviewManager.render();
    });
  }

  initBeforeUnload();
  validateCity();
  TermManager.add();
});