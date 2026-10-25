/* Practical Prep page logic: tabs, search/filter, collapsible cards, practiced-today tracking */

const PREFIX = { asana: "asana", pranayama: "pranayama", kriya: "kriya" };

let STATE = {
  asana: { items: [], extra: null },
  pranayama: { items: [], extra: null },
  kriya: { items: [], extra: null },
  activeTab: "asana",
  search: "",
  activeCategory: "All",
};

function toArray(val) {
  if (Array.isArray(val)) return val;
  if (val === undefined || val === null || val === "") return [];
  return [String(val)];
}

function toText(val) {
  if (Array.isArray(val)) return val.join(" ");
  return val || "";
}

let PDF_AVAILABLE = false;

async function checkPdfAvailable() {
  try {
    const res = await fetch("resources/handbook.pdf", { method: "HEAD" });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function init() {
  renderNav("practical");

  const [asanaData, pranayamaData, kriyaData, pdfOk] = await Promise.all([
    loadData("js/data/asanas.json").catch(() => ({ items: [] })),
    loadData("js/data/pranayama.json").catch(() => ({ items: [] })),
    loadData("js/data/kriya.json").catch(() => ({ items: [] })),
    checkPdfAvailable(),
  ]);
  PDF_AVAILABLE = pdfOk;

  STATE.asana.items = asanaData.items || [];
  STATE.pranayama.items = pranayamaData.items || [];
  STATE.pranayama.extra = pranayamaData.generalRules || null;
  STATE.kriya.items = kriyaData.items || [];
  STATE.kriya.extra = kriyaData.generalNotes || null;

  document.getElementById("countAsana").textContent = STATE.asana.items.length;
  document.getElementById("countPranayama").textContent = STATE.pranayama.items.length;
  document.getElementById("countKriya").textContent = STATE.kriya.items.length;
  document.getElementById("totalCount").textContent =
    STATE.asana.items.length + STATE.pranayama.items.length + STATE.kriya.items.length;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      STATE.activeTab = btn.dataset.tab;
      document.getElementById("panel-" + STATE.activeTab).classList.add("active");
      STATE.activeCategory = "All";
      STATE.search = "";
      document.getElementById("searchBox").value = "";
      renderCategoryFilters();
      renderPanel(STATE.activeTab);
    });
  });

  document.getElementById("searchBox").addEventListener("input", (e) => {
    STATE.search = e.target.value.toLowerCase();
    renderPanel(STATE.activeTab);
  });

  document.getElementById("printBtn").addEventListener("click", () => window.print());

  renderCategoryFilters();
  renderPanel("asana");
  updateHeaderStats();
}

