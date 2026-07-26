/**
 * Shift Schedule 2026+ Web Application & PWA
 * Algorithmic 5-Shift Generator with Multi-Year Support, Notes Persistence, Auto-Focus Today, User Statistics & Telegram Integration
 */

(function () {
  'use strict';

  // --- Register PWA Service Worker with Auto Update ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('Service Worker registered with scope:', reg.scope);
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New Service Worker content available; refreshing...');
                  window.location.reload();
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('Service Worker registration failed:', err);
        });
    });
  }

  // --- Constants & Reference Engine Data ---
  const REF_DATE_UTC = Date.UTC(2026, 0, 1);
  const CYCLE_PATTERN = [1, 1, 1, null, null, 3, 3, 3, null, null, 2, 2, 2, null, null];
  const SHIFTS_LIST = ["А", "Б", "В", "Г", "Д"];
  const SHIFT_BASE_INDICES = { "А": 2, "Б": 11, "В": 13, "Г": 5, "Д": 4 };

  const MONTH_NAMES = [
    "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
    "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"
  ];

  const DAY_NAMES = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];

  // Default Telegram Bot Config & Recipient Chat ID
  const DEFAULT_TG_BOT_TOKEN = atob("ODYzMDU3NTgyODpBQUZQMk1VbV9nakJsYl9pTXZsaF9HX2xmaXZPSlpyN1B2UQ==");
  const DEFAULT_TG_CHAT_ID = "1465938737"; // User Chat ID (Максим)

  // --- State ---
  const today = new Date();
  let currentYear = today.getFullYear() || 2026;
  let activeFilter = "all";
  let activeNoteTarget = null;
  let selectedRating = 5;

  // --- Storage Keys ---
  const STORAGE_KEY_NOTES = "shift_schedule_notes_v2";
  const STORAGE_KEY_THEME = "shift_schedule_theme";
  const STORAGE_KEY_FEEDBACKS = "shift_schedule_feedbacks";
  const STORAGE_KEY_USAGE_STATS = "shift_schedule_usage_stats_v1";
  const STORAGE_KEY_TG_TOKEN = "telegram_bot_token";
  const STORAGE_KEY_TG_CHAT_ID = "telegram_chat_id";

  // Track User Usage Statistics
  function trackUsage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USAGE_STATS);
      const stats = raw ? JSON.parse(raw) : {
        visitCount: 0,
        firstVisit: new Date().toISOString(),
        lastVisit: new Date().toISOString()
      };
      stats.visitCount = (stats.visitCount || 0) + 1;
      stats.lastVisit = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY_USAGE_STATS, JSON.stringify(stats));
      return stats;
    } catch (e) {
      console.error("Failed to track usage stats", e);
      return { visitCount: 1, firstVisit: new Date().toISOString(), lastVisit: new Date().toISOString() };
    }
  }

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

  // --- Modal Scroll-Lock Helper ---
  function updateModalScrollLock() {
    const activeModals = document.querySelectorAll(".modal-backdrop.active");
    if (activeModals.length > 0) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
  }

  // --- Toast Notifications ---
  function showToast(message, duration = 3500) {
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
  const btnStats = document.getElementById("btnStats");
  const shiftFilterButtons = document.querySelectorAll(".btn-filter");

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

  // Modal User Stats Elements
  const statsModal = document.getElementById("statsModal");
  const btnCloseStatsModal = document.getElementById("btnCloseStatsModal");
  const btnCloseStatsModalBtn = document.getElementById("btnCloseStatsModalBtn");
  const btnSendStatsTg = document.getElementById("btnSendStatsTg");
  const statsModalBody = document.getElementById("statsModalBody");

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

  const tgTokenInput = document.getElementById("tgTokenInput");
  const tgChatIdInput = document.getElementById("tgChatIdInput");
  const btnToggleTgSettings = document.getElementById("btnToggleTgSettings");
  const tgSettingsPanel = document.getElementById("tgSettingsPanel");

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

  // --- Auto Scroll & Focus to Today's Date ---
  function scrollToToday() {
    setTimeout(() => {
      const todayCell = document.querySelector(".cell-today");
      if (todayCell) {
        todayCell.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    }, 400);
  }

  // --- Calendar Renderer ---
  function renderApp() {
    yearInput.value = currentYear;

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
    updateModalScrollLock();
  }

  function closeNoteModal() {
    noteModal.classList.remove("active");
    activeNoteTarget = null;
    updateModalScrollLock();
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
    updateModalScrollLock();
  }

  function closeNotesListModal() {
    notesListModal.classList.remove("active");
    updateModalScrollLock();
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

  // --- User Statistics Modal & Telegram Reporting ---
  function openStatsModal() {
    const usage = trackUsage();
    const notes = getStoredNotes();
    const notesCount = Object.keys(notes).length;
    const feedbacksCount = JSON.parse(localStorage.getItem(STORAGE_KEY_FEEDBACKS) || "[]").length;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    statsModalBody.innerHTML = `
      <div class="user-stats-list">
        <div class="user-stat-row">
          <span class="stat-name">Кількість візитів / відкриттів:</span>
          <span class="stat-val">${usage.visitCount || 1}</span>
        </div>
        <div class="user-stat-row">
          <span class="stat-name">Перший візит:</span>
          <span class="stat-val">${new Date(usage.firstVisit).toLocaleDateString('uk-UA')}</span>
        </div>
        <div class="user-stat-row">
          <span class="stat-name">Останній вхід:</span>
          <span class="stat-val">${new Date(usage.lastVisit).toLocaleString('uk-UA')}</span>
        </div>
        <div class="user-stat-row">
          <span class="stat-name">Збережено нотаток:</span>
          <span class="stat-val">${notesCount}</span>
        </div>
        <div class="user-stat-row">
          <span class="stat-name">Надіслано відгуків:</span>
          <span class="stat-val">${feedbacksCount}</span>
        </div>
        <div class="user-stat-row">
          <span class="stat-name">Поточний рік перегляду:</span>
          <span class="stat-val">${currentYear}</span>
        </div>
        <div class="user-stat-row">
          <span class="stat-name">Режим додатку:</span>
          <span class="stat-val">${isStandalone ? '📱 PWA Додаток' : '🌐 Веб-браузер'}</span>
        </div>
      </div>
    `;

    statsModal.classList.add("active");
    updateModalScrollLock();
  }

  function closeStatsModal() {
    statsModal.classList.remove("active");
    updateModalScrollLock();
  }

  function sendStatsToTelegram() {
    const usage = trackUsage();
    const notes = getStoredNotes();
    const notesCount = Object.keys(notes).length;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    const userCustomToken = localStorage.getItem(STORAGE_KEY_TG_TOKEN);
    const token = (userCustomToken && userCustomToken.trim()) ? userCustomToken.trim() : DEFAULT_TG_BOT_TOKEN;

    const userCustomChatId = localStorage.getItem(STORAGE_KEY_TG_CHAT_ID);
    const chatId = (userCustomChatId && userCustomChatId.trim()) ? userCustomChatId.trim() : DEFAULT_TG_CHAT_ID;

    const statsMsg = `
📊 <b>Звіт статистики використання додатку!</b>

👤 <b>Візитів всього:</b> ${usage.visitCount || 1}
📅 <b>Перший вхід:</b> ${new Date(usage.firstVisit).toLocaleDateString('uk-UA')}
⏰ <b>Останній вхід:</b> ${new Date(usage.lastVisit).toLocaleString('uk-UA')}
📝 <b>Створено нотаток:</b> ${notesCount}
🗓️ <b>Перегляд року:</b> ${currentYear}
🔍 <b>Фільтр зміни:</b> ${activeFilter === 'all' ? 'Всі зміни' : `Зміна ${activeFilter}`}
📲 <b>Платформа:</b> ${isStandalone ? '📱 PWA Standalone' : '🌐 Browser'}
    `.trim();

    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: statsMsg,
        parse_mode: 'HTML'
      })
    }).then(res => res.json()).then(data => {
      if (data.ok) {
        showToast("Статистику надіслано в Telegram! 📊");
        closeStatsModal();
      } else {
        showToast("Не вдалося надіслати статистику в Telegram");
      }
    }).catch(err => {
      console.error("Failed to send stats to Telegram:", err);
      showToast("Помилка відправки статистики");
    });
  }

  // --- QR Code Modal Logic ---
  function openQrModal() {
    const currentUrl = window.location.href;
    qrUrlInput.value = currentUrl;

    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(currentUrl)}&margin=10`;
    qrImage.src = qrApiUrl;

    qrModal.classList.add("active");
    updateModalScrollLock();
  }

  function closeQrModal() {
    qrModal.classList.remove("active");
    updateModalScrollLock();
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

  // --- Feedback & Telegram Bot Handler ---
  function openFeedbackModal() {
    feedbackText.value = "";
    feedbackContact.value = "";
    selectedRating = 5;
    updateStarUI(5);

    if (tgTokenInput) tgTokenInput.value = localStorage.getItem(STORAGE_KEY_TG_TOKEN) || DEFAULT_TG_BOT_TOKEN;
    if (tgChatIdInput) tgChatIdInput.value = localStorage.getItem(STORAGE_KEY_TG_CHAT_ID) || DEFAULT_TG_CHAT_ID;

    feedbackModal.classList.add("active");
    updateModalScrollLock();
  }

  function closeFeedbackModal() {
    feedbackModal.classList.remove("active");
    updateModalScrollLock();
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

  function sendTelegramMessage(token, chatId, feedbackData) {
    const stars = "⭐".repeat(feedbackData.rating);
    const textMessage = `
