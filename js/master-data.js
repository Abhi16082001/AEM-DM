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
  document.title = `${config.title} — Bill Creator`;

  const status = (element, message, type = "") => { element.textContent = message; element.className = `status ${type}`.trim(); };
  const escape = window.App.escapeHTML;

  function fieldHtml(field) {
    const id = `field-${field.name.replace(/[^a-z0-9]/gi, "-")}`;
    const required = field.required ? "required" : "";
    const maxLength = field.maxLength ? `maxlength="${Number(field.maxLength)}"` : "";
    let control;
    if (field.type === "textarea") {
      control = `<textarea id="${id}" name="${escape(field.name)}" rows="3" ${required} ${maxLength}></textarea>`;
    } else if (field.type === "lookup") {
      control = `<input id="${id}" name="${escape(field.name)}" list="${id}-options" autocomplete="off" ${required} ${maxLength}><datalist id="${id}-options"></datalist>`;
    } else {
      control = `<input id="${id}" name="${escape(field.name)}" type="text" ${required} ${maxLength}>`;
    }
    return `<div class="field-group"><label for="${id}">${escape(field.label)}${field.required ? ' <span class="required-mark">*</span>' : ""}</label>${control}</div>`;
  }

  function buildForm() { $("master-fields").innerHTML = fields.map(fieldHtml).join(""); }
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
      return;
    }
    $("records-body").innerHTML = records.map(record => {
      const key = escape(record[config.primaryKey]);
      return `<tr>${tableFields.map(f => `<td>${escape(record[f.name] ?? "—")}</td>`).join("")}<td><div class="row-actions">
        <button class="icon-button" type="button" data-action="view" data-key="${key}" title="View">⌕</button>
        <button class="icon-button" type="button" data-action="edit" data-key="${key}" title="Edit">✎</button>
        <button class="icon-button danger btn btn-danger" type="button" data-action="delete" data-key="${key}" title="Delete">⌫</button>
      </div></td></tr>`;
    }).join("");
  }
  async function loadLookups() {
    const lookupFields = fields.filter(f => f.type === "lookup");
    await Promise.all(lookupFields.map(async field => {
      const result = await window.App.apiRequest("listMasterData", { resource: field.lookupResource });
      lookupValues[field.name] = (result.records || []).map(record => String(record[field.lookupField] || "")).filter(Boolean);
      const list = $("field-" + field.name.replace(/[^a-z0-9]/gi, "-") + "-options");
      list.innerHTML = lookupValues[field.name].map(value => `<option value="${escape(value)}"></option>`).join("");
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
    editingKey = record[config.primaryKey];
    fields.forEach(field => { $("master-form").elements.namedItem(field.name).value = record[field.name] ?? ""; });
    $("form-title").textContent = `Edit ${config.singular}`; $("save-button").textContent = `Update ${config.singular}`; $("cancel-button").hidden = false;
    $("master-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function showDetails(record) {
    $("dialog-title").textContent = `${config.singular} Details`;
    $("record-details").innerHTML = fields.map(f => `<div class="detail-item"><span>${escape(f.label)}</span><p>${escape(record[f.name] ?? "—") || "—"}</p></div>`).join("");
    $("record-dialog").showModal();
  }

  $("master-form").addEventListener("submit", async event => {
    event.preventDefault(); if (busy || !event.currentTarget.reportValidity()) return;
    const data = {};
    for (const field of fields) {
      const value = event.currentTarget.elements.namedItem(field.name).value.trim();
      if (field.type === "lookup" && !lookupValues[field.name].includes(value)) { status($("form-status"), `Select a valid ${field.label}.`, "error"); return; }
      data[field.name] = value;
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
    const record = records.find(item => String(item[config.primaryKey]) === button.dataset.key); if (!record) return;
    if (button.dataset.action === "view") return showDetails(record);
    if (button.dataset.action === "edit") return editRecord(record);
    if (!confirm(`Delete ${config.singular.toLowerCase()} ${record[config.primaryKey]}? This cannot be undone.`)) return;
    try {
      const result = await window.App.apiRequest("deleteMasterData", { resource: config.resource, id: record[config.primaryKey] });
      if (editingKey === record[config.primaryKey]) await resetForm();
      await loadLookups(); await loadRecords(); status($("table-status"), result.message, "success");
    } catch (error) { status($("table-status"), error.message, "error"); }
  });
  $("cancel-button").addEventListener("click", resetForm);
  $("refresh-button").addEventListener("click", async () => { await loadLookups(); await loadRecords(); });
  $("close-dialog").addEventListener("click", () => $("record-dialog").close());

  buildForm(); buildTableHeader();
  (async () => { try { await loadLookups(); await loadRecords(); await setSuggestedId(); } catch (error) { status($("form-status"), error.message, "error"); } })();
})();
