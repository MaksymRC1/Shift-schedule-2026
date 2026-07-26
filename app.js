/**
 * Shift Schedule 2026+ Web Application & PWA
 * Algorithmic 5-Shift Generator with Multi-Year Support, Notes Persistence, QR Code Sharing, Feedback & Offline PWA Capabilities
 */

(function () {
  'use strict';

  // --- Register PWA Service Worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('Service Worker registered successfully with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('Service Worker registration failed:', err);
        });
    });
  }

  // --- Constants & Reference Engine Data ---
  const REF_DATE_UTC = Date.UTC(2026, 0, 1);
  const CYCLE_PATTERN = [1, 1, 1, null, null, 3, 3, 3, null, null, 2, 2, 2, null, null];
  const SHIFTS_LIST = ["А", "Б", "В", "Г", "Д"]; // Shifts А, Б, В, Г, Д
  const SHIFT_BASE_INDICES = { "А": 2, "Б": 11, "В": 13, "Г": 5, "Д": 4 };

  const MONTH_NAMES = [
    "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
    "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"
  ];

  const DAY_NAMES = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];

  // --- State ---
  const today = new Date();
  let currentYear = today.getFullYear() || 2026;
  let activeFilter = "all"; // 'all' or 'А', 'Б', 'В', 'Г', 'Д'
  let activeNoteTarget = null; // { dateKey, shiftGroup, year, month, day, shift }
  let selectedRating = 5;

  // --- Storage Helper ---
  const STORAGE_KEY_NOTES = "shift_schedule_notes_v2";
  const STORAGE_KEY_THEME = "shift_schedule_theme";
  const STORAGE_KEY_FEEDBACKS = "shift_schedule_feedbacks";

  function getStoredNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_NOTES);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error("Failed to read notes from localStorage", e);
      return {};
    }
  }

  function saveStoredNotes(notes) {
    try {
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes));
    } catch (e) {
      console.error("Failed to save notes to localStorage", e);
    }
  }

  function makeNoteKey(dateStr, shiftGroup) {
    return `${dateStr}_${shiftGroup}`;
  }

  function setNote(dateStr, shiftGroup, noteData) {
    const notes = getStoredNotes();
    const key = makeNoteKey(dateStr, shiftGroup);
    if (!noteData || (!noteData.text && !noteData.statusTag)) {
      delete notes[key];
    } else {
      notes[key] = noteData;
    }
    saveStoredNotes(notes);
  }

  // --- Toast Notifications ---
  function showToast(message, duration = 3000) {
    const toast = document.getElementById("toastNotification");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("active");
    setTimeout(() => {
      toast.classList.remove("active");
    }, duration);
  }

  // --- Shift Calculation Engine ---
  function calculateShift(shiftGroup, year, monthIdx, day) {
    const targetUtc = Date.UTC(year, monthIdx, day);
    const diffDays = Math.round((targetUtc - REF_DATE_UTC) / (86400 * 1000));
    const baseIdx = SHIFT_BASE_INDICES[shiftGroup];
    if (baseIdx === undefined) return null;

    let cycleIdx = (baseIdx + diffDays) % 15;
    if (cycleIdx < 0) cycleIdx += 15;

    return CYCLE_PATTERN[cycleIdx];
  }

  function formatDateKey(year, monthIdx, day) {
    const mm = String(monthIdx + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  // --- DOM Elements ---
  const yearInput = document.getElementById("yearInput");
  const btnPrevYear = document.getElementById("btnPrevYear");
  const btnNextYear = document.getElementById("btnNextYear");
  const calendarContainer = document.getElementById("calendarContainer");
  const btnThemeToggle = document.getElementById("btnThemeToggle");
  const btnNotesList = document.getElementById("btnNotesList");
  const btnPrint = document.getElementById("btnPrint");
  const btnQrCode = document.getElementById("btnQrCode");
  const btnFeedback = document.getElementById("btnFeedback");
  const shiftFilterButtons = document.querySelectorAll(".btn-filter");
  const quickYearButtons = document.querySelectorAll(".btn-year");

  // Modal Note Elements
  const noteModal = document.getElementById("noteModal");
  const btnCloseNoteModal = document.getElementById("btnCloseNoteModal");
  const btnCancelNote = document.getElementById("btnCancelNote");
  const btnSaveNote = document.getElementById("btnSaveNote");
  const btnDeleteNote = document.getElementById("btnDeleteNote");
  const modalDateTitle = document.getElementById("modalDateTitle");
  const noteStatusSelect = document.getElementById("noteStatusSelect");
  const noteTextInput = document.getElementById("noteTextInput");

  // Modal Notes List Elements
  const notesListModal = document.getElementById("notesListModal");
  const btnCloseNotesListModal = document.getElementById("btnCloseNotesListModal");
  const notesSearchInput = document.getElementById("notesSearchInput");
  const notesListContainer = document.getElementById("notesListContainer");

  // Modal QR Elements
  const qrModal = document.getElementById("qrModal");
  const btnCloseQrModal = document.getElementById("btnCloseQrModal");
  const qrImage = document.getElementById("qrImage");
  const qrUrlInput = document.getElementById("qrUrlInput");
  const btnCopyUrl = document.getElementById("btnCopyUrl");
  const btnShareNative = document.getElementById("btnShareNative");

  // Modal Feedback Elements
  const feedbackModal = document.getElementById("feedbackModal");
  const btnCloseFeedbackModal = document.getElementById("btnCloseFeedbackModal");
  const btnCancelFeedback = document.getElementById("btnCancelFeedback");
  const btnSubmitFeedback = document.getElementById("btnSubmitFeedback");
  const starRating = document.getElementById("starRating");
  const feedbackCategory = document.getElementById("feedbackCategory");
  const feedbackContact = document.getElementById("feedbackContact");
  const feedbackText = document.getElementById("feedbackText");

  // --- Theme Management ---
  function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", current);
    localStorage.setItem(STORAGE_KEY_THEME, current);
    updateThemeIcon(current);
  }

  function updateThemeIcon(theme) {
    if (btnThemeToggle) {
      btnThemeToggle.innerHTML = theme === "light" ? "🌙 Тема" : "☀️ Тема";
    }
  }

  // --- Calendar Renderer ---
  function renderApp() {
    yearInput.value = currentYear;

    quickYearButtons.forEach(btn => {
      if (parseInt(btn.dataset.year) === currentYear) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    calendarContainer.innerHTML = "";
    const notes = getStoredNotes();

    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const monthCard = renderMonthCard(currentYear, monthIdx, notes);
      calendarContainer.appendChild(monthCard);
    }

    renderStatistics(notes);
  }

  function renderMonthCard(year, monthIdx, notes) {
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

    const monthCard = document.createElement("div");
    monthCard.className = "month-card";

    const header = document.createElement("div");
    header.className = "month-header";
    header.innerHTML = `
      <div class="month-title">${MONTH_NAMES[monthIdx]} ${year}</div>
      <div class="month-meta">${daysInMonth} днів</div>
    `;
    monthCard.appendChild(header);

    const tableWrapper = document.createElement("div");
    tableWrapper.className = "table-wrapper";

    const table = document.createElement("table");
    table.className = "calendar-table";

    const thead = document.createElement("thead");
    const trHead1 = document.createElement("tr");

    const thEmpty = document.createElement("th");
    thEmpty.textContent = "Зміна";
    trHead1.appendChild(thEmpty);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, monthIdx, d);
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const th = document.createElement("th");
      th.textContent = d;
      if (isWeekend) th.classList.add("is-weekend");
      trHead1.appendChild(th);
    }
    thead.appendChild(trHead1);

    const trHead2 = document.createElement("tr");
    const thSubEmpty = document.createElement("th");
    thSubEmpty.textContent = "";
    trHead2.appendChild(thSubEmpty);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, monthIdx, d);
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const th = document.createElement("th");
      th.textContent = DAY_NAMES[dayOfWeek];
      if (isWeekend) th.classList.add("is-weekend");
      trHead2.appendChild(th);
    }
    thead.appendChild(trHead2);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const visibleShifts = activeFilter === "all" ? SHIFTS_LIST : [activeFilter];

    visibleShifts.forEach(shiftGroup => {
      const tr = document.createElement("tr");

      const tdLabel = document.createElement("td");
      tdLabel.textContent = shiftGroup;
      tr.appendChild(tdLabel);

      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, monthIdx, d);
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dateStr = formatDateKey(year, monthIdx, d);

        const shiftVal = calculateShift(shiftGroup, year, monthIdx, d);
        const td = document.createElement("td");
        td.className = "cell-day";

        if (shiftVal === 1) td.classList.add("cell-shift-1");
        else if (shiftVal === 2) td.classList.add("cell-shift-2");
        else if (shiftVal === 3) td.classList.add("cell-shift-3");
        else td.classList.add("cell-shift-off");

        if (isWeekend) td.classList.add("cell-is-weekend");

        if (year === today.getFullYear() && monthIdx === today.getMonth() && d === today.getDate()) {
          td.classList.add("cell-today");
        }

        td.textContent = shiftVal !== null ? shiftVal : "";

        const noteKey = makeNoteKey(dateStr, shiftGroup);
        const note = notes[noteKey];

        if (note) {
          const dot = document.createElement("span");
          dot.className = "note-dot";
          td.appendChild(dot);

          if (note.statusTag && note.statusTag !== "normal") {
            const badge = document.createElement("span");
            badge.className = "custom-status-badge";
            badge.textContent = note.statusTag;
            td.appendChild(badge);
          }

          let tooltip = `${dateStr} [Зміна ${shiftGroup}]: `;
          if (note.statusTag) tooltip += `[${note.statusTag}] `;
          if (note.text) tooltip += note.text;
          td.title = tooltip;
        } else {
          td.title = `${MONTH_NAMES[monthIdx]} ${d}, ${year} - Зміна ${shiftGroup}`;
        }

        td.addEventListener("click", () => {
          openNoteModal({
            dateStr,
            shiftGroup,
            year,
            monthIdx,
            day: d,
            shift: shiftVal,
            note
          });
        });

        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    monthCard.appendChild(tableWrapper);

    return monthCard;
  }

  // --- Statistics Renderer ---
  function renderStatistics(notes) {
    const statsGrid = document.getElementById("statsGrid");
    if (!statsGrid) return;

    let totalShifts = 0;
    let countShift1 = 0;
    let countShift2 = 0;
    let countShift3 = 0;
    let countOff = 0;
    let countVacation = 0;

    const targetShifts = activeFilter === "all" ? SHIFTS_LIST : [activeFilter];

    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const daysInMonth = new Date(currentYear, monthIdx + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = formatDateKey(currentYear, monthIdx, d);

        targetShifts.forEach(sg => {
          const shiftVal = calculateShift(sg, currentYear, monthIdx, d);
          if (shiftVal === 1) countShift1++;
          else if (shiftVal === 2) countShift2++;
          else if (shiftVal === 3) countShift3++;
          else countOff++;

          const note = notes[makeNoteKey(dateStr, sg)];
          if (note && note.statusTag === "🏖️ Відпустка") {
            countVacation++;
          }
        });
      }
    }

    totalShifts = countShift1 + countShift2 + countShift3;
    const filterTitle = activeFilter === "all" ? "Всі зміни" : `Зміна ${activeFilter}`;

    statsGrid.innerHTML = `
      <div class="stat-card">
        <div class="stat-info">
          <div class="stat-label">Робочих змін (${filterTitle})</div>
          <div class="stat-value">${totalShifts}</div>
        </div>
        <div class="stat-icon" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">📅</div>
      </div>
      <div class="stat-card">
        <div class="stat-info">
          <div class="stat-label">Зміна 1 (Ранок)</div>
          <div class="stat-value" style="color: var(--shift-1-text);">${countShift1}</div>
        </div>
        <div class="stat-icon" style="background: var(--shift-1-bg); color: var(--shift-1-text);">🌅</div>
      </div>
      <div class="stat-card">
        <div class="stat-info">
          <div class="stat-label">Зміна 2 (Вечір)</div>
          <div class="stat-value" style="color: var(--shift-2-text);">${countShift2}</div>
        </div>
        <div class="stat-icon" style="background: var(--shift-2-bg); color: var(--shift-2-text);">🏙️</div>
      </div>
      <div class="stat-card">
        <div class="stat-info">
          <div class="stat-label">Зміна 3 (Ніч)</div>
          <div class="stat-value" style="color: var(--shift-3-text);">${countShift3}</div>
        </div>
        <div class="stat-icon" style="background: var(--shift-3-bg); color: var(--shift-3-text);">🌙</div>
      </div>
      <div class="stat-card">
        <div class="stat-info">
          <div class="stat-label">Вихідних / Відпусток</div>
          <div class="stat-value">${countOff} / ${countVacation}</div>
        </div>
        <div class="stat-icon" style="background: rgba(236, 72, 153, 0.15); color: #ec4899;">🏖️</div>
      </div>
    `;
  }

  // --- Note Modal Logic ---
  function openNoteModal(data) {
    activeNoteTarget = data;
    const shiftText = data.shift ? `Зміна ${data.shift}` : "Вихідний";
    modalDateTitle.textContent = `${data.dateStr} (Зміна ${data.shiftGroup}) — ${shiftText}`;

    if (data.note) {
      noteStatusSelect.value = data.note.statusTag || "normal";
      noteTextInput.value = data.note.text || "";
    } else {
      noteStatusSelect.value = "normal";
      noteTextInput.value = "";
    }

    noteModal.classList.add("active");
  }

  function closeNoteModal() {
    noteModal.classList.remove("active");
    activeNoteTarget = null;
  }

  function handleSaveNote() {
    if (!activeNoteTarget) return;

    const statusTag = noteStatusSelect.value;
    const text = noteTextInput.value.trim();

    if (statusTag === "normal" && !text) {
      setNote(activeNoteTarget.dateStr, activeNoteTarget.shiftGroup, null);
    } else {
      setNote(activeNoteTarget.dateStr, activeNoteTarget.shiftGroup, {
        statusTag,
        text,
        updatedAt: new Date().toISOString()
      });
    }

    closeNoteModal();
    renderApp();
    showToast("Нотатку збережено");
  }

  function handleDeleteNote() {
    if (!activeNoteTarget) return;
    setNote(activeNoteTarget.dateStr, activeNoteTarget.shiftGroup, null);
    closeNoteModal();
    renderApp();
    showToast("Нотатку видалено");
  }

  // --- Notes List Drawer Logic ---
  function openNotesListModal() {
    renderNotesList();
    notesListModal.classList.add("active");
  }

  function closeNotesListModal() {
    notesListModal.classList.remove("active");
  }

  function renderNotesList() {
    const notes = getStoredNotes();
    const query = (notesSearchInput.value || "").toLowerCase().trim();
    notesListContainer.innerHTML = "";

    const keys = Object.keys(notes).sort();

    if (keys.length === 0) {
      notesListContainer.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 24px;">Нотатки відсутні</div>`;
      return;
    }

    let count = 0;
    keys.forEach(key => {
      const note = notes[key];
      const parts = key.split("_");
      const dateStr = parts[0];
      const shiftGroup = parts[1];

      const fullText = `${dateStr} ${shiftGroup} ${note.statusTag || ''} ${note.text || ''}`.toLowerCase();
      if (query && !fullText.includes(query)) return;

      count++;
      const item = document.createElement("div");
      item.className = "note-item";
      item.innerHTML = `
        <div>
          <div class="note-meta">📅 ${dateStr} | Зміна ${shiftGroup} ${note.statusTag ? `[${note.statusTag}]` : ''}</div>
          <div class="note-text">${escapeHtml(note.text || 'Без тексту')}</div>
        </div>
        <button class="btn-delete-note" title="Видалити">🗑️</button>
      `;

      item.querySelector(".btn-delete-note").addEventListener("click", (e) => {
        e.stopPropagation();
        setNote(dateStr, shiftGroup, null);
        renderNotesList();
        renderApp();
        showToast("Нотатку видалено");
      });

      notesListContainer.appendChild(item);
    });

    if (count === 0) {
      notesListContainer.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 24px;">Нічого не знайдено за запитом "${query}"</div>`;
    }
  }

  // --- QR Code Modal Logic ---
  function openQrModal() {
    const currentUrl = window.location.href;
    qrUrlInput.value = currentUrl;

    // Use QR Code API to generate QR Code SVG/PNG
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(currentUrl)}&margin=10`;
    qrImage.src = qrApiUrl;

    qrModal.classList.add("active");
  }

  function closeQrModal() {
    qrModal.classList.remove("active");
  }

  function copyUrlToClipboard() {
    const url = qrUrlInput.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        showToast("📋 Посилання скопійовано в буфер обміну!");
      }).catch(() => {
        fallbackCopyText(url);
      });
    } else {
      fallbackCopyText(url);
    }
  }

  function fallbackCopyText(text) {
    qrUrlInput.select();
    document.execCommand('copy');
    showToast("📋 Посилання скопійовано!");
  }

  function shareNativeUrl() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: "Графік змін",
        text: "Перегляд графіка змін 2025-2030+",
        url: url
      }).catch((err) => console.log('Share canceled', err));
    } else {
      copyUrlToClipboard();
    }
  }

  // --- Feedback Modal Logic ---
  function openFeedbackModal() {
    feedbackText.value = "";
    feedbackContact.value = "";
    selectedRating = 5;
    updateStarUI(5);
    feedbackModal.classList.add("active");
  }

  function closeFeedbackModal() {
    feedbackModal.classList.remove("active");
  }

  function updateStarUI(rating) {
    const stars = starRating.querySelectorAll("span");
    stars.forEach(s => {
      const val = parseInt(s.dataset.star);
      if (val <= rating) {
        s.classList.add("active");
      } else {
        s.classList.remove("active");
      }
    });
  }

  function submitFeedback() {
    const category = feedbackCategory.value;
    const contact = feedbackContact.value.trim();
    const text = feedbackText.value.trim();

    if (!text) {
      showToast("Будь ласка, введіть текст вашого повідомлення");
      return;
    }

    // Save locally
    const feedbacks = JSON.parse(localStorage.getItem(STORAGE_KEY_FEEDBACKS) || "[]");
    feedbacks.push({
      date: new Date().toISOString(),
      rating: selectedRating,
      category,
      contact,
      text
    });
    localStorage.setItem(STORAGE_KEY_FEEDBACKS, JSON.stringify(feedbacks));

    closeFeedbackModal();
    showToast("Дякуємо за ваш відгук! ❤️");
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    btnPrevYear.addEventListener("click", () => {
      currentYear--;
      renderApp();
    });

    btnNextYear.addEventListener("click", () => {
      currentYear++;
      renderApp();
    });

    yearInput.addEventListener("change", () => {
      const val = parseInt(yearInput.value);
      if (!isNaN(val) && val >= 1900 && val <= 2100) {
        currentYear = val;
        renderApp();
      }
    });

    quickYearButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        currentYear = parseInt(btn.dataset.year);
        renderApp();
      });
    });

    shiftFilterButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        shiftFilterButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.dataset.filter;
        renderApp();
      });
    });

    if (btnThemeToggle) btnThemeToggle.addEventListener("click", toggleTheme);
    if (btnPrint) btnPrint.addEventListener("click", () => window.print());

    // Modal Note Listeners
    if (btnCloseNoteModal) btnCloseNoteModal.addEventListener("click", closeNoteModal);
    if (btnCancelNote) btnCancelNote.addEventListener("click", closeNoteModal);
    if (btnSaveNote) btnSaveNote.addEventListener("click", handleSaveNote);
    if (btnDeleteNote) btnDeleteNote.addEventListener("click", handleDeleteNote);

    // Modal Notes List Listeners
    if (btnNotesList) btnNotesList.addEventListener("click", openNotesListModal);
    if (btnCloseNotesListModal) btnCloseNotesListModal.addEventListener("click", closeNotesListModal);
    if (notesSearchInput) notesSearchInput.addEventListener("input", renderNotesList);

    // Modal QR Code Listeners
    if (btnQrCode) btnQrCode.addEventListener("click", openQrModal);
    if (btnCloseQrModal) btnCloseQrModal.addEventListener("click", closeQrModal);
    if (btnCopyUrl) btnCopyUrl.addEventListener("click", copyUrlToClipboard);
    if (btnShareNative) btnShareNative.addEventListener("click", shareNativeUrl);

    // Modal Feedback Listeners
    if (btnFeedback) btnFeedback.addEventListener("click", openFeedbackModal);
    if (btnCloseFeedbackModal) btnCloseFeedbackModal.addEventListener("click", closeFeedbackModal);
    if (btnCancelFeedback) btnCancelFeedback.addEventListener("click", closeFeedbackModal);
    if (btnSubmitFeedback) btnSubmitFeedback.addEventListener("click", submitFeedback);

    if (starRating) {
      const stars = starRating.querySelectorAll("span");
      stars.forEach(star => {
        star.addEventListener("click", () => {
          selectedRating = parseInt(star.dataset.star);
          updateStarUI(selectedRating);
        });
      });
    }

    // Close modals on backdrop click
    [noteModal, notesListModal, qrModal, feedbackModal].forEach(modal => {
      if (modal) {
        modal.addEventListener("click", (e) => {
          if (e.target === modal) {
            modal.classList.remove("active");
          }
        });
      }
    });
  }

  // --- Initialization ---
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    setupEventListeners();
    renderApp();
  });

})();
