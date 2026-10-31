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
  const totalField = config.totalField;
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

  function selectedSortField() {
    return fields.find(field => field.name === $("sort-by").value);
  }

  function sortValue(field, value) {
    const text = String(value ?? "").trim();
    if (field.type === "date") {
      const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      // Sheets in this application use day/month/year display dates.
      const dayFirst = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dayFirst) return Date.UTC(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1]));
      const parsed = Date.parse(text);
      return Number.isNaN(parsed) ? text.toLocaleLowerCase() : parsed;
    }
    const numeric = text.replace(/,/g, "");
    if (numeric && /^-?\d+(?:\.\d+)?$/.test(numeric)) return Number(numeric);
    return text.toLocaleLowerCase();
  }

  function compareSortValues(left, right) {
    if (typeof left === "number" && typeof right === "number") return left - right;
    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
  }

  function applySort() {
    const field = selectedSortField();
    if (!field) return;
    const direction = $("sort-order").value === "desc" ? -1 : 1;
    records = records.map((record, index) => ({ record, index, value: sortValue(field, record[field.name]) }))
      .sort((left, right) => {
        const comparison = compareSortValues(left.value, right.value);
        return comparison ? comparison * direction : left.index - right.index;
      })
      .map(item => item.record);
  }

  function groupStyle(record, previousRecord, currentGroup) {
    const field = selectedSortField();
    if (!field) return { inline: "", group: currentGroup };
    const isNewGroup = !previousRecord ||
      compareSortValues(sortValue(field, previousRecord[field.name]), sortValue(field, record[field.name])) !== 0;
    const group = isNewGroup && previousRecord ? currentGroup + 1 : currentGroup;
    const colors = config.groupColors || [];
    const color = colors[group % colors.length];
    return {
      inline: color ? ` style="background-color:${color.background};color:${color.color}"` : "",
      group
    };
  }

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
      window.App.paginateTable($("records-body"));
      return;
    }
    $("records-body").innerHTML = records.map(record => `<tr>${fields.map(field =>
      `<td>${escape(field.type === "lookup" ? lookupDisplay(field, record[field.name]) : record[field.name] ?? "—")}</td>`
    ).join("")}</tr>`).join("");
    let previousRecord = null;
    let currentGroup = 0;
    [...$("records-body").rows].forEach((row, index) => {
      const style = groupStyle(records[index], previousRecord, currentGroup);
      previousRecord = records[index];
      currentGroup = style.group;
      if (style.inline) {
        const colors = (config.groupColors || [])[currentGroup % (config.groupColors || []).length];
        row.style.backgroundColor = colors.background;
        row.style.color = colors.color;
      }
    });
    window.App.paginateTable($("records-body"));
  }

  function calculateTotal() {
    const total = records.reduce((sum, record) => {
      // Totals are saved as text, so accept standard comma-formatted amounts
      // while ignoring blank values.
      const raw = String(record[totalField] ?? "").replace(/,/g, "").trim();
      const value = raw ? Number(raw) : 0;
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    status($("calculated-total"), `Total of all ${records.length} filtered ${config.totalLabel || "record(s)"}: ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, "success");
  }

  function excelCsvValue(value) {
    let text = String(value ?? "");
    // Prevent spreadsheet formula execution when a text value happens to
    // begin with a formula character.
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function downloadFilteredRecords() {
    const rows = [
      fields.map(field => field.label),
      ...records.map(record => fields.map(field =>
        field.type === "lookup" ? lookupDisplay(field, record[field.name]) : record[field.name] ?? ""
      ))
    ];
    // CSV is supported directly by Excel and preserves every filtered record,
    // independent of the table's selected page size.
    const csv = "\uFEFF" + rows.map(row => row.map(excelCsvValue).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = URL.createObjectURL(blob);
    link.download = `${config.resource}-analysis-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
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
      applySort();
      buildTable();
      $("calculated-total").textContent = "";
      $("calculate-total-button").hidden = !totalField || !records.length;
      $("download-button").hidden = !records.length;
      status($("table-status"), `${records.length} matching record(s).`, "success");
    } catch (error) {
      $("calculate-total-button").hidden = true;
      $("download-button").hidden = true;
      $("calculated-total").textContent = "";
      status($("filter-status"), error.message, "error");
      status($("table-status"), "", "");
    }
  }

  $("analysis-fields").innerHTML = fields.map(fieldHtml).join("");
  $("sort-by").innerHTML = '<option value="">No sorting</option>' + fields
    .map(field => `<option value="${escape(field.name)}">${escape(field.label)}</option>`).join("");
  $("calculate-total-button").addEventListener("click", calculateTotal);
  $("download-button").addEventListener("click", downloadFilteredRecords);
  $("sort-by").addEventListener("change", () => { applySort(); buildTable(); });
  $("sort-order").addEventListener("change", () => { applySort(); buildTable(); });
  $("analysis-form").addEventListener("submit", event => { event.preventDefault(); status($("filter-status"), ""); runAnalysis(); });
  $("clear-button").addEventListener("click", () => { $("analysis-form").reset(); status($("filter-status"), ""); runAnalysis(); });
  $("refresh-button").addEventListener("click", runAnalysis);

  (async () => {
    try { await loadLookups(); await runAnalysis(); }
    catch (error) { status($("filter-status"), error.message, "error"); }
  })();
})();
