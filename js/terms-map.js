/* Key Terms Map page logic: render collapsible topic groups of term/meaning chips, with search and expand/collapse all */

let TERM_GROUPS = [];
let searchTerm = "";

async function init() {
  renderNav("terms");

  const data = await loadData("js/data/terms-map.json").catch(() => ({ groups: [] }));
  TERM_GROUPS = data.groups || [];

  render();

  document.getElementById("searchBox").addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    render();
  });
  document.getElementById("expandAllBtn").addEventListener("click", () => setAllOpen(true));
  document.getElementById("collapseAllBtn").addEventListener("click", () => setAllOpen(false));
  document.getElementById("printBtn").addEventListener("click", () => {
    setAllOpen(true);
    window.print();
  });
}

function highlight(text) {
  const escaped = escapeHtml(text);
  if (!searchTerm) return escaped;
  const idx = escaped.toLowerCase().indexOf(searchTerm.toLowerCase());
  if (idx === -1) return escaped;
  return (
    escaped.slice(0, idx) +
    "<mark>" +
    escaped.slice(idx, idx + searchTerm.length) +
    "</mark>" +
    escaped.slice(idx + searchTerm.length)
  );
}

function groupMatchesSearch(group) {
  if (!searchTerm) return { matches: true, terms: group.terms };
  const topicMatches = group.topic.toLowerCase().includes(searchTerm);
  if (topicMatches) return { matches: true, terms: group.terms };
  const terms = group.terms.filter(
    (t) => t.term.toLowerCase().includes(searchTerm) || t.meaning.toLowerCase().includes(searchTerm)
  );
  return { matches: terms.length > 0, terms };
}

function render() {
  const container = document.getElementById("termGroups");
  const visibleGroups = TERM_GROUPS.map((g) => ({ group: g, ...groupMatchesSearch(g) })).filter(
    (x) => x.matches
  );

  document.getElementById("groupCounter").textContent = searchTerm
    ? `${visibleGroups.length} of ${TERM_GROUPS.length} topic groups match "${searchTerm}"`
    : `${TERM_GROUPS.length} topic groups · ${TERM_GROUPS.reduce((n, g) => n + g.terms.length, 0)} terms`;

  if (!visibleGroups.length) {
    container.innerHTML = `<div class="empty-state">No terms match your search.</div>`;
    return;
  }

  container.innerHTML = visibleGroups
    .map(({ group, terms }, idx) => {
      const forceOpen = !!searchTerm;
      return `
      <div class="term-group-card" data-idx="${idx}">
        <div class="term-group-head" data-toggle="${idx}">
          <div>
            <h3>${highlight(group.topic)}</h3>
            ${group.description ? `<p>${escapeHtml(group.description)}</p>` : ""}
          </div>
          <span class="term-group-count">${terms.length} terms</span>
        </div>
        <div class="term-group-body ${forceOpen ? "open" : ""}" id="term-body-${idx}">
          <div class="term-grid">
            ${terms
              .map(
                (t) => `
              <div class="term-chip">
                <div class="term-name">${highlight(t.term)}</div>
                <div class="term-meaning">${highlight(t.meaning)}</div>
              </div>`
              )
              .join("")}
          </div>
          ${group.pageRef ? `<p style="color:var(--text-muted); font-size:11px; margin-top:12px;">📖 ${escapeHtml(group.pageRef)}</p>` : ""}
        </div>
      </div>`;
    })
    .join("");

  container.querySelectorAll("[data-toggle]").forEach((head) => {
    head.addEventListener("click", () => {
      const idx = head.dataset.toggle;
      document.getElementById(`term-body-${idx}`).classList.toggle("open");
    });
  });
}

function setAllOpen(open) {
  document.querySelectorAll(".term-group-body").forEach((el) => el.classList.toggle("open", open));
}

init();
