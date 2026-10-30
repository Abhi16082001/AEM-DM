
(() => {
  const config = window.APP_CONFIG;
  let activeRequests = 0;

  function setGlobalLoading(active) {
    activeRequests = Math.max(0, activeRequests + (active ? 1 : -1));
    let loader = document.getElementById("global-api-loader");
    if (!loader && active) {
      loader = document.createElement("div");
      loader.id = "global-api-loader";
      loader.className = "global-api-loader";
      loader.setAttribute("role", "status");
      loader.setAttribute("aria-live", "polite");
      loader.innerHTML = '<span class="global-api-spinner" aria-hidden="true"></span><span>Please wait…</span>';
      document.body.appendChild(loader);
    }
    if (loader) loader.hidden = activeRequests === 0;
  }

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

    setGlobalLoading(true);
    try {
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
        if (error.message?.includes("session has expired")) throw error;
        throw new Error("Unable to contact the server. Check your internet connection and Apps Script deployment.");
      }

      if (result.code === "SESSION_EXPIRED" || result.code === "SESSION_INVALID") {
        clearSession();
        window.location.replace("index.html");
        throw new Error("Your session has expired. Please sign in again.");
      }
      if (!result.success) throw new Error(result.message || "The request failed.");
      return result;
    } finally {
      setGlobalLoading(false);
    }
  }

  function renderNavbar(activePath = "") {
    const container = document.getElementById("navbar");
    if (!container) return;

    const links = config.NAV_LINKS || [];

    container.innerHTML = `
      <header class="navbar">
        <a class="navbar-brand" href="home.html">
          <span class="brand-mark small">AEM</span>
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

  /**
   * Adds client-side paging controls to a data table. The complete record set
   * remains in memory, so callers can still calculate or act on every result.
   */
  function createDataTable({ body, renderRow, renderEmpty }) {
    const table = body.closest("table");
    const wrapper = table.closest(".table-wrapper") || table.parentElement;
    const pageSizes = [10, 20, 30, 40, 50, 100];
    let records = [];
    let page = 1;
    let pageSize = 10;

    const controls = document.createElement("div");
    controls.className = "data-table-controls";
    controls.innerHTML = `<label>Show <select aria-label="Records per page">${pageSizes.map(size => `<option value="${size}">${size}</option>`).join("")}</select> records per page</label>`;

    const pagination = document.createElement("div");
    pagination.className = "data-table-pagination";
    pagination.innerHTML = `<span class="data-table-summary" aria-live="polite"></span><div class="data-table-page-buttons"><button type="button" class="button button-secondary" data-page="previous">Previous</button><button type="button" class="button button-secondary" data-page="next">Next</button></div>`;

    wrapper.before(controls);
    wrapper.after(pagination);

    const select = controls.querySelector("select");
    const summary = pagination.querySelector(".data-table-summary");
    const previous = pagination.querySelector('[data-page="previous"]');
    const next = pagination.querySelector('[data-page="next"]');

    function render() {
      const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
      page = Math.min(page, totalPages);
      const start = (page - 1) * pageSize;
      const visibleRecords = records.slice(start, start + pageSize);

      body.innerHTML = records.length
        ? visibleRecords.map((record, index) => renderRow(record, start + index)).join("")
        : renderEmpty();

      if (!records.length) {
        summary.textContent = "No records to display.";
      } else {
        summary.textContent = `Showing ${start + 1}–${Math.min(start + pageSize, records.length)} of ${records.length} records`;
      }
      previous.disabled = !records.length || page === 1;
      next.disabled = !records.length || page === totalPages;
    }

    select.addEventListener("change", () => {
      pageSize = Number(select.value);
      page = 1;
      render();
    });
    previous.addEventListener("click", () => {
      if (page > 1) { page--; render(); }
    });
    next.addEventListener("click", () => {
      if (page < Math.ceil(records.length / pageSize)) { page++; render(); }
    });

    return {
      setRecords(nextRecords) {
        records = Array.isArray(nextRecords) ? nextRecords : [];
        page = 1;
        render();
      }
    };
  }

  const tablePagers = new WeakMap();

  // Use this for tables whose rows are rendered by existing page scripts. It
  // preserves each row's data attributes and event delegation while paging.
  function paginateTable(body) {
    let pager = tablePagers.get(body);
    if (!pager) {
      const table = body.closest("table");
      const wrapper = table.closest(".table-wrapper") || table.parentElement;
      const panel = table.closest(".table-panel") || table.parentElement;
      const sizes = [10, 20, 30, 40, 50, 100];
      const needsSearch = table.dataset.tableSearch !== "off" && !panel.querySelector('input[type="search"]');
      const controls = document.createElement("div");
      controls.className = "data-table-controls";
      controls.innerHTML = `<label>Show <select aria-label="Records per page">${sizes.map(size => `<option value="${size}">${size}</option>`).join("")}</select> records per page</label>${needsSearch ? '<input class="data-table-search" type="search" placeholder="Search table" aria-label="Search table">' : ""}`;
      const navigation = document.createElement("div");
      navigation.className = "data-table-pagination";
      navigation.innerHTML = `<span class="data-table-summary" aria-live="polite"></span><div class="data-table-page-buttons"><button type="button" class="button button-secondary" data-page="previous">Previous</button><button type="button" class="button button-secondary" data-page="next">Next</button></div>`;
      wrapper.before(controls);
      wrapper.after(navigation);

      pager = {
        page: 1,
        size: 10,
        allRows: [],
        rows: [],
        query: "",
        select: controls.querySelector("select"),
        search: controls.querySelector(".data-table-search"),
        summary: navigation.querySelector(".data-table-summary"),
        previous: navigation.querySelector('[data-page="previous"]'),
        next: navigation.querySelector('[data-page="next"]')
      };
      const render = () => {
        const count = pager.rows.length;
        const pages = Math.max(1, Math.ceil(count / pager.size));
        pager.page = Math.min(pager.page, pages);
        const first = (pager.page - 1) * pager.size;
        // Hide every row first. pager.rows is a filtered subset during a
        // search, so leaving nonmatching rows untouched would keep them on
        // screen even though the summary count is correct.
        pager.allRows.forEach(row => { row.hidden = true; });
        pager.rows.forEach((row, index) => { row.hidden = index < first || index >= first + pager.size; });
        pager.summary.textContent = count
          ? `Showing ${first + 1}–${Math.min(first + pager.size, count)} of ${count} records`
          : "No records to display.";
        pager.previous.disabled = !count || pager.page === 1;
        pager.next.disabled = !count || pager.page === pages;
      };
      pager.render = render;
      pager.select.addEventListener("change", () => { pager.size = Number(pager.select.value); pager.page = 1; render(); });
      if (pager.search) {
        pager.search.addEventListener("input", () => {
          pager.query = pager.search.value.trim().toLowerCase();
          pager.rows = pager.allRows.filter(row => row.textContent.toLowerCase().includes(pager.query));
          pager.page = 1;
          render();
        });
      }
      pager.previous.addEventListener("click", () => { if (pager.page > 1) { pager.page--; render(); } });
      pager.next.addEventListener("click", () => { if (pager.page < Math.ceil(pager.rows.length / pager.size)) { pager.page++; render(); } });
      tablePagers.set(body, pager);
    }

    const rows = [...body.rows];
    const hasEmptyMessage = rows.length === 1 && rows[0].cells.length === 1 && rows[0].cells[0].colSpan > 1;
    pager.allRows = hasEmptyMessage ? [] : rows;
    pager.rows = pager.allRows.filter(row => row.textContent.toLowerCase().includes(pager.query));
    pager.page = 1;
    pager.render();
  }

  function enableDataTables() {
    document.querySelectorAll("table.data-table tbody").forEach(body => {
      paginateTable(body);
      new MutationObserver(() => paginateTable(body))
        .observe(body, { childList: true });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enableDataTables, { once: true });
  } else {
    enableDataTables();
  }

  window.App = {
    getToken,
    getExpiry,
    hasValidLocalSession,
    clearSession,
    requireLogin,
    apiRequest,
    renderNavbar,
    escapeHTML,
    createDataTable,
    paginateTable
  };
})();
