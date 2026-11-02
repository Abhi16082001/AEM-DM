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
    if (field.type === "multilookup") {
      return String(value || "").split(",").map(key => {
        const match = (lookupValues[field.name] || []).find(item => item.key === key.trim());
        return match ? match.label : key.trim();
      }).filter(Boolean).join(", ");
    }
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
    } else if (field.type === "multilookup") {
      control = `<select id="${id}" name="${escape(field.name)}" multiple ${required}></select>`;
    } else if (field.type === "options") {
      control = `<select id="${id}" name="${escape(field.name)}" ${required}></select>`;
    } else if (field.type === "lookup") {
      control = `<input id="${id}" name="${escape(field.name)}" list="${id}-options" autocomplete="off" ${required} ${maxLength}><datalist id="${id}-options"></datalist>`;
    } else if (field.type === "checkbox") {
      control = `<input id="${id}" name="${escape(field.name)}" type="checkbox">`;
    } else {
      const inputType = field.type === "date" ? "date" : field.type === "integer" || field.type === "number" ? "number" : "text";
      const numberAttributes = field.type === "integer" ? 'step="1" inputmode="numeric"'
        : field.type === "number" ? 'step="any" inputmode="decimal"' : "";
      control = `<input id="${id}" name="${escape(field.name)}" type="${inputType}" ${numberAttributes} ${required} ${maxLength}>`;
    }
    return `<div class="field-group"><label for="${id}">${escape(field.label)}${field.required ? ' <span class="required-mark">*</span>' : ""}</label>${control}</div>`;
  }

  function buildForm() {
    const calculations = config.calculations || (config.calculation ? [config.calculation] : []);
    $("master-fields").innerHTML = fields.map(fieldHtml).join("") + calculations.map((calculation, index) =>
      `<div class="field-group"><label>&nbsp;</label><button id="calculate-button-${index}" class="button button-secondary" type="button">${escape(calculation.label)}</button></div>`
    ).join("");
    calculations.forEach((calculation, index) => {
      $("calculate-button-" + index).addEventListener("click", () => calculateValue(calculation));
    });
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
      return `<tr>${tableFields.map(f => `<td>${escape((f.type === "lookup" || f.type === "multilookup") ? lookupDisplay(f, record[f.name]) : record[f.name] ?? "—")}</td>`).join("")}<td><div class="row-actions">
        <button class="icon-button" type="button" data-action="view" data-key="${key}" title="View">⌕</button>
        <button class="icon-button" type="button" data-action="edit" data-key="${key}" title="Edit">✎</button>
        <button class="icon-button danger btn btn-danger" type="button" data-action="delete" data-key="${key}" title="Delete">⌫</button>
      </div></td></tr>`;
    }).join("");
    window.App.paginateTable($("records-body"));
  }
  async function loadLookups() {
    const lookupFields = fields.filter(f => f.type === "lookup" || f.type === "multilookup" || f.type === "options");
    await Promise.all(lookupFields.map(async field => {
      if (field.type === "options") {
        lookupValues[field.name] = field.options.map(value => ({ key: value, label: value }));
      } else {
        const action = field.lookupAction || "listMasterData";
        const result = await window.App.apiRequest(action, field.lookupAction ? {} : { resource: field.lookupResource });
        let source = result[field.lookupResponse || "records"] || [];
        if (field.lookupResource === "projects") {
          const clientResult = await window.App.apiRequest("listClients");
          const clientsById = Object.fromEntries((clientResult.clients || []).map(client => [String(client.Id), client.Name || ""]));
          source = source.map(record => Object.assign({}, record, { ClientName: clientsById[String(record.ClientId)] || "" }));
        }
        if (field.lookupResource === "vehicles" || field.lookupResource === "staff") {
          const typeResource = field.lookupResource === "vehicles" ? "vehicleTypes" : "staffTypes";
          const typeNameField = field.lookupResource === "vehicles" ? "Vehicle Type Name" : "Staff Type Name";
          const typeResult = await window.App.apiRequest("listMasterData", { resource: typeResource });
          const typeNamesById = Object.fromEntries((typeResult.records || []).map(type => [String(type.Id), type[typeNameField] || ""]));
          source = source.map(record => Object.assign({}, record, { TypeName: typeNamesById[String(record.Type)] || "" }));
        }
        // lookupField is retained as a friendly alias for older config entries.
        // A lookup always submits the key while its searchable list shows a label.
        const keyField = field.lookupKey || field.lookupField;
        lookupValues[field.name] = source.map(record => ({
          key: String(record[keyField] || ""),
          label: String(field.lookupDisplay ? field.lookupDisplay(record) : record[keyField] || "")
        })).filter(item => item.key && item.label);
      }
      const control = $("field-" + field.name.replace(/[^a-z0-9]/gi, "-"));
      if (field.type === "multilookup") {
        control.innerHTML = lookupValues[field.name].map(item =>
          `<option value="${escape(item.key)}">${escape(item.label)}</option>`
        ).join("");
      } else if (field.type === "options") {
        control.innerHTML = `<option value="">Select ${escape(field.label)}</option>` + lookupValues[field.name].map(item =>
          `<option value="${escape(item.key)}">${escape(item.label)}</option>`
        ).join("");
      } else {
        const list = $(control.id + "-options");
        list.innerHTML = lookupValues[field.name].map(item => `<option value="${escape(item.label)}"></option>`).join("");
      }
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
      else if (field.type === "multilookup") {
        const selected = new Set(String(record[field.name] || "").split(",").map(value => value.trim()));
        [...input.options].forEach(option => { option.selected = selected.has(option.value); });
      } else input.value = field.type === "lookup" ? lookupDisplay(field, record[field.name]) : record[field.name] ?? "";
    });
    $("form-title").textContent = `Edit ${config.singular}`; $("save-button").textContent = `Update ${config.singular}`; $("cancel-button").hidden = false;
    $("master-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function showDetails(record) {
    $("dialog-title").textContent = `${config.singular} Details`;
    $("record-details").innerHTML = fields.map(f => `<div class="detail-item"><span>${escape(f.label)}</span><p>${escape((f.type === "lookup" || f.type === "multilookup") ? lookupDisplay(f, record[f.name]) : record[f.name] ?? "—") || "—"}</p></div>`).join("");
    $("record-dialog").showModal();
  }

  $("master-form").addEventListener("submit", async event => {
    event.preventDefault(); if (busy || !event.currentTarget.reportValidity()) return;
    const data = {};
    for (const field of fields) {
      const input = event.currentTarget.elements.namedItem(field.name);
      const value = field.type === "checkbox" ? String(input.checked) : field.type === "multilookup"
        ? [...input.selectedOptions].map(option => option.value).join(",") : input.value.trim();
      if (field.type === "lookup" || field.type === "options") {
        if (!value && !field.required) {
          data[field.name] = "";
          continue;
        }
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

  function calculateValue(calculation) {
    const parseNumber = value => {
      const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : 0;
    };
    const inputs = calculation.inputs || [calculation.left, calculation.right];
    const values = inputs.map(name => parseNumber($("master-form").elements.namedItem(name).value));
    const result = calculation.operation === "sum"
      ? values.reduce((total, value) => total + value, 0)
      : calculation.operation === "subtract"
        ? values.slice(1).reduce((total, value) => total - value, values[0] || 0)
        : values.reduce((total, value) => total * value, 1);
    $("master-form").elements.namedItem(calculation.target).value = String(result);
  }

  buildForm(); buildTableHeader();
  (async () => { try { await loadLookups(); await loadRecords(); await setSuggestedId(); } catch (error) { status($("form-status"), error.message, "error"); } })();
})();
