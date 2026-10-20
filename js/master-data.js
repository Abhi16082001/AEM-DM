(() => {
  if (!window.App.requireLogin()) return;
  window.App.renderNavbar("master-data.html");

  const feature = new URLSearchParams(window.location.search).get("feature");
  const config = window.APP_CONFIG.MASTER_DATA?.[feature];
  if (!config) { window.location.replace("home.html"); return; }

  const $ = id => document.getElementById(id);
  const fields = config.fields;
  const tableFields = fields.filter(field => field.visibleInTable);
  const lookupValues = {};
  let records = [], editingKey = null, busy = false;

  $("page-title").textContent = config.title;
  $("page-subheading").textContent = `Create, view, edit and manage ${config.singular.toLowerCase()} records.`;
  $("form-title").textContent = `Add ${config.singular}`;
  $("table-title").textContent = `${config.singular}s`;
  document.title = `${config.title} — Anil Earth Mover`;

  const status = (element, message, type = "") => { element.textContent = message; element.className = `status ${type}`.trim(); };
  const escape = window.App.escapeHTML;
  const recordKey = record => config.primaryKey ? record[config.primaryKey] : record._rowId;
  const lookupDisplay = (field, value) => {
    const match = (lookupValues[field.name] || []).find(item => item.key === String(value));
    return match ? match.label : value;
  };

  function fieldHtml(field) {
    const id = `field-${field.name.replace(/[^a-z0-9]/gi, "-")}`;
    const required = field.required ? "required" : "";
    const maxLength = field.maxLength ? `maxlength="${Number(field.maxLength)}"` : "";
    let control;
    if (field.type === "textarea") {
      control = `<textarea id="${id}" name="${escape(field.name)}" rows="3" ${required} ${maxLength}></textarea>`;
    } else if (field.type === "lookup" || field.type === "options") {
      control = `<input id="${id}" name="${escape(field.name)}" list="${id}-options" autocomplete="off" ${required} ${maxLength}><datalist id="${id}-options"></datalist>`;
    } else if (field.type === "checkbox") {
      control = `<input id="${id}" name="${escape(field.name)}" type="checkbox">`;
    } else {
      control = `<input id="${id}" name="${escape(field.name)}" type="${field.type === "date" ? "date" : "text"}" ${required} ${maxLength}>`;
    }
    return `<div class="field-group"><label for="${id}">${escape(field.label)}${field.required ? ' <span class="required-mark">*</span>' : ""}</label>${control}</div>`;
  }

  function buildForm() {
    $("master-fields").innerHTML = fields.map(fieldHtml).join("") + (config.calculation
      ? `<div class="field-group"><label>&nbsp;</label><button id="calculate-button" class="button button-secondary" type="button">${escape(config.calculation.label)}</button></div>`
      : "");
    if (config.calculation) $("calculate-button").addEventListener("click", calculateTotal);
  }
  function buildTableHeader() {
    $("records-head").innerHTML = `<tr>${tableFields.map(f => `<th scope="col">${escape(f.label)}</th>`).join("")}<th scope="col" class="actions-column">Actions</th></tr>`;
  }
  function setBusy(value) {
    busy = value; $("save-button").disabled = value; $("refresh-button").disabled = value;
    $("save-button").textContent = value ? "Please wait…" : editingKey ? `Update ${config.singular}` : `Save ${config.singular}`;
  }
  function renderTable() {
    if (!records.length) {
      $("records-body").innerHTML = `<tr><td colspan="${tableFields.length + 1}" class="empty-state">No records found. Add the first ${escape(config.singular.toLowerCase())} above.</td></tr>`;
      window.App.paginateTable($("records-body"));
      return;
    }
    $("records-body").innerHTML = records.map(record => {
      const key = escape(recordKey(record));
      return `<tr>${tableFields.map(f => `<td>${escape(f.type === "lookup" ? lookupDisplay(f, record[f.name]) : record[f.name] ?? "—")}</td>`).join("")}<td><div class="row-actions">
        <button class="icon-button" type="button" data-action="view" data-key="${key}" title="View">⌕</button>
        <button class="icon-button" type="button" data-action="edit" data-key="${key}" title="Edit">✎</button>
        <button class="icon-button danger btn btn-danger" type="button" data-action="delete" data-key="${key}" title="Delete">⌫</button>
      </div></td></tr>`;
    }).join("");
    window.App.paginateTable($("records-body"));
  }
  async function loadLookups() {
    const lookupFields = fields.filter(f => f.type === "lookup" || f.type === "options");
    await Promise.all(lookupFields.map(async field => {
      if (field.type === "options") {
        lookupValues[field.name] = field.options.map(value => ({ key: value, label: value }));
      } else {
        const action = field.lookupAction || "listMasterData";
        const result = await window.App.apiRequest(action, field.lookupAction ? {} : { resource: field.lookupResource });
        const source = result[field.lookupResponse || "records"] || [];
        // lookupField is retained as a friendly alias for older config entries.
        // A lookup always submits the key while its searchable list shows a label.
        const keyField = field.lookupKey || field.lookupField;
        lookupValues[field.name] = source.map(record => ({
          key: String(record[keyField] || ""),
          label: String(field.lookupDisplay ? field.lookupDisplay(record) : record[keyField] || "")
        })).filter(item => item.key && item.label);
      }
      const list = $("field-" + field.name.replace(/[^a-z0-9]/gi, "-") + "-options");
      list.innerHTML = lookupValues[field.name].map(item => `<option value="${escape(item.label)}"></option>`).join("");
    }));
  }
  async function setSuggestedId() {
    if (!config.autoId || editingKey) return;
    const result = await window.App.apiRequest("nextMasterDataId", { resource: config.resource });
    $("master-form").elements.namedItem(config.primaryKey).value = result.nextId;
  }
  async function loadRecords() {
    status($("table-status"), "Loading records…");
    try {
      const result = await window.App.apiRequest("listMasterData", { resource: config.resource });
      records = result.records || []; renderTable();
      status($("table-status"), `${records.length} record(s) found.`, "success");
    } catch (error) { status($("table-status"), error.message, "error"); }
  }
  async function resetForm() {
    editingKey = null; $("master-form").reset(); $("form-title").textContent = `Add ${config.singular}`;
    $("save-button").textContent = `Save ${config.singular}`; $("cancel-button").hidden = true; status($("form-status"), "");
    try { await setSuggestedId(); } catch (error) { status($("form-status"), error.message, "error"); }
  }
  function editRecord(record) {
    editingKey = recordKey(record);
    fields.forEach(field => {
      const input = $("master-form").elements.namedItem(field.name);
      if (field.type === "checkbox") input.checked = String(record[field.name]).toLowerCase() === "true";
      else input.value = field.type === "lookup" ? lookupDisplay(field, record[field.name]) : record[field.name] ?? "";
    });
    $("form-title").textContent = `Edit ${config.singular}`; $("save-button").textContent = `Update ${config.singular}`; $("cancel-button").hidden = false;
    $("master-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function showDetails(record) {
    $("dialog-title").textContent = `${config.singular} Details`;
    $("record-details").innerHTML = fields.map(f => `<div class="detail-item"><span>${escape(f.label)}</span><p>${escape(f.type === "lookup" ? lookupDisplay(f, record[f.name]) : record[f.name] ?? "—") || "—"}</p></div>`).join("");
    $("record-dialog").showModal();
  }

  $("master-form").addEventListener("submit", async event => {
    event.preventDefault(); if (busy || !event.currentTarget.reportValidity()) return;
    const data = {};
    for (const field of fields) {
      const input = event.currentTarget.elements.namedItem(field.name);
      const value = field.type === "checkbox" ? String(input.checked) : input.value.trim();
      if (field.type === "lookup" || field.type === "options") {
        const choice = (lookupValues[field.name] || []).find(item => item.label === value);
        if (!choice) { status($("form-status"), `Select a valid ${field.label}.`, "error"); return; }
        data[field.name] = choice.key;
      } else data[field.name] = value;
    }
    const wasEditing = Boolean(editingKey); setBusy(true); status($("form-status"), "");
    try {
      const result = await window.App.apiRequest(wasEditing ? "updateMasterData" : "createMasterData", {
        resource: config.resource, id: editingKey, data
      });
      await loadLookups(); await loadRecords(); await resetForm();
      status($("form-status"), result.message || "Saved successfully.", "success");
    } catch (error) { status($("form-status"), error.message, "error"); }
    finally { setBusy(false); }
  });
  $("records-body").addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const record = records.find(item => String(recordKey(item)) === button.dataset.key); if (!record) return;
    if (button.dataset.action === "view") return showDetails(record);
    if (button.dataset.action === "edit") return editRecord(record);
    if (!confirm(`Delete ${config.singular.toLowerCase()} ${recordKey(record)}? This cannot be undone.`)) return;
    try {
      const result = await window.App.apiRequest("deleteMasterData", { resource: config.resource, id: recordKey(record) });
      if (editingKey === recordKey(record)) await resetForm();
      await loadLookups(); await loadRecords(); status($("table-status"), result.message, "success");
    } catch (error) { status($("table-status"), error.message, "error"); }
  });
  $("cancel-button").addEventListener("click", resetForm);
  $("refresh-button").addEventListener("click", async () => { await loadLookups(); await loadRecords(); });
  $("close-dialog").addEventListener("click", () => $("record-dialog").close());

  function calculateTotal() {
    const parseNumber = value => {
      const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : 0;
    };
    const { left, right, target } = config.calculation;
    $("master-form").elements.namedItem(target).value = (parseNumber($("master-form").elements.namedItem(left).value) * parseNumber($("master-form").elements.namedItem(right).value)).toFixed(2);
  }

  buildForm(); buildTableHeader();
  (async () => { try { await loadLookups(); await loadRecords(); await setSuggestedId(); } catch (error) { status($("form-status"), error.message, "error"); } })();
})();
