/* Flashcards page logic: filtering, flip, spaced-repetition-lite progress */

const BOX_INTERVAL_DAYS = [0, 1, 2, 4, 7, 14]; // index = box (1-5), box 0 unused

let ALL_CARDS = [];
let CATEGORIES = [];
let deck = [];
let currentIndex = 0;
let flipped = false;
let mode = "all"; // "all" | "due"
let searchTerm = "";
let activeCategory = "All";

function getProgress() {
  return loadJSON(STORAGE_KEYS.FLASHCARD_PROGRESS, {});
}

function setCardProgress(cardId, box) {
  const progress = getProgress();
  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + BOX_INTERVAL_DAYS[Math.min(box, BOX_INTERVAL_DAYS.length - 1)]);
  progress[cardId] = { box, nextDue: nextDueDate.toISOString().slice(0, 10), lastSeen: todayKey() };
  saveJSON(STORAGE_KEYS.FLASHCARD_PROGRESS, progress);
}

function isDue(cardId) {
  const progress = getProgress();
  const p = progress[cardId];
  if (!p) return true;
  return p.nextDue <= todayKey();
}

function cardBox(cardId) {
  const progress = getProgress();
  return progress[cardId] ? progress[cardId].box : 0;
}

async function init() {
  renderNav("flashcards");

  const data = await loadData("js/data/flashcards.json").catch(() => ({ categories: [], cards: [] }));
  ALL_CARDS = data.cards || [];
  CATEGORIES = data.categories && data.categories.length
    ? data.categories
    : [...new Set(ALL_CARDS.map((c) => c.category))];

  renderCategoryFilters();
  buildDeck();
  renderCard();
  updateMastery();

  document.getElementById("searchBox").addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase();
    buildDeck();
    renderCard();
  });

  document.getElementById("flashcard").addEventListener("click", () => {
    flipped = !flipped;
    renderCard();
  });

  document.getElementById("modeAll").addEventListener("click", () => {
    mode = "all";
    setActiveModeBtn();
    buildDeck();
    renderCard();
  });
  document.getElementById("modeDue").addEventListener("click", () => {
    mode = "due";
    setActiveModeBtn();
    buildDeck();
    renderCard();
  });
  document.getElementById("shuffleBtn").addEventListener("click", () => {
    deck = shuffleArray(deck);
    currentIndex = 0;
    flipped = false;
    renderCard();
  });
  document.getElementById("resetProgressBtn").addEventListener("click", () => {
    if (confirm("Reset all flashcard progress? This cannot be undone.")) {
      saveJSON(STORAGE_KEYS.FLASHCARD_PROGRESS, {});
      buildDeck();
      renderCard();
      updateMastery();
    }
  });

  document.getElementById("prevBtn").addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + deck.length) % deck.length;
    flipped = false;
    renderCard();
  });
  document.getElementById("nextBtn").addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % deck.length;
    flipped = false;
    renderCard();
  });
  document.getElementById("knowBtn").addEventListener("click", () => rate(true));
  document.getElementById("dontKnowBtn").addEventListener("click", () => rate(false));

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") document.getElementById("nextBtn").click();
    if (e.key === "ArrowLeft") document.getElementById("prevBtn").click();
    if (e.key === " ") {
      e.preventDefault();
      document.getElementById("flashcard").click();
    }
  });
}

function setActiveModeBtn() {
  document.getElementById("modeAll").classList.toggle("active", mode === "all");
  document.getElementById("modeDue").classList.toggle("active", mode === "due");
}

function renderCategoryFilters() {
  const cats = ["All", ...CATEGORIES];
  const container = document.getElementById("categoryFilters");
  container.innerHTML = cats
    .map((c) => `<button class="btn ${c === activeCategory ? "active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
    .join("");
  container.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
      renderCategoryFilters();
      buildDeck();
      renderCard();
    });
  });
}

function buildDeck() {
  deck = ALL_CARDS.filter((c) => {
    if (activeCategory !== "All" && c.category !== activeCategory) return false;
    if (searchTerm) {
      const hay = `${c.topic} ${c.front} ${c.back} ${c.category}`.toLowerCase();
      if (!hay.includes(searchTerm)) return false;
    }
    if (mode === "due" && !isDue(c.id)) return false;
    return true;
  });
  currentIndex = 0;
  flipped = false;
}

function renderCard() {
  document.getElementById("deckCounter").textContent = deck.length
    ? `Card ${currentIndex + 1} of ${deck.length}`
    : "No cards match this filter";

  const cardEl = document.getElementById("flashcard");
  const hasCards = deck.length > 0;
  document.getElementById("prevBtn").disabled = !hasCards;
  document.getElementById("nextBtn").disabled = !hasCards;
  document.getElementById("knowBtn").disabled = !hasCards;
  document.getElementById("dontKnowBtn").disabled = !hasCards;

  if (!hasCards) {
    document.getElementById("fcCategory").textContent = "";
    document.getElementById("fcTopic").textContent = "";
    document.getElementById("fcContent").textContent = "🎉 Nothing due right now — try 'All cards' or adjust filters.";
    cardEl.classList.remove("flipped");
    return;
  }

  const card = deck[currentIndex];
  document.getElementById("fcCategory").textContent = card.category || "";
  document.getElementById("fcTopic").textContent = card.topic || "";
  document.getElementById("fcContent").textContent = flipped ? card.back : card.front;
  cardEl.classList.toggle("flipped", flipped);
  cardEl.querySelector(".fc-hint").textContent = flipped ? "Click to flip back" : "Click to flip";
}

function rate(gotIt) {
  if (!deck.length) return;
  const card = deck[currentIndex];
  const box = cardBox(card.id);
  const newBox = gotIt ? Math.min(box + 1, 5) : 1;
  setCardProgress(card.id, newBox || 1);
  updateMastery();
  if (mode === "due") {
    // card may no longer be due; rebuild deck but try to stay roughly in place
    buildDeck();
    if (currentIndex >= deck.length) currentIndex = 0;
  } else {
    currentIndex = (currentIndex + 1) % deck.length;
  }
  flipped = false;
  renderCard();
}

function updateMastery() {
  if (!ALL_CARDS.length) return;
  const progress = getProgress();
  const mastered = ALL_CARDS.filter((c) => progress[c.id] && progress[c.id].box >= 4).length;
  const pct = Math.round((mastered / ALL_CARDS.length) * 100);
  document.getElementById("masteryBar").style.width = pct + "%";
  document.getElementById("masteryLabel").textContent = `${mastered} of ${ALL_CARDS.length} cards mastered`;
}

init();
