'use strict';

/**
 * CalendarPicker — лёгкий адаптивный датапикер без зависимостей.
 * Экспортирует объект window.CalendarPicker.
 *
 * API:
 *   CalendarPicker.init()            — вызвать один раз из main.js
 *   CalendarPicker.getDate()         — возвращает Date (выбранная или сегодня)
 *   CalendarPicker.getFormatted()    — возвращает строку "dd.mm.yyyy"
 *   CalendarPicker.onChange(fn)      — подписка: fn(date, formattedString)
 */

(function () {
  // ── вспомогательные функции ──────────────────────────────────────────────

  function pad(n) { return String(n).padStart(2, '0'); }

  function formatDisplay(date) {
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  }

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  }

  // ── состояние ─────────────────────────────────────────────────────────────

  let _selectedDate = null;   // null = сегодня
  let _viewYear  = new Date().getFullYear();
  let _viewMonth = new Date().getMonth();   // 0-based
  let _isOpen    = false;
  let _listeners = [];

  // ── DOM-узлы (заполняются в init) ─────────────────────────────────────────

  let _wrapper, _trigger, _label, _popup, _grid;

  // ── уведомление подписчиков ───────────────────────────────────────────────

  function _notify() {
    const d = CalendarPicker.getDate();
    const s = formatDisplay(d);
    _listeners.forEach(fn => fn(d, s));
  }

  // ── открыть / закрыть попап ───────────────────────────────────────────────

  function _open() {
    // Если дата выбрана — показываем её месяц, иначе текущий
    const base = _selectedDate ? _selectedDate : new Date();
    _viewYear  = base.getFullYear();
    _viewMonth = base.getMonth();
    _renderCalendar();
    _popup.classList.add('cal-popup--open');
    _isOpen = true;
    // позиционируем попап (адаптивно)
    _reposition();
  }

  function _close() {
    _popup.classList.remove('cal-popup--open');
    _isOpen = false;
  }

  function _toggle() {
    _isOpen ? _close() : _open();
  }

  // ── позиционирование: попап открывается вниз, но если места нет — вверх ──

  function _reposition() {
    const rect = _wrapper.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const popupH = 300; // примерная высота

    if (spaceBelow < popupH && spaceAbove > spaceBelow) {
      _popup.style.bottom = (rect.height + 6) + 'px';
      _popup.style.top = 'auto';
    } else {
      _popup.style.top = (rect.height + 6) + 'px';
      _popup.style.bottom = 'auto';
    }
  }

  // ── рендер сетки месяца ───────────────────────────────────────────────────

  function _renderCalendar() {
    const today    = startOfDay(new Date());
    const selected = _selectedDate ? startOfDay(_selectedDate) : null;

    const months = ['Januar','Februar','März','April','Mai','Juni',
                    'Juli','August','September','Oktober','November','Dezember'];

    // Заголовок: кнопки ←  Месяц Год  →
    _popup.querySelector('.cal-header-title').textContent =
      `${months[_viewMonth]} ${_viewYear}`;

    // Очищаем сетку (кроме строки заголовков дней)
    const dayNames = _grid.querySelector('.cal-daynames');
    _grid.innerHTML = '';
    _grid.appendChild(dayNames);

    // Первый день месяца (0=Вс, переводим к Пн=0)
    const firstDay = new Date(_viewYear, _viewMonth, 1);
    let startDow = firstDay.getDay(); // 0=Sun
    startDow = (startDow === 0) ? 6 : startDow - 1; // Пн=0

    const daysInMonth  = new Date(_viewYear, _viewMonth + 1, 0).getDate();
    const daysInPrev   = new Date(_viewYear, _viewMonth, 0).getDate();

    let cellCount = 0;

    // Серые дни предыдущего месяца
    for (let i = startDow - 1; i >= 0; i--) {
      _grid.appendChild(_makeCell(daysInPrev - i, true, false, false));
      cellCount++;
    }

    // Дни текущего месяца
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(_viewYear, _viewMonth, d);
      const isToday    = sameDay(date, today);
      const isSelected = selected && sameDay(date, selected);
      const cell = _makeCell(d, false, isToday, isSelected);
      cell.dataset.ts = date.getTime();
      cell.addEventListener('click', _onDayClick);
      _grid.appendChild(cell);
      cellCount++;
    }

    // Серые дни следующего месяца
    let next = 1;
    while (cellCount % 7 !== 0) {
      _grid.appendChild(_makeCell(next++, true, false, false));
      cellCount++;
    }
  }

  function _makeCell(day, dim, isToday, isSelected) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = day;
    btn.className = 'cal-day';
    if (dim)        btn.classList.add('cal-day--dim');
    if (isToday)    btn.classList.add('cal-day--today');
    if (isSelected) btn.classList.add('cal-day--selected');
    if (dim)        btn.disabled = true;
    return btn;
  }

  // ── клик по дню ──────────────────────────────────────────────────────────

  function _onDayClick(e) {
    const ts = Number(e.currentTarget.dataset.ts);
    if (!ts) return;
    _selectedDate = new Date(ts);
    _updateLabel();
    _close();
    _notify();
  }

  // ── обновить текст триггер-кнопки ─────────────────────────────────────────

  function _updateLabel() {
    const today = startOfDay(new Date());
    if (!_selectedDate || sameDay(_selectedDate, today)) {
      _label.textContent = 'Heute';
      _label.classList.remove('cal-label--picked');
    } else {
      _label.textContent = formatDisplay(_selectedDate);
      _label.classList.add('cal-label--picked');
    }
  }

  // ── построение DOM ────────────────────────────────────────────────────────

  function _buildDOM() {
    // ── обёртка ──
    _wrapper = document.createElement('div');
    _wrapper.className = 'cal-wrapper';

    // ── кнопка-триггер ──
    _trigger = document.createElement('button');
    _trigger.type = 'button';
    _trigger.className = 'btn btn-ghost cal-trigger';
    _trigger.title = 'Datum für das Dokument wählen';
    _trigger.innerHTML = `
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15">
        <rect x="2" y="4" width="16" height="14" rx="2"/>
        <path d="M6 2v4M14 2v4M2 9h16"/>
      </svg>
      <span class="cal-label">Heute</span>`;

    _label = _trigger.querySelector('.cal-label');

    // ── попап ──
    _popup = document.createElement('div');
    _popup.className = 'cal-popup';
    _popup.innerHTML = `
      <div class="cal-header">
        <button type="button" class="cal-nav cal-nav--prev" aria-label="Vorheriger Monat">&#8249;</button>
        <span class="cal-header-title"></span>
        <button type="button" class="cal-nav cal-nav--next" aria-label="Nächster Monat">&#8250;</button>
      </div>
      <div class="cal-grid">
        <div class="cal-daynames">
          <span>Mo</span><span>Di</span><span>Mi</span>
          <span>Do</span><span>Fr</span><span>Sa</span><span>So</span>
        </div>
      </div>
      <div class="cal-footer">
        <button type="button" class="cal-btn-today">Heute</button>
        <button type="button" class="cal-btn-tomorrow">Morgen</button>
        <button type="button" class="cal-btn-clear">Zurücksetzen</button>
      </div>`;

    _grid = _popup.querySelector('.cal-grid');

    // Навигация по месяцам
    _popup.querySelector('.cal-nav--prev').addEventListener('click', () => {
      _viewMonth--;
      if (_viewMonth < 0) { _viewMonth = 11; _viewYear--; }
      _renderCalendar();
    });
    _popup.querySelector('.cal-nav--next').addEventListener('click', () => {
      _viewMonth++;
      if (_viewMonth > 11) { _viewMonth = 0; _viewYear++; }
      _renderCalendar();
    });

    // Кнопки быстрого выбора
    _popup.querySelector('.cal-btn-today').addEventListener('click', () => {
      _selectedDate = null;
      _updateLabel();
      _close();
      _notify();
    });
    _popup.querySelector('.cal-btn-tomorrow').addEventListener('click', () => {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      _selectedDate = startOfDay(t);
      _updateLabel();
      _close();
      _notify();
    });
    _popup.querySelector('.cal-btn-clear').addEventListener('click', () => {
      _selectedDate = null;
      _updateLabel();
      _close();
      _notify();
    });

    _wrapper.appendChild(_trigger);
    _wrapper.appendChild(_popup);

    // Клик по триггеру
    _trigger.addEventListener('click', _toggle);

    // Закрыть при клике вне
    document.addEventListener('click', (e) => {
      if (_isOpen && !_wrapper.contains(e.target)) _close();
    }, true);

    // Закрыть по Escape
    document.addEventListener('keydown', (e) => {
      if (_isOpen && e.key === 'Escape') _close();
    });
  }

  // ── публичный объект ──────────────────────────────────────────────────────

  const CalendarPicker = {
    init() {
      _buildDOM();

      // Вставляем: после multi-city-toggle переключателя, перед разделителем (divider)
      const headerActions = document.querySelector('.header-actions');
      const divider = headerActions ? headerActions.querySelector('.header-divider') : null;

      if (divider) {
        headerActions.insertBefore(_wrapper, divider);
      } else if (headerActions) {
        headerActions.prepend(_wrapper);
      }
    },

    getDate() {
      return _selectedDate ? new Date(_selectedDate) : startOfDay(new Date());
    },

    getFormatted() {
      return formatDisplay(this.getDate());
    },

    onChange(fn) {
      if (typeof fn === 'function') _listeners.push(fn);
    },
  };

  window.CalendarPicker = CalendarPicker;
})();
