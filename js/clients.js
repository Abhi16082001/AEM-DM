
(() => {
  if (!window.App.requireLogin()) return;

  window.App.renderNavbar("clients.html");

  const config = window.APP_CONFIG.CLIENTS;
  const fields = config.FIELDS;
  const form = document.getElementById("client-form");
  const fieldsContainer = document.getElementById("client-fields");
  const formTitle = document.getElementById("form-title");
  const saveButton = document.getElementById("save-button");
  const cancelButton = document.getElementById("cancel-button");
  const formStatus = document.getElementById("form-status");
  const tableStatus = document.getElementById("table-status");
  const tableHead = document.getElementById("clients-head");
  const tableBody = document.getElementById("clients-body");
  const dialog = document.getElementById("client-dialog");
  const detailsContainer = document.getElementById("client-details");

  let clients = [];
  let editingId = null;
  let busy = false;

  const editableFields = fields.filter(field =>
    field.name !== "Id" && field.editable !== false
  );

  const tableFields = fields.filter(field =>
    field.visibleInTable && field.name !== "SiteAddress"
  );

  function showStatus(element, message, type = "") {
    element.textContent = message;
    element.className = `status ${type}`.trim();
  }

  function setBusy(value) {
    busy = value;
    saveButton.disabled = value;
    saveButton.textContent = value
      ? "Please wait…"
      : editingId ? "Update Client" : "Save Client";

    document.getElementById("refresh-button").disabled = value;
  }

  function makeField(field) {
    const id = `field-${field.name}`;
    const required = field.required ? "required" : "";
    const maxLength = field.maxLength
      ? `maxlength="${Number(field.maxLength)}"`
      : "";

    const control = field.type === "textarea"
      ? `<textarea id="${id}" name="${window.App.escapeHTML(field.name)}"
             ${required} ${maxLength} rows="3"></textarea>`
      : `<input id="${id}" name="${window.App.escapeHTML(field.name)}"
             type="${field.type === "email" ? "email" : "text"}"
             ${required} ${maxLength}>`;

    return `
      <div class="field-group">
        <label for="${id}">
          ${window.App.escapeHTML(field.label || field.name)}
          ${field.required ? '<span class="required-mark">*</span>' : ""}
        </label>
        ${control}
      </div>
    `;
  }

  function buildForm() {
    fieldsContainer.innerHTML = editableFields.map(makeField).join("");
  }

  function buildTableHeader() {
    tableHead.innerHTML = `
      <tr>
        ${tableFields.map(field => `
          <th scope="col">${window.App.escapeHTML(field.label || field.name)}</th>
        `).join("")}
        <th scope="col" class="actions-column">Actions</th>
      </tr>
    `;
  }

  function renderTable() {
    if (!clients.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${tableFields.length + 1}" class="empty-state">
            No clients found. Add your first client using the form above.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = clients.map(client => `
      <tr>
        ${tableFields.map(field => `
          <td>${window.App.escapeHTML(client[field.name] ?? "—")}</td>
        `).join("")}

        <td>
          <div class="row-actions">
            <button class="icon-button" type="button"
              data-action="view" data-id="${window.App.escapeHTML(client.Id)}"
              aria-label="View client" title="View">⌕</button>

            <button class="icon-button" type="button"
              data-action="edit" data-id="${window.App.escapeHTML(client.Id)}"
              aria-label="Edit client" title="Edit">✎</button>

            <button class="icon-button danger" type="button"
              data-action="delete" data-id="${window.App.escapeHTML(client.Id)}"
              aria-label="Delete client" title="Delete">⌫</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  async function loadClients() {
    if (busy) return;

    showStatus(tableStatus, "Loading clients…");

    try {
      const result = await window.App.apiRequest("listClients");
      clients = result.clients || [];
      renderTable();
      showStatus(tableStatus, `${clients.length} client(s) found.`, "success");
    } catch (error) {
      showStatus(tableStatus, error.message, "error");
    }
  }

  function resetForm() {
    editingId = null;
    form.reset();
    formTitle.textContent = "Add Client";
    saveButton.textContent = "Save Client";
    cancelButton.hidden = true;
    showStatus(formStatus, "");
  }

  function fillForm(client) {
    editingId = client.Id;

    for (const field of editableFields) {
      const input = form.elements.namedItem(field.name);
      if (input) input.value = client[field.name] ?? "";
    }

    formTitle.textContent = `Edit Client — ${client.Id}`;
    saveButton.textContent = "Update Client";
    cancelButton.hidden = false;

    showStatus(formStatus, `Editing ${client.Id}.`);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showDetails(client) {
    detailsContainer.innerHTML = fields.map(field => `
      <div class="detail-item">
        <span>${window.App.escapeHTML(field.label || field.name)}</span>
        <p>${window.App.escapeHTML(client[field.name] ?? "—") || "—"}</p>
      </div>
    `).join("");

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      showStatus(formStatus, "Your browser does not support the details dialog.", "error");
    }
  }

  async function deleteClient(client) {
    if (!confirm(`Delete client ${client.Id} (${client.Name || ""})? This cannot be undone.`)) {
      return;
    }

    try {
      const result = await window.App.apiRequest("deleteClient", {
        id: client.Id
      });

      showStatus(tableStatus, result.message || "Client deleted.", "success");

      if (editingId === client.Id) resetForm();

      await loadClients();
    } catch (error) {
      showStatus(tableStatus, error.message, "error");
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (busy) return;

    if (!form.reportValidity()) return;

    const data = {};

    for (const field of editableFields) {
      data[field.name] = form.elements.namedItem(field.name).value.trim();
    }

    setBusy(true);
    showStatus(formStatus, "");

    try {
      const result = editingId
        ? await window.App.apiRequest("updateClient", {
            id: editingId,
            data
          })
        : await window.App.apiRequest("createClient", { data });

      showStatus(formStatus, result.message || "Saved successfully.", "success");
      resetForm();
      await loadClients();
    } catch (error) {
      showStatus(formStatus, error.message, "error");
    } finally {
      setBusy(false);
    }
  });

  tableBody.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const client = clients.find(item => item.Id === button.dataset.id);
    if (!client) return;

    switch (button.dataset.action) {
      case "view":
        showDetails(client);
        break;

      case "edit":
        fillForm(client);
        break;

      case "delete":
        await deleteClient(client);
        break;
    }
  });

  cancelButton.addEventListener("click", resetForm);
  document.getElementById("close-dialog").addEventListener("click", () => {
    dialog.close();
  });
  document.getElementById("refresh-button").addEventListener("click", loadClients);

  buildForm();
  buildTableHeader();
  loadClients();
})();