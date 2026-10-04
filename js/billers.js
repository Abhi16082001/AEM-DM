
(() => {
  "use strict";

  const config = window.APP_CONFIG.BILLERS;
  const form = document.getElementById("billerForm");
  const fieldsContainer = document.getElementById("billerFields");
  const tableHead = document.getElementById("billerTableHead");
  const tableBody = document.getElementById("billerTableBody");
  const formStatus = document.getElementById("formStatus");
  const tableStatus = document.getElementById("tableStatus");
  const formHeading = document.getElementById("formHeading");
  const saveButton = document.getElementById("saveButton");
  const cancelButton = document.getElementById("cancelButton");
  const dialog = document.getElementById("detailDialog");
  const detailBody = document.getElementById("detailBody");

  const editableFields = config.FIELDS.filter(
    field => field.editable
  );
  const tableFields = config.FIELDS.filter(
    field => field.visibleInTable
  );

  let billers = [];
  let editingId = null;
  let busy = false;

  function escapeHTML(value) {
    return window.App.escapeHTML(String(value ?? ""));
  }

  function showStatus(element, message, type = "") {
    element.textContent = message || "";
    element.className = "status" + (type ? ` ${type}` : "");
    element.hidden = !message;
  }

  function setBusy(value) {
    busy = value;
    saveButton.disabled = value;
    cancelButton.disabled = value;
    saveButton.textContent = value
      ? "Please wait..."
      : editingId ? "Update Biller" : "Save Biller";
  }

  // The editor accepts only basic text formatting. The server
  // also sanitizes this HTML before saving it to the spreadsheet.
  function sanitizeRichHTML(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";

    template.content.querySelectorAll(
      "script,style,iframe,object,embed,svg,math,form,input,button,textarea,select"
    ).forEach(element => element.remove());

    const allowedTags = new Set([
      "DIV", "P", "BR", "SPAN", "B", "STRONG",
      "I", "EM", "U", "UL", "OL", "LI", "FONT"
    ]);

    const allowedStyles = new Set([
      "font-size", "font-weight", "font-style",
      "text-decoration", "color", "font-family",
      "text-align"
    ]);

    function cleanNode(node) {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) return;

        if (child.nodeType !== Node.ELEMENT_NODE) {
          child.remove();
          return;
        }

        cleanNode(child);

        if (!allowedTags.has(child.tagName)) {
          child.replaceWith(...child.childNodes);
          return;
        }

        [...child.attributes].forEach(attribute => {
          if (attribute.name !== "style") {
            child.removeAttribute(attribute.name);
          }
        });

        if (child.hasAttribute("style")) {
          const declarations = child.getAttribute("style")
            .split(";")
            .map(item => item.trim())
            .filter(Boolean)
            .filter(item => {
              const colon = item.indexOf(":");
              if (colon < 0) return false;

              const name = item.slice(0, colon).trim().toLowerCase();
              const value = item.slice(colon + 1).trim();

              if (!allowedStyles.has(name)) return false;
              if (/url\s*\(|expression\s*\(|javascript:|[<>]/i.test(value)) {
                return false;
              }

              if (name === "font-size" &&
                  !/^\d+(\.\d+)?(px|pt|em|rem|%)$/i.test(value)) {
                return false;
              }

              if (name === "font-weight" &&
                  !/^(normal|bold|[1-9]00)$/i.test(value)) {
                return false;
              }

              if (name === "font-style" &&
                  !/^(normal|italic|oblique)$/i.test(value)) {
                return false;
              }

              if (name === "text-decoration" &&
                  !/^(none|underline|line-through|overline)$/i.test(value)) {
                return false;
              }

              if (name === "text-align" &&
                  !/^(left|right|center|justify)$/i.test(value)) {
                return false;
              }

              if (name === "color" &&
                  !/^(#[0-9a-f]{3,8}|[a-z]+|rgb[a]?\([\d\s,.%]+\))$/i.test(value)) {
                return false;
              }

              if (name === "font-family" &&
                  !/^[a-z0-9 ,"'_-]+$/i.test(value)) {
                return false;
              }

              return true;
            });

          if (declarations.length) {
            child.setAttribute("style", declarations.join("; "));
          } else {
            child.removeAttribute("style");
          }
        }
      });
    }

    cleanNode(template.content);
    return template.innerHTML;
  }

  function richTextFieldHTML(field) {
    const required = field.required ? "required" : "";
    const maxLength = field.maxLength || 10000;

    return `
      <div class="form-group rich-field">
        <label>${escapeHTML(field.label)}</label>

        <div class="rich-toolbar" data-toolbar>
          <button type="button" data-command="bold"
                  title="Bold"><b>B</b></button>
          <button type="button" data-command="italic"
                  title="Italic"><i>I</i></button>
          <button type="button" data-command="underline"
                  title="Underline"><u>U</u></button>

          <label class="font-size-label">
            Size
            <select data-font-size aria-label="Font size">
              <option value="">Default</option>
              <option value="10px">10</option>
              <option value="12px">12</option>
              <option value="14px">14</option>
              <option value="16px">16</option>
              <option value="18px">18</option>
              <option value="24px">24</option>
              <option value="32px">32</option>
            </select>
          </label>
        </div>

        <div class="rich-editor"
             data-field="${escapeHTML(field.name)}"
             contenteditable="true"
             role="textbox"
             aria-multiline="true"
             aria-label="${escapeHTML(field.label)}"
             data-required="${field.required ? "true" : "false"}"
             data-max-length="${maxLength}"
             ${required}></div>

        <small>Formatting and line breaks are saved with this field.</small>
      </div>
    `;
  }

  function renderForm() {
    fieldsContainer.innerHTML = editableFields.map(field => {
      if (field.type === "richtext") {
        return richTextFieldHTML(field);
      }

      const type = field.type === "email" ? "email" : "text";

      return `
        <div class="form-group">
          <label for="field-${escapeHTML(field.name)}">
            ${escapeHTML(field.label)}
            ${field.required ? '<span aria-hidden="true">*</span>' : ""}
          </label>
          <input
            id="field-${escapeHTML(field.name)}"
            name="${escapeHTML(field.name)}"
            type="${type}"
            maxlength="${field.maxLength || 500}"
            ${field.required ? "required" : ""}
            autocomplete="off"
          >
        </div>
      `;
    }).join("");

    tableHead.innerHTML = `
      <tr>
        ${tableFields.map(field =>
          `<th>${escapeHTML(field.label)}</th>`
        ).join("")}
        <th>Actions</th>
      </tr>
    `;
  }

  function getFieldValue(field) {
    if (field.type === "richtext") {
      const editor = fieldsContainer.querySelector(
        `[data-field="${CSS.escape(field.name)}"]`
      );
      return sanitizeRichHTML(editor?.innerHTML || "");
    }

    return String(
      form.elements.namedItem(field.name)?.value || ""
    ).trim();
  }

  function setFieldValue(field, value) {
    if (field.type === "richtext") {
      const editor = fieldsContainer.querySelector(
        `[data-field="${CSS.escape(field.name)}"]`
      );
      if (editor) editor.innerHTML = sanitizeRichHTML(value || "");
      return;
    }

    const input = form.elements.namedItem(field.name);
    if (input) input.value = value ?? "";
  }

  function resetForm() {
    form.reset();

    editableFields.forEach(field => setFieldValue(field, ""));

    editingId = null;
    formHeading.textContent = "Create Biller";
    cancelButton.hidden = true;
    setBusy(false);
    showStatus(formStatus, "");
  }

  function renderTable() {
    if (!billers.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${tableFields.length + 1}">
            No billers found. Create your first biller above.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = billers.map((biller, index) => `
      <tr>
        ${tableFields.map(field => `
          <td>${escapeHTML(biller[field.name] ?? "")}</td>
        `).join("")}
        <td class="table-actions">
          <button type="button" data-action="view"
                  data-index="${index}" class="btn btn-small">
            View
          </button>
          <button type="button" data-action="edit"
                  data-index="${index}" class="btn btn-small">
            Edit
          </button>
          <button type="button" data-action="delete"
                  data-index="${index}" class="btn btn-small btn-danger">
            Delete
          </button>
        </td>
      </tr>
    `).join("");
  }

  async function loadBillers() {
    showStatus(tableStatus, "Loading billers...");

    const result = await window.App.apiRequest("listBillers");
    billers = Array.isArray(result.billers) ? result.billers : [];

    renderTable();
    showStatus(
      tableStatus,
      `${billers.length} biller${billers.length === 1 ? "" : "s"} found.`
    );
  }

  function beginEdit(biller) {
    resetForm();
    editingId = biller.Id;

    editableFields.forEach(field => {
      setFieldValue(field, biller[field.name] ?? "");
    });

    formHeading.textContent = "Edit Biller";
    cancelButton.hidden = false;
    saveButton.textContent = "Update Biller";

    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function viewBiller(biller) {
    detailBody.innerHTML = config.FIELDS.map(field => {
      const value = biller[field.name] ?? "";

      const renderedValue = field.type === "richtext"
        ? sanitizeRichHTML(value)
        : escapeHTML(value).replace(/\r?\n/g, "<br>");

      return `
        <div class="detail-field">
          <strong>${escapeHTML(field.label)}</strong>
          <div class="detail-value">${renderedValue || "—"}</div>
        </div>
      `;
    }).join("");

    dialog.showModal();
  }

  async function deleteBiller(biller) {
    if (busy) return;

    const confirmed = confirm(
      `Delete biller ${biller.Id} (${biller.Name || ""})? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setBusy(true);
      const result = await window.App.apiRequest("deleteBiller", {
        id: biller.Id
      });

      if (editingId === biller.Id) resetForm();

      await loadBillers();

      showStatus(
        tableStatus,
        result.message || "Biller deleted successfully.",
        "success"
      );
    } catch (error) {
      showStatus(tableStatus, error.message || "Could not delete biller.", "error");
    } finally {
      setBusy(false);
    }
  }

  // Toolbar commands operate on the rich-text editor that was last focused.
  let activeEditor = null;

  fieldsContainer.addEventListener("focusin", event => {
    if (event.target.matches(".rich-editor")) {
      activeEditor = event.target;
    }
  });

  fieldsContainer.addEventListener("click", event => {
    const button = event.target.closest("[data-command]");
    if (!button || !activeEditor) return;

    activeEditor.focus();
    document.execCommand(button.dataset.command, false, null);
  });

  fieldsContainer.addEventListener("change", event => {
    const select = event.target.closest("[data-font-size]");
    if (!select || !select.value || !activeEditor) return;

    activeEditor.focus();

    // Use the browser's rich-text formatting command, then normalize
    // the generated font tag to an explicit CSS font size.
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("fontSize", false, "7");

    activeEditor.querySelectorAll('font[size="7"]').forEach(font => {
      const span = document.createElement("span");
      span.style.fontSize = select.value;
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });

    select.value = "";
  });

  fieldsContainer.addEventListener("input", event => {
    const editor = event.target.closest(".rich-editor");
    if (!editor) return;

    const maxLength = Number(editor.dataset.maxLength || 10000);
    const textLength = editor.innerText.length;

    if (textLength > maxLength) {
      editor.innerText = editor.innerText.slice(0, maxLength);
      showStatus(
        formStatus,
        `This field is limited to ${maxLength} text characters.`,
        "error"
      );
    } else {
      showStatus(formStatus, "");
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;

    // Check normal inputs using browser validation.
    if (!form.reportValidity()) return;

    const data = {};

    for (const field of editableFields) {
      const value = getFieldValue(field);

      if (field.required &&
          (field.type === "richtext"
            ? !fieldsContainer.querySelector(
                `[data-field="${CSS.escape(field.name)}"]`
              )?.innerText.trim()
            : !value)) {
        showStatus(formStatus, `${field.label} is required.`, "error");
        return;
      }

      if (field.type === "richtext") {
        const editor = fieldsContainer.querySelector(
          `[data-field="${CSS.escape(field.name)}"]`
        );
        const maxLength = Number(editor.dataset.maxLength || 10000);

        if (editor.innerText.length > maxLength) {
          showStatus(
            formStatus,
            `${field.label} exceeds its maximum length.`,
            "error"
          );
          return;
        }
      }

      data[field.name] = value;
    }

    const wasEditing = Boolean(editingId);

    try {
      setBusy(true);
      showStatus(formStatus, "");

      const result = wasEditing
        ? await window.App.apiRequest("updateBiller", {
            id: editingId,
            data
          })
        : await window.App.apiRequest("createBiller", { data });

      resetForm();
      await loadBillers();

      showStatus(
        formStatus,
        result.message || (
          wasEditing
            ? "Biller updated successfully."
            : "Biller created successfully."
        ),
        "success"
      );

      document.querySelector(".table-panel").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (error) {
      showStatus(formStatus, error.message || "Could not save biller.", "error");
    } finally {
      setBusy(false);
    }
  });

  tableBody.addEventListener("click", async event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const biller = billers[Number(button.dataset.index)];
    if (!biller) return;

    switch (button.dataset.action) {
      case "view":
        viewBiller(biller);
        break;
      case "edit":
        beginEdit(biller);
        break;
      case "delete":
        await deleteBiller(biller);
        break;
    }
  });

  cancelButton.addEventListener("click", resetForm);

  document.getElementById("closeDialogButton").addEventListener("click", () => {
    dialog.close();
  });

  // Use your existing common.js navigation and authentication.
  window.App.requireLogin();
  window.App.renderNavbar("billers.html");

  renderForm();

  loadBillers().catch(error => {
    showStatus(
      tableStatus,
      error.message || "Unable to load billers.",
      "error"
    );
  });
})();