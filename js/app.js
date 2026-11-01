/* Shared utilities: nav rendering, localStorage helpers, date helpers */

const STORAGE_KEYS = {
  PRACTICE_LOG: "yic_practice_log_v1", // { "2024-05-01": { "asana:yogendra-padmasana": true, ... } }
  FLASHCARD_PROGRESS: "yic_flashcard_progress_v1", // { cardId: { box: 1-5, lastSeen, correctStreak } }
  EXAM_HISTORY: "yic_exam_history_v1", // [ {date, score, total, topics:{}, durationSec, answers:[...]} ]
  SETTINGS: "yic_settings_v1",
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn("Failed to parse storage for", key, e);
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function dayKeyOffset(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function formatDate(key) {
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/* ---------- Practice log helpers ---------- */
function getPracticeLog() {
  return loadJSON(STORAGE_KEYS.PRACTICE_LOG, {});
}

function togglePracticed(itemKey, dateKey) {
  const log = getPracticeLog();
  dateKey = dateKey || todayKey();
  if (!log[dateKey]) log[dateKey] = {};
  log[dateKey][itemKey] = !log[dateKey][itemKey];
  if (!log[dateKey][itemKey]) delete log[dateKey][itemKey];
  saveJSON(STORAGE_KEYS.PRACTICE_LOG, log);
  return !!log[dateKey][itemKey];
}

function isPracticed(itemKey, dateKey) {
  const log = getPracticeLog();
  dateKey = dateKey || todayKey();
  return !!(log[dateKey] && log[dateKey][itemKey]);
}

function countPracticedToday(prefix) {
  const log = getPracticeLog();
  const today = log[todayKey()] || {};
  return Object.keys(today).filter((k) => !prefix || k.startsWith(prefix)).length;
}

function computeStreak() {
  const log = getPracticeLog();
  let streak = 0;
  let offset = 0;
  // today counts if it has entries; otherwise start checking from yesterday
  while (true) {
    const key = dayKeyOffset(-offset);
    const entries = log[key];
    if (entries && Object.keys(entries).length > 0) {
      streak++;
      offset++;
    } else if (offset === 0) {
      // today has no entries yet, don't break the streak, just don't count it
      offset++;
      continue;
    } else {
      break;
    }
  }
  return streak;
}

/* ---------- Nav ---------- */
function renderNav(active) {
  const links = [
    { href: "index.html", label: "🏠 Dashboard", key: "home" },
    { href: "practical.html", label: "🧘 Practical Prep", key: "practical" },
    { href: "flashcards.html", label: "🗂️ Flashcards", key: "flashcards" },
    { href: "terms-map.html", label: "🗺️ Terms Map", key: "terms" },
    { href: "mock-exam.html", label: "📝 Mock Exam", key: "exam" },
  ];
  const nav = document.getElementById("topnav-container");
  if (!nav) return;
  nav.innerHTML = `
    <div class="topnav">
      <div class="brand">🕉️ YIC Exam Prep</div>
      <nav>
        ${links
          .map(
            (l) =>
              `<a href="${l.href}" class="${l.key === active ? "active" : ""}">${l.label}</a>`
          )
          .join("")}
      </nav>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function loadData(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error("Failed to load " + path);
  return res.json();
}
