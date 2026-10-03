
(() => {
  if (!window.App.requireLogin()) return;

  window.App.renderNavbar("home.html");

  const container = document.getElementById("menu-cards");
  const cards = window.APP_CONFIG.MENU_CARDS || [];

  container.innerHTML = cards.map(card => `
    <a class="menu-card" href="${window.App.escapeHTML(card.path)}">
      <div class="menu-card-icon" aria-hidden="true">
        ${card.icon === "users" ? "♧" : "▦"}
      </div>

      <h2>${window.App.escapeHTML(card.title)}</h2>
      <p>${window.App.escapeHTML(card.description || "")}</p>

      <span class="menu-card-link">
        Open section <span aria-hidden="true">→</span>
      </span>
    </a>
  `).join("");
})();