
(() => {
  const config = window.APP_CONFIG;

  function getToken() {
    return sessionStorage.getItem(config.SESSION_TOKEN_KEY);
  }

  function getExpiry() {
    return Number(sessionStorage.getItem(config.SESSION_EXPIRY_KEY) || 0);
  }

  function hasValidLocalSession() {
    const token = getToken();
    const expiry = getExpiry();

    return Boolean(token && expiry && Date.now() < expiry);
  }

  function clearSession() {
    sessionStorage.removeItem(config.SESSION_TOKEN_KEY);
    sessionStorage.removeItem(config.SESSION_EXPIRY_KEY);
  }

  function requireLogin() {
    if (!hasValidLocalSession()) {
      clearSession();
      window.location.replace("index.html");
      return false;
    }

    return true;
  }

  async function apiRequest(action, payload = {}) {
    if (!requireLogin()) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    let response;
    let result;

    try {
      response = await fetch(config.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action,
          token: getToken(),
          ...payload
        }),
        redirect: "follow"
      });

      if (!response.ok) {
        throw new Error("The server returned an HTTP error.");
      }

      result = await response.json();
    } catch (error) {
      if (error.message?.includes("session has expired")) {
        throw error;
      }

      throw new Error(
        "Unable to contact the server. Check your internet connection and Apps Script deployment."
      );
    }

    if (result.code === "SESSION_EXPIRED" ||
        result.code === "SESSION_INVALID") {
      clearSession();
      window.location.replace("index.html");
      throw new Error("Your session has expired. Please sign in again.");
    }

    if (!result.success) {
      throw new Error(result.message || "The request failed.");
    }

    return result;
  }

  function renderNavbar(activePath = "") {
    const container = document.getElementById("navbar");
    if (!container) return;

    const links = config.NAV_LINKS || [];

    container.innerHTML = `
      <header class="navbar">
        <a class="navbar-brand" href="home.html">
          <span class="brand-mark small">BC</span>
          <span>${escapeHTML(config.APP_NAME)}</span>
        </a>

        <nav class="nav-links" aria-label="Main navigation">
          ${links.map(link => `
            <a
              href="${escapeHTML(link.path)}"
              class="${link.path === activePath ? "active" : ""}"
              ${link.path === activePath ? 'aria-current="page"' : ""}
            >${escapeHTML(link.label)}</a>
          `).join("")}
        </nav>

        <button class="button button-secondary logout-button"
                id="logout-button" type="button">
          Sign out
        </button>
      </header>
    `;

    document.getElementById("logout-button").addEventListener("click", async () => {
      try {
        if (getToken()) {
          await apiRequest("logout");
        }
      } catch (error) {
        console.warn("Server logout could not be completed.", error);
      } finally {
        clearSession();
        window.location.replace("index.html");
      }
    });
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  window.App = {
    getToken,
    getExpiry,
    hasValidLocalSession,
    clearSession,
    requireLogin,
    apiRequest,
    renderNavbar,
    escapeHTML
  };
})();