⚡ <b>Новий відгук з додатку Графік змін!</b>

<b>Оцінка:</b> ${stars} (${feedbackData.rating}/5)
<b>Категорія:</b> ${feedbackData.category}
<b>Контакт:</b> ${feedbackData.contact || 'Не вказано'}
<b>Дата:</b> ${new Date().toLocaleString('uk-UA')}

<b>Текст відгуку:</b>
${escapeHtml(feedbackData.text)}
    `.trim();

    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: textMessage,
        parse_mode: 'HTML'
      })
    }).then(res => res.json()).then(data => {
      if (data.ok) {
        console.log("Telegram notification sent successfully to chat", chatId);
        showToast("Відгук надіслано в Telegram! Дякуємо! ❤️");
      } else {
        console.warn("Telegram API error:", data);
        showToast("Відгук збережено локально");
      }
    }).catch(err => {
      console.error("Failed to send Telegram notification:", err);
      showToast("Відгук збережено локально");
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

    const feedbackData = {
      date: new Date().toISOString(),
      rating: selectedRating,
      category,
      contact,
      text
    };

    const feedbacks = JSON.parse(localStorage.getItem(STORAGE_KEY_FEEDBACKS) || "[]");
    feedbacks.push(feedbackData);
    localStorage.setItem(STORAGE_KEY_FEEDBACKS, JSON.stringify(feedbacks));

    const userCustomToken = localStorage.getItem(STORAGE_KEY_TG_TOKEN);
    const token = (userCustomToken && userCustomToken.trim()) ? userCustomToken.trim() : DEFAULT_TG_BOT_TOKEN;

    const userCustomChatId = localStorage.getItem(STORAGE_KEY_TG_CHAT_ID);
    const chatId = (userCustomChatId && userCustomChatId.trim()) ? userCustomChatId.trim() : DEFAULT_TG_CHAT_ID;

    sendTelegramMessage(token, chatId, feedbackData);

    closeFeedbackModal();
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

    // Modal User Stats Listeners
    if (btnStats) btnStats.addEventListener("click", openStatsModal);
    if (btnCloseStatsModal) btnCloseStatsModal.addEventListener("click", closeStatsModal);
    if (btnCloseStatsModalBtn) btnCloseStatsModalBtn.addEventListener("click", closeStatsModal);
    if (btnSendStatsTg) btnSendStatsTg.addEventListener("click", sendStatsToTelegram);

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

    if (btnToggleTgSettings && tgSettingsPanel) {
      btnToggleTgSettings.addEventListener("click", () => {
        const isHidden = tgSettingsPanel.style.display === "none" || !tgSettingsPanel.style.display;
        tgSettingsPanel.style.display = isHidden ? "flex" : "none";
      });
    }

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
    [noteModal, notesListModal, statsModal, qrModal, feedbackModal].forEach(modal => {
      if (modal) {
        modal.addEventListener("click", (e) => {
          if (e.target === modal) {
            modal.classList.remove("active");
            updateModalScrollLock();
          }
        });
      }
    });
  }

  // --- Initialization ---
  document.addEventListener("DOMContentLoaded", () => {
    trackUsage();
    initTheme();
    setupEventListeners();
    renderApp();
    scrollToToday();
  });

})();
