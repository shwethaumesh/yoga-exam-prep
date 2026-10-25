/* Mock Exam engine: setup, timed quiz, scoring, topic breakdown, history */

let QUESTION_BANK = [];
let TOPICS = [];
let examQuestions = [];
let answers = {}; // questionId -> selected index
let flags = {};
let currentQIndex = 0;
let timerInterval = null;
let secondsRemaining = 0;
let examStartTime = null;
let timeLimitMinutes = 60;

async function init() {
  renderNav("exam");

  const data = await loadData("js/data/mcq-bank.json").catch(() => ({ topics: [], questions: [] }));
  QUESTION_BANK = data.questions || [];
  TOPICS = data.topics && data.topics.length ? data.topics : [...new Set(QUESTION_BANK.map((q) => q.topic))];

  renderTopicChecklist();
  renderHistory();

  document.getElementById("selectAllTopics").addEventListener("click", () => setAllTopics(true));
  document.getElementById("clearAllTopics").addEventListener("click", () => setAllTopics(false));
  document.getElementById("startExamBtn").addEventListener("click", startExam);
  document.getElementById("submitExamBtn").addEventListener("click", () => submitExam(false));
  document.getElementById("prevQBtn").addEventListener("click", () => navigateQuestion(-1));
  document.getElementById("nextQBtn").addEventListener("click", () => navigateQuestion(1));
  document.getElementById("flagBtn").addEventListener("click", toggleFlag);
  document.getElementById("retakeBtn").addEventListener("click", resetToSetup);
  document.getElementById("reviewBtn").addEventListener("click", () => {
    document.getElementById("reviewSection").scrollIntoView({ behavior: "smooth" });
  });

  if (location.hash === "#history") {
    document.getElementById("historyCard").scrollIntoView();
  }
}

function renderTopicChecklist() {
  const container = document.getElementById("topicChecklist");
  container.innerHTML = TOPICS.map(
    (t, i) => `<label><input type="checkbox" value="${escapeHtml(t)}" checked> ${escapeHtml(t)}</label>`
  ).join("");
}

function setAllTopics(checked) {
  document.querySelectorAll("#topicChecklist input").forEach((cb) => (cb.checked = checked));
}

function getSelectedTopics() {
  return Array.from(document.querySelectorAll("#topicChecklist input:checked")).map((cb) => cb.value);
}

function startExam() {
  const selectedTopics = getSelectedTopics();
  if (!selectedTopics.length) {
    alert("Select at least one topic.");
    return;
  }
  const pool = QUESTION_BANK.filter((q) => selectedTopics.includes(q.topic));
  if (!pool.length) {
    alert("No questions available for the selected topics.");
    return;
  }

  const numSetting = document.getElementById("numQuestions").value;
  const numQuestions = numSetting === "all" ? pool.length : Math.min(parseInt(numSetting, 10), pool.length);
  examQuestions = shuffleArray(pool).slice(0, numQuestions);

  timeLimitMinutes = parseInt(document.getElementById("timeLimit").value, 10);
  answers = {};
  flags = {};
  currentQIndex = 0;
  examStartTime = Date.now();

  document.getElementById("setupScreen").style.display = "none";
  document.getElementById("resultsScreen").style.display = "none";
  document.getElementById("examScreen").style.display = "block";

  renderExamNavGrid();
  renderQuestion();
  startTimer();
}

