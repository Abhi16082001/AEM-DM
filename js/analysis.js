(() => {
  if (!window.App.requireLogin()) return;
  window.App.renderNavbar("");

  const feature = new URLSearchParams(window.location.search).get("feature");
  const config = window.APP_CONFIG.ANALYSIS?.[feature];
  if (!config) { window.location.replace("home.html"); return; }

  const $ = id => document.getElementById(id);
  const escape = window.App.escapeHTML;
  const lookupValues = {};
  const fields = config.fields;
  const isWorkAnalysis = config.resource === "work";
  let records = [];

  $("page-title").textContent = config.title;
  $("table-title").textContent = `${config.singular} Results`;
  document.title = `${config.title} — Bill Creator`;

  const status = (element, message, type = "") => {
    element.textContent = message;
    element.className = `status ${type}`.trim();
  };
  const fieldId = field => `filter-${field.name.replace(/[^a-z0-9]/gi, "-")}`;
  const lookupDisplay = (field, value) => {
    const match = (lookupValues[field.name] || []).find(item => item.key === String(value));
    return match ? match.label : value;
  };

  function fieldHtml(field) {
    const id = fieldId(field);
    let control;
    if (field.type === "lookup" || field.type === "options") {
      control = `<input id="${id}" name="${escape(field.name)}" list="${id}-options" autocomplete="off"><datalist id="${id}-options"></datalist>`;
    } else if (field.type === "checkbox") {
      control = `<input id="${id}" name="${escape(field.name)}" list="${id}-options" autocomplete="off"><datalist id="${id}-options"><option value="true">True</option><option value="false">False</option></datalist>`;
    } else if (field.type === "textarea") {
      control = `<input id="${id}" name="${escape(field.name)}" type="text">`;
    } else {
      control = `<input id="${id}" name="${escape(field.name)}" type="${field.type === "date" ? "date" : "text"}">`;
    }
    return `<div class="field-group"><label for="${id}">${escape(field.label)}</label>${control}</div>`;
  }

  async function loadLookups() {
    const lookupFields = fields.filter(field => field.type === "lookup" || field.type === "options");
    await Promise.all(lookupFields.map(async field => {
      if (field.type === "options") {
        lookupValues[field.name] = (field.options || []).map(value => ({ key: value, label: value }));
      } else {
        const action = field.lookupAction || "listMasterData";
        const result = await window.App.apiRequest(action, field.lookupAction ? {} : { resource: field.lookupResource });
        const keyField = field.lookupKey || field.lookupField;
        lookupValues[field.name] = (result[field.lookupResponse || "records"] || []).map(record => ({
          key: String(record[keyField] || ""),
          label: String(field.lookupDisplay ? field.lookupDisplay(record) : record[keyField] || "")
        })).filter(item => item.key && item.label);
      }
      const list = $(fieldId(field) + "-options");
      list.innerHTML = lookupValues[field.name].map(item => `<option value="${escape(item.label)}"></option>`).join("");
    }));
  }

  function buildTable() {
    $("records-head").innerHTML = `<tr>${fields.map(field => `<th scope="col">${escape(field.label)}</th>`).join("")}</tr>`;
    if (!records.length) {
      $("records-body").innerHTML = `<tr><td colspan="${fields.length}" class="empty-state">No matching records found.</td></tr>`;
      return;
    }
    $("records-body").innerHTML = records.map(record => `<tr>${fields.map(field =>
      `<td>${escape(field.type === "lookup" ? lookupDisplay(field, record[field.name]) : record[field.name] ?? "—")}</td>`
    ).join("")}</tr>`).join("");
  }

  function calculateTotal() {
    const total = records.reduce((sum, record) => {
      // Work totals are saved as text, so accept standard comma-formatted
      // amounts while ignoring a blank Total cell.
      const raw = String(record.Total ?? "").replace(/,/g, "").trim();
      const value = raw ? Number(raw) : 0;
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    status($("calculated-total"), `Total of all ${records.length} filtered work record(s): ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, "success");
  }

  function filtersFromForm() {
    const filters = {};
    for (const field of fields) {
      const raw = $("analysis-form").elements.namedItem(field.name).value.trim();
      if (!raw) continue;
      if (field.type === "lookup" || field.type === "options") {
        const choice = (lookupValues[field.name] || []).find(item => item.label === raw);
        if (!choice) throw new Error(`Select a valid ${field.label}.`);
        filters[field.name] = choice.key;
      } else {
        filters[field.name] = raw;
      }
    }
    return filters;
  }

  async function runAnalysis() {
    try {
      status($("table-status"), "Loading results…");
      const result = await window.App.apiRequest("analyzeMasterData", { resource: config.resource, filters: filtersFromForm() });
      records = result.records || [];
      buildTable();
      $("calculated-total").textContent = "";
      $("calculate-total-button").hidden = !isWorkAnalysis || !records.length;
      status($("table-status"), `${records.length} matching record(s).`, "success");
    } catch (error) {
      $("calculate-total-button").hidden = true;
      $("calculated-total").textContent = "";
      status($("filter-status"), error.message, "error");
      status($("table-status"), "", "");
    }
  }

  $("analysis-fields").innerHTML = fields.map(fieldHtml).join("");
  $("calculate-total-button").addEventListener("click", calculateTotal);
  $("analysis-form").addEventListener("submit", event => { event.preventDefault(); status($("filter-status"), ""); runAnalysis(); });
  $("clear-button").addEventListener("click", () => { $("analysis-form").reset(); status($("filter-status"), ""); runAnalysis(); });
  $("refresh-button").addEventListener("click", runAnalysis);

  (async () => {
    try { await loadLookups(); await runAnalysis(); }
    catch (error) { status($("filter-status"), error.message, "error"); }
  })();
})();