function renderCategoryFilters() {
  const items = STATE[STATE.activeTab].items;
  const cats = ["All", ...new Set(items.map((i) => i.category).filter(Boolean))];
  const container = document.getElementById("categoryFilters");
  container.innerHTML = cats
    .map(
      (c) =>
        `<button class="btn ${c === STATE.activeCategory ? "active" : ""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    )
    .join("");
  container.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      STATE.activeCategory = btn.dataset.cat;
      renderCategoryFilters();
      renderPanel(STATE.activeTab);
    });
  });
}

function itemMatches(item, search) {
  if (!search) return true;
  const haystack = [
    item.name,
    item.englishName,
    item.sanskritMeaning,
    item.category,
    item.poseCue,
    item.introduction,
    toText(item.benefits),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

function renderExtraNote(tab) {
  const extra = STATE[tab].extra;
  if (!extra) return "";
  if (tab === "pranayama") {
    const rules = toArray(extra);
    return `
      <div class="card" style="margin-bottom:16px;">
        <h3>General Rules for the Practice of Pranayama</h3>
        <ul>${rules.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
      </div>`;
  }
  if (tab === "kriya") {
    return `
      <div class="card" style="margin-bottom:16px;">
        <h3>Purpose &amp; Utility of Shad-Kriya</h3>
        <p>${escapeHtml(extra)}</p>
      </div>`;
  }
  return "";
}

function renderVariations(variations) {
  if (!variations || !variations.length) return "";
  return variations
    .map(
      (v) => `
      <div style="margin:10px 0; padding:10px 14px; background:#F7FAFC; border-radius:8px;">
        <strong style="font-size:13px; color: var(--primary);">${escapeHtml(v.name || "")}</strong>
        ${v.startingPosition && v.startingPosition.length ? `<h4>Starting Position</h4><ul>${toArray(v.startingPosition).map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>` : ""}
        ${v.steps && v.steps.length ? `<h4>Steps</h4><ol>${toArray(v.steps).map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>` : ""}
        ${v.recommendedPractice ? `<h4>Recommended Practice</h4><p>${escapeHtml(v.recommendedPractice)}</p>` : ""}
      </div>`
    )
    .join("");
}

function renderPdfRefLine(label, href) {
  const cleanLabel = label.replace(/\s*↗\s*$/, "").trim();
  if (PDF_AVAILABLE && href) {
    return `<p><a href="${encodeURI(href)}" target="_blank">${escapeHtml(cleanLabel)} ↗</a></p>`;
  }
  return `<p style="color:var(--text-muted); font-size:12px;">${escapeHtml(cleanLabel)} <em>(handbook PDF not included in this copy)</em></p>`;
}

function renderCard(tab, item, idx) {
  const itemKey = `${PREFIX[tab]}:${item.id || idx}`;
  const checked = isPracticed(itemKey);
  const engLabel = item.englishName ? `<span class="eng">(${escapeHtml(item.englishName)})</span>` : "";
  const sanskrit = item.sanskritMeaning ? `<span class="eng">(${escapeHtml(item.sanskritMeaning)})</span>` : "";

  const startPos = toArray(item.startingPosition);
  const prep = toArray(item.preparation);
  const steps = toArray(item.steps);
  const variations = item.variations;
  const limitations = toArray(item.limitations);
  const benefits = toArray(item.benefits);

  return `
  <div class="practice-card" data-idx="${idx}">
    <div class="practice-card-head" data-toggle="${idx}">
      <div class="practice-title">
        <span class="cat-badge">${escapeHtml(item.category || "")}</span>
        <span class="name">${escapeHtml(item.name || "")}</span>
        ${engLabel}${sanskrit}
      </div>
      <label class="practiced-check" onclick="event.stopPropagation();">
        <input type="checkbox" data-practice-key="${itemKey}" ${checked ? "checked" : ""}>
        Practiced today
      </label>
    </div>
    <div class="practice-card-body" id="body-${tab}-${idx}">
      ${item.poseCue ? `<div class="pose-cue"><strong>Pose Cue:</strong> ${escapeHtml(item.poseCue)}</div>` : ""}
      ${item.introduction ? `<h4>What it is</h4><p>${escapeHtml(item.introduction)}</p>` : ""}
      ${item.pdfRef ? renderPdfRefLine(item.pdfRef, item.pdfHref) : ""}
      ${item.pageRef && !item.pdfRef ? renderPdfRefLine(`📖 ${item.pageRef} ↗`, item.pdfHref) : ""}
      ${startPos.length ? `<h4>Starting Position</h4><ul>${startPos.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>` : ""}
      ${prep.length ? `<h4>Preparation</h4><ul>${prep.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>` : ""}
      ${steps.length ? `<h4>Sequence of Steps (How)</h4><ol>${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>` : ""}
      ${renderVariations(variations)}
      ${item.breath ? `<h4>Breath</h4><span class="breath-pill">${escapeHtml(item.breath)}</span>` : ""}
      ${item.recommendedPractice ? `<h4>Recommended Practice (Key Points to Perfect)</h4><p>${escapeHtml(item.recommendedPractice)}</p>` : ""}
      ${limitations.length ? `<h4>Limitations &amp; Contraindications</h4><ul class="limitation-text">${limitations.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>` : ""}
      ${benefits.length ? `<h4>Benefits</h4><ul class="benefit-text">${benefits.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>` : ""}
    </div>
  </div>`;
}

function renderPanel(tab) {
  const panel = document.getElementById("panel-" + tab);
  const items = STATE[tab].items.filter(
    (i) =>
      (STATE.activeCategory === "All" || i.category === STATE.activeCategory) &&
      itemMatches(i, STATE.search)
  );

  let html = tab === STATE.activeTab ? renderExtraNote(tab) : "";

  if (!items.length) {
    html += `<div class="empty-state">No items match your search/filter yet.${
      STATE[tab].items.length === 0
        ? " Data file not loaded — run the site extraction scripts or check js/data/" + tab + (tab === "asana" ? "s" : "") + ".json."
        : ""
    }</div>`;
  } else {
    html += items.map((item, idx) => renderCard(tab, item, idx)).join("");
  }
  panel.innerHTML = html;

  panel.querySelectorAll("[data-toggle]").forEach((head) => {
    head.addEventListener("click", () => {
      const idx = head.dataset.toggle;
      const body = document.getElementById(`body-${tab}-${idx}`);
      body.classList.toggle("open");
    });
  });

  panel.querySelectorAll("[data-practice-key]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      togglePracticed(checkbox.dataset.practiceKey);
      updateHeaderStats();
    });
  });
}

function updateHeaderStats() {
  const streak = computeStreak();
  const todayCount = countPracticedToday();
  const total = STATE.asana.items.length + STATE.pranayama.items.length + STATE.kriya.items.length;
  document.getElementById("streakLabel").textContent = `🔥 ${streak} day streak`;
  document.getElementById("todayCount").textContent = todayCount;
  document.getElementById("totalCount").textContent = total;
  const pct = total ? Math.round((todayCount / total) * 100) : 0;
  document.getElementById("todayProgressBar").style.width = pct + "%";
}

init();