function startTimer() {
  clearInterval(timerInterval);
  const timerEl = document.getElementById("examTimer");
  if (timeLimitMinutes === 0) {
    timerEl.textContent = "Untimed";
    return;
  }
  secondsRemaining = timeLimitMinutes * 60;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    secondsRemaining--;
    updateTimerDisplay();
    if (secondsRemaining <= 0) {
      clearInterval(timerInterval);
      alert("Time's up! Submitting your exam.");
      submitExam(true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const timerEl = document.getElementById("examTimer");
  const m = Math.floor(secondsRemaining / 60);
  const s = secondsRemaining % 60;
  timerEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
  timerEl.classList.toggle("low", secondsRemaining <= 60);
}

function renderExamNavGrid() {
  const grid = document.getElementById("examNavGrid");
  grid.innerHTML = examQuestions
    .map((q, i) => {
      const cls = [
        "exam-nav-dot",
        i === currentQIndex ? "current" : "",
        answers[q.id] !== undefined ? "answered" : "",
        flags[q.id] ? "flagged" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button class="${cls}" data-goto="${i}">${i + 1}</button>`;
    })
    .join("");
  grid.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentQIndex = parseInt(btn.dataset.goto, 10);
      renderQuestion();
    });
  });
}

function renderQuestion() {
  const q = examQuestions[currentQIndex];
  document.getElementById("examProgressLabel").textContent = `Question ${currentQIndex + 1} of ${examQuestions.length}`;

  const selected = answers[q.id];
  const optionsHtml = q.options
    .map((opt, i) => {
      const cls = ["option-row", selected === i ? "selected" : ""].filter(Boolean).join(" ");
      return `
      <div class="${cls}" data-option="${i}">
        <input type="radio" name="opt" ${selected === i ? "checked" : ""}>
        <span>${escapeHtml(opt)}</span>
      </div>`;
    })
    .join("");

  document.getElementById("questionCard").innerHTML = `
    <div class="exam-question-card">
      <div class="q-meta">${escapeHtml(q.topic || "")}</div>
      <div class="q-text">${currentQIndex + 1}. ${escapeHtml(q.question)}</div>
      ${optionsHtml}
    </div>`;

  document.getElementById("questionCard").querySelectorAll("[data-option]").forEach((row) => {
    row.addEventListener("click", () => {
      answers[q.id] = parseInt(row.dataset.option, 10);
      renderQuestion();
      renderExamNavGrid();
    });
  });

  document.getElementById("flagBtn").classList.toggle("active", !!flags[q.id]);
  document.getElementById("prevQBtn").disabled = currentQIndex === 0;
  document.getElementById("nextQBtn").disabled = currentQIndex === examQuestions.length - 1;
  renderExamNavGrid();
}

function navigateQuestion(delta) {
  const next = currentQIndex + delta;
  if (next < 0 || next >= examQuestions.length) return;
  currentQIndex = next;
  renderQuestion();
}

function toggleFlag() {
  const q = examQuestions[currentQIndex];
  flags[q.id] = !flags[q.id];
  renderQuestion();
}

function submitExam(timedOut) {
  if (!timedOut) {
    const unanswered = examQuestions.filter((q) => answers[q.id] === undefined).length;
    if (unanswered > 0 && !confirm(`${unanswered} question(s) unanswered. Submit anyway?`)) {
      return;
    }
  }
  clearInterval(timerInterval);

  const durationSec = Math.round((Date.now() - examStartTime) / 1000);
  let correct = 0;
  const topicStats = {};
  const reviewRows = [];

  examQuestions.forEach((q, i) => {
    const selected = answers[q.id];
    const isCorrect = selected === q.correctIndex;
    if (isCorrect) correct++;

    if (!topicStats[q.topic]) topicStats[q.topic] = { correct: 0, total: 0 };
    topicStats[q.topic].total++;
    if (isCorrect) topicStats[q.topic].correct++;

    reviewRows.push({ index: i + 1, question: q, selected, isCorrect });
  });

  const historyEntry = {
    date: new Date().toISOString(),
    score: correct,
    total: examQuestions.length,
    durationSec,
    topics: topicStats,
  };
  const history = loadJSON(STORAGE_KEYS.EXAM_HISTORY, []);
  history.push(historyEntry);
  saveJSON(STORAGE_KEYS.EXAM_HISTORY, history);

  renderResults(correct, examQuestions.length, topicStats, reviewRows);
  renderHistory();

  document.getElementById("examScreen").style.display = "none";
  document.getElementById("resultsScreen").style.display = "block";
}

function renderResults(correct, total, topicStats, reviewRows) {
  document.getElementById("scoreBig").textContent = `${correct}/${total}`;
  document.getElementById("scoreSub").textContent = `${Math.round((correct / total) * 100)}% — ${
    correct / total >= 0.6 ? "Passing range 🎉" : "Keep practicing 💪"
  }`;

  const breakdown = document.getElementById("topicBreakdown");
  breakdown.innerHTML = Object.entries(topicStats)
    .map(([topic, stat]) => {
      const pct = Math.round((stat.correct / stat.total) * 100);
      return `
      <div class="topic-breakdown-row">
        <div class="label">${escapeHtml(topic)}</div>
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="pct">${stat.correct}/${stat.total}</div>
      </div>`;
    })
    .join("");

  const reviewSection = document.getElementById("reviewSection");
  reviewSection.innerHTML = `
    <h3 style="margin-bottom:12px;">Answer Review</h3>
    ${reviewRows
      .map((r) => {
        const q = r.question;
        const optsHtml = q.options
          .map((opt, i) => {
            let cls = "option-row";
            if (i === q.correctIndex) cls += " correct";
            else if (i === r.selected) cls += " incorrect";
            return `<div class="${cls}">${escapeHtml(opt)}${i === q.correctIndex ? " ✓" : i === r.selected ? " ✗" : ""}</div>`;
          })
          .join("");
        return `
        <div class="exam-question-card">
          <div class="q-meta">${escapeHtml(q.topic || "")} ${r.isCorrect ? "✅" : "❌"}</div>
          <div class="q-text">${r.index}. ${escapeHtml(q.question)}</div>
          ${optsHtml}
          ${q.explanation ? `<div class="explain-box">${escapeHtml(q.explanation)}</div>` : ""}
        </div>`;
      })
      .join("")}
  `;
}

function resetToSetup() {
  document.getElementById("resultsScreen").style.display = "none";
  document.getElementById("setupScreen").style.display = "block";
}

function renderHistory() {
  const history = loadJSON(STORAGE_KEYS.EXAM_HISTORY, []);
  const body = document.getElementById("historyBody");
  if (!history.length) {
    body.innerHTML = `<div class="empty-state">No exams taken yet.</div>`;
    return;
  }
  const rows = history
    .slice()
    .reverse()
    .map(
      (e) => `
      <tr>
        <td>${formatDate(e.date.slice(0, 10))}</td>
        <td>${e.score} / ${e.total} (${Math.round((e.score / e.total) * 100)}%)</td>
        <td>${e.durationSec ? Math.round(e.durationSec / 60) + " min" : "–"}</td>
      </tr>`
    )
    .join("");
  body.innerHTML = `
    <table class="history-table">
      <thead><tr><th>Date</th><th>Score</th><th>Time Taken</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

init();
