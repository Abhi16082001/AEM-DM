/**
 * Config-driven master-data API for Vehicle Types, Vehicles, Staff Types,
 * and Staff. Keep this file separate from Code.gs and BillManagement.gs.
 */
const MASTER_DATA_RESOURCES = {
  // initialHeaders are used only when this project creates an empty sheet.
  // Once a sheet has headers, those headers are the form's data contract. This
  // lets a new column be added by updating the sheet and js/config.js only.
  vehicleTypes: { sheetName: "Types", initialHeaders: ["Id", "Vehicle Type Name", "Staff Type Name", "Data Type Name"], primaryKey: "Id", recordField: "Vehicle Type Name", required: ["Vehicle Type Name"], sharedSheet: true, autoId: true },
  staffTypes: { sheetName: "Types", initialHeaders: ["Id", "Vehicle Type Name", "Staff Type Name", "Data Type Name"], primaryKey: "Id", recordField: "Staff Type Name", required: ["Staff Type Name"], sharedSheet: true, autoId: true },
  vehicles: { sheetName: "Vehicles", initialHeaders: ["Vehicle No", "Type"], primaryKey: "Vehicle No", required: ["Vehicle No", "Type"] },
  staff: { sheetName: "Staff", initialHeaders: ["Id", "Name", "Type", "Remarks"], primaryKey: "Id", required: ["Id", "Name", "Type"], autoId: true },
  work: { sheetName: "Work", initialHeaders: ["WorkId", "DataType", "Description", "Date", "VehicleType", "Vehicle", "Client", "Project", "SiteAddress", "Quantity", "Night", "Rate", "Total", "Diesel", "Additional Charge", "Net Amount", "Staff", "Remarks"], primaryKey: "WorkId", required: ["DataType", "Date", "Quantity", "Rate", "Total", "Diesel", "Additional Charge", "Net Amount"], autoId: true },
  staffManagement: { sheetName: "StaffManagement", initialHeaders: ["Date", "Staff", "Amount", "Remarks"], required: ["Date", "Staff", "Amount"] },
  bank: { sheetName: "Bank", initialHeaders: ["Id", "Account Holder Name", "Last 6 Digit of Bank Account", "Bank Name", "Branch Name", "Saving/Current", "IFSC Code"], primaryKey: "Id", required: ["Id", "Account Holder Name", "Last 6 Digit of Bank Account", "Bank Name", "Saving/Current", "IFSC Code"], autoId: true },
  statement: { sheetName: "Statement", initialHeaders: ["Date", "Bank", "Debit/Credit", "Amount", "To/From", "BillNo", "Remarks"], required: ["Date", "Bank", "Debit/Credit", "Amount", "To/From"] },
  dataType: { sheetName: "Types", initialHeaders: ["Id", "Vehicle Type Name", "Staff Type Name", "Data Type Name"], primaryKey: "Id", recordField: "Data Type Name", required: ["Data Type Name"], sharedSheet: true, autoId: true },
  projects: { sheetName: "Projects", initialHeaders: ["Id", "ProjectName", "ClientId", "ProjectStartDate", "ProjectEndDate", "ProjectAmount", "ProjectDescription", "PaymentRecieved", "PaymentLeft", "ProjectStatus", "Remarks"], primaryKey: "Id", required: ["ProjectName", "ClientId", "ProjectStartDate", "ProjectEndDate", "ProjectAmount"], autoId: true }
};

function handleMasterDataAction_(request) {
  switch (request.action) {
    case "listMasterData": return listMasterData_(request.resource);
    case "createMasterData": return createMasterData_(request.resource, request.data || {});
    case "updateMasterData": return updateMasterData_(request.resource, request.id, request.data || {});
    case "deleteMasterData": return deleteMasterData_(request.resource, request.id);
    case "nextMasterDataId": return nextMasterDataId_(request.resource);
    case "analyzeMasterData": return analyzeMasterData_(request.resource, request.filters || {});
    default: return null;
  }
}

function getMasterDataResource_(name) {
  const resource = MASTER_DATA_RESOURCES[String(name || "")];
  if (!resource) throw new Error("Unknown master-data resource.");
  return resource;
}

function getMasterDataSheet_(resourceName) {
  const resource = getMasterDataResource_(resourceName);
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(resource.sheetName);
  if (!sheet) sheet = ss.insertSheet(resource.sheetName);

  const lastColumn = sheet.getLastColumn();
  let headers = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(String) : [];
  headers = headers.map(value => value.trim());
  if (!headers.length || headers.every(value => !value)) {
    sheet.getRange(1, 1, 1, resource.initialHeaders.length).setValues([resource.initialHeaders]);
    headers = resource.initialHeaders.slice();
  }
  if (headers.some(value => !value)) throw new Error(`${resource.sheetName} has an empty header.`);
  if (new Set(headers).size !== headers.length) throw new Error(`${resource.sheetName} has duplicate headers.`);
  if (resource.primaryKey && !headers.includes(resource.primaryKey)) {
    throw new Error(`${resource.sheetName} must have a ${resource.primaryKey} header.`);
  }
  return { resource, sheet, headers };
}

function readMasterData_(resourceName) {
  const result = getMasterDataSheet_(resourceName);
  const { resource, sheet, headers } = result;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return Object.assign(result, { records: [] });
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues();
  const keyIndex = resource.primaryKey ? headers.indexOf(resource.primaryKey) : -1;
  const recordFieldIndex = resource.recordField ? headers.indexOf(resource.recordField) : -1;
  const records = values.map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(item => resource.primaryKey
      ? String(item.row[keyIndex] || "").trim() && (recordFieldIndex === -1 || String(item.row[recordFieldIndex] || "").trim())
      : item.row.some(value => String(value).trim()))
    .map(item => {
    const record = {};
    headers.forEach((header, index) => { record[header] = String(item.row[index] || "").trim(); });
    record._rowId = String(item.rowNumber);
    return record;
  });
  return Object.assign(result, { records });
}

function validateMasterData_(resource, headers, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid record data.");
  const invalid = Object.keys(data).filter(key => !headers.includes(key));
  if (invalid.length) throw new Error("Invalid field supplied.");
  const clean = {};
  Object.keys(data).forEach(header => {
    const value = data[header];
    if (value !== undefined && value !== null && typeof value === "object") throw new Error("Field values must be plain text.");
    clean[header] = String(value || "").trim();
    const maxLength = resource.sheetName === "Work" && header === "Description" ? 5000 : 1000;
    if (clean[header].length > maxLength) throw new Error("A field value is too long.");
  });
  resource.required.forEach(header => {
    if (!clean[header] && !(resource.autoId && header === resource.primaryKey)) {
      throw new Error(`${header} is required.`);
    }
  });
  if (resource.sharedSheet) {
    const typeFields = ["Vehicle Type Name", "Staff Type Name", "Data Type Name"];
    if (typeFields.filter(header => clean[header]).some(header => header !== resource.recordField)) {
      throw new Error("A Types row may contain only one type name.");
    }
  }
  return clean;
}

function findMasterDataRow_(sheet, headers, primaryKey, id) {
  if (!primaryKey) {
    const rowNumber = Number(id);
    return Number.isInteger(rowNumber) && rowNumber >= 2 && rowNumber <= sheet.getLastRow() ? rowNumber : -1;
  }
  const column = headers.indexOf(primaryKey) + 1;
  const lastRow = sheet.getLastRow();
  if (!column || lastRow < 2) return -1;
  const values = sheet.getRange(2, column, lastRow - 1, 1).getDisplayValues();
  for (let i = 0; i < values.length; i++) if (String(values[i][0]).trim() === id) return i + 2;
  return -1;
}

function validateMasterDataLookup_(resourceName, clean) {
  if (resourceName === "vehicles" && clean.Type) {
    const types = readMasterData_("vehicleTypes").records.map(record => record.Id);
    if (!types.includes(clean.Type)) throw new Error("Select a valid vehicle type.");
  }
  if (resourceName === "staff" && clean.Type) {
    const types = readMasterData_("staffTypes").records.map(record => record.Id);
    if (!types.includes(clean.Type)) throw new Error("Select a valid staff type.");
  }
  if (resourceName === "work") {
    if (!masterDataKeyExists_("dataType", clean.DataType)) throw new Error("Select a valid data type.");
    ["Diesel", "Additional Charge", "Net Amount"].forEach(header => {
      if (!/^-?\d+$/.test(String(clean[header] || ""))) {
        throw new Error(header + " must be an integer.");
      }
    });
    if (clean.VehicleType && !masterDataKeyExists_("vehicleTypes", clean.VehicleType)) throw new Error("Select a valid vehicle type.");
    validateDelimitedMasterDataKeys_("vehicles", clean.Vehicle, "Select valid vehicle values.");
    if (!clean.Client && !clean.Project) throw new Error("Select at least a client or a project.");
    if (clean.Client && !readClients_().clients.some(client => String(client.Id) === clean.Client)) {
      throw new Error("Select a valid client.");
    }
    if (clean.Project && !masterDataKeyExists_("projects", clean.Project)) {
      throw new Error("Select a valid project.");
    }
    validateDelimitedMasterDataKeys_("staff", clean.Staff, "Select valid staff member values.");
  }
  if (resourceName === "staffManagement" && !masterDataKeyExists_("staff", clean.Staff)) {
    throw new Error("Select a valid staff member.");
  }
  if (resourceName === "statement") {
    if (!masterDataKeyExists_("bank", clean.Bank)) throw new Error("Select a valid bank account.");
    if (!["Debit", "Credit"].includes(clean["Debit/Credit"])) throw new Error("Select Debit or Credit.");
  }
  if (resourceName === "projects") {
    if (clean.ClientId && !readClients_().clients.some(client => String(client.Id) === clean.ClientId)) {
      throw new Error("Select a valid client.");
    }
    ["PaymentRecieved", "PaymentLeft"].forEach(header => {
      if (clean[header] && !/^-?\d+(?:\.\d+)?$/.test(clean[header])) {
        throw new Error(header + " must be an amount.");
      }
    });
    if (clean.ProjectStatus && !["Not Started", "Started", "Pending", "Completed", "Not Completed"].includes(clean.ProjectStatus)) {
      throw new Error("Select a valid project status.");
    }
  }
  if (resourceName === "bank" && !["Saving", "Current"].includes(clean["Saving/Current"])) {
    throw new Error("Select Saving or Current.");
  }
}

function validateDelimitedMasterDataKeys_(resourceName, value, message) {
  const keys = String(value || "").split(",").map(item => item.trim()).filter(Boolean);
  if (!keys.length) return;
  const resource = getMasterDataResource_(resourceName);
  const valid = new Set(readMasterData_(resourceName).records.map(record => String(record[resource.primaryKey])));
  if (keys.some(key => !valid.has(key))) throw new Error(message);
}

function masterDataKeyExists_(resourceName, key) {
  const resource = getMasterDataResource_(resourceName);
  return readMasterData_(resourceName).records.some(record => String(record[resource.primaryKey]) === String(key));
}

function getNextStaffId_(sheet, headers) {
  const idColumn = headers.indexOf("Id") + 1;
  const lastRow = sheet.getLastRow();
  let maxId = 0;
  if (lastRow >= 2) sheet.getRange(2, idColumn, lastRow - 1, 1).getDisplayValues().forEach(row => {
    const value = String(row[0]).trim();
    if (/^\d+$/.test(value)) maxId = Math.max(maxId, Number(value));
  });
  return String(maxId + 1);
}

function getNextWorkId_(sheet, headers) {
  const idColumn = headers.indexOf("WorkId") + 1;
  const lastRow = sheet.getLastRow();
  let maxId = 0;
  if (idColumn && lastRow >= 2) {
    sheet.getRange(2, idColumn, lastRow - 1, 1).getDisplayValues().forEach(row => {
      const match = String(row[0]).trim().match(/^W(\d+)$/i);
      if (match) maxId = Math.max(maxId, Number(match[1]));
    });
  }
  return "W" + (maxId + 1);
}

function nextMasterDataIdValue_(resourceName, sheet, headers) {
  return resourceName === "work" ? getNextWorkId_(sheet, headers) : getNextStaffId_(sheet, headers);
}

function listMasterData_(resourceName) {
  const result = readMasterData_(resourceName);
  return json_({ success: true, records: result.records, fields: result.headers });
}

function nextMasterDataId_(resourceName) {
  const { resource, sheet, headers } = getMasterDataSheet_(resourceName);
  if (!resource.autoId) throw new Error("This resource does not use generated IDs.");
  return json_({ success: true, nextId: nextMasterDataIdValue_(resourceName, sheet, headers) });
}

function getWorkMirrorTargets_(record, headers) {
  const targets = [];
  if (record.Client) {
    const client = readClients_().clients.find(item => String(item.Id) === String(record.Client));
    if (!client) throw new Error("Select a valid client.");
    targets.push({
      key: "client:" + client.Id,
      sheet: createClientWorkSheet_(client.Id, client.Name, headers)
    });
  }
  if (record.Project) {
    const project = readMasterData_("projects").records
      .find(item => String(item.Id) === String(record.Project));
    if (!project) throw new Error("Select a valid project.");
    targets.push({
      key: "project:" + project.Id,
      sheet: createProjectWorkSheet_(project.Id, project.ProjectName, headers)
    });
  }
  return targets;
}

function findWorkMirrorRowById_(sheet, headers, workId) {
  const idColumn = headers.indexOf("WorkId") + 1;
  const lastRow = sheet.getLastRow();
  if (!idColumn || lastRow < 2) return -1;
  const values = sheet.getRange(2, idColumn, lastRow - 1, 1).getDisplayValues();
  for (let index = 0; index < values.length; index++) {
    if (String(values[index][0]).trim() === String(workId).trim()) return index + 2;
  }
  return -1;
}

function writeWorkMirrorRow_(sheet, row, rowNumber) {
  const destinationRow = rowNumber || sheet.getLastRow() + 1;
  sheet.getRange(destinationRow, 1, 1, row.length).setNumberFormat("@").setValues([row]);
}

function createMasterData_(resourceName, data) {
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const { resource, sheet, headers } = getMasterDataSheet_(resourceName);
    const clean = validateMasterData_(resource, headers, data);
    if (resource.autoId && !clean[resource.primaryKey]) {
      clean[resource.primaryKey] = nextMasterDataIdValue_(resourceName, sheet, headers);
    }
    const id = resource.primaryKey ? clean[resource.primaryKey] : "";
    if (resource.primaryKey && !id) throw new Error(`${resource.primaryKey} is required.`);
    if (resource.primaryKey && findMasterDataRow_(sheet, headers, resource.primaryKey, id) !== -1) throw new Error(`${resource.primaryKey} already exists.`);
    if (resource.recordField && readMasterData_(resourceName).records.some(record =>
      String(record[resource.recordField]).toLowerCase() === String(clean[resource.recordField] || "").toLowerCase())) {
      throw new Error(resource.recordField + " already exists.");
    }
    validateMasterDataLookup_(resourceName, clean);
    const row = headers.map(header => Object.prototype.hasOwnProperty.call(clean, header) ? clean[header] : "");
    // Check/provision every selected destination before the primary Work row
    // is written, then use the same row in every destination.
    const workMirrorTargets = resourceName === "work"
      ? getWorkMirrorTargets_(clean, headers) : [];
    if (resourceName === "projects") {
      // Provision this before writing the project row so a configuration or
      // tab-name error cannot leave a project without its Work tab.
      const work = getMasterDataSheet_("work");
      createProjectWorkSheet_(id, clean.ProjectName, work.headers);
    }

    const rowNumber = sheet.getLastRow() + 1;
    sheet.getRange(rowNumber, 1, 1, row.length).setNumberFormat("@").setValues([row]);

    workMirrorTargets.forEach(target => writeWorkMirrorRow_(target.sheet, row));

    return json_({ success: true, id, message: "Record created successfully." });
  } finally { lock.releaseLock(); }
}

function updateMasterData_(resourceName, originalId, data) {
  const id = String(originalId || "").trim();
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const { resource, sheet, headers } = getMasterDataSheet_(resourceName);
    const rowNumber = findMasterDataRow_(sheet, headers, resource.primaryKey, id);
    if (rowNumber === -1) throw new Error("Record was not found.");
    const clean = validateMasterData_(resource, headers, data);
    const newId = resource.primaryKey ? clean[resource.primaryKey] : id;
    if (resource.primaryKey && !newId) throw new Error(`${resource.primaryKey} is required.`);
    const duplicateRow = resource.primaryKey ? findMasterDataRow_(sheet, headers, resource.primaryKey, newId) : -1;
    if (resource.primaryKey && duplicateRow !== -1 && duplicateRow !== rowNumber) throw new Error(`${resource.primaryKey} already exists.`);
    if (resource.recordField && readMasterData_(resourceName).records.some(record =>
      Number(record._rowId) !== rowNumber &&
      String(record[resource.recordField]).toLowerCase() === String(clean[resource.recordField] || "").toLowerCase())) {
      throw new Error(resource.recordField + " already exists.");
    }
    validateMasterDataLookup_(resourceName, clean);
    const current = sheet.getRange(rowNumber, 1, 1, headers.length).getDisplayValues()[0];
    const updated = headers.map((header, index) =>
      Object.prototype.hasOwnProperty.call(clean, header) ? clean[header] : current[index]
    );
    if (resourceName === "work") {
      const oldRecord = {};
      headers.forEach((header, index) => { oldRecord[header] = current[index]; });
      const oldTargets = getWorkMirrorTargets_(oldRecord, headers);
      const newTargets = getWorkMirrorTargets_(Object.assign({}, oldRecord, clean), headers);
      const newTargetByKey = {};
      const synchronized = {};
      newTargets.forEach(target => { newTargetByKey[target.key] = target; });

      oldTargets.forEach(target => {
        const mirrorRow = findWorkMirrorRowById_(target.sheet, headers, current[headers.indexOf("WorkId")]);
        if (mirrorRow === -1) return;
        if (newTargetByKey[target.key]) {
          writeWorkMirrorRow_(target.sheet, updated, mirrorRow);
          synchronized[target.key] = true;
        } else {
          target.sheet.deleteRow(mirrorRow);
        }
      });
      newTargets.forEach(target => {
        if (!synchronized[target.key]) writeWorkMirrorRow_(target.sheet, updated);
      });
    }
    sheet.getRange(rowNumber, 1, 1, updated.length).setNumberFormat("@").setValues([updated]);
    return json_({ success: true, id: newId, message: "Record updated successfully." });
  } finally { lock.releaseLock(); }
}

function deleteMasterData_(resourceName, idValue) {
  const id = String(idValue || "").trim();
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const { resource, sheet, headers } = getMasterDataSheet_(resourceName);
    const rowNumber = findMasterDataRow_(sheet, headers, resource.primaryKey, id);
    if (rowNumber === -1) throw new Error("Record was not found.");
    if (resourceName === "work") {
      const current = sheet.getRange(rowNumber, 1, 1, headers.length).getDisplayValues()[0];
      const record = {};
      headers.forEach((header, index) => { record[header] = current[index]; });
      getWorkMirrorTargets_(record, headers).forEach(target => {
        const mirrorRow = findWorkMirrorRowById_(target.sheet, headers, record.WorkId);
        if (mirrorRow !== -1) target.sheet.deleteRow(mirrorRow);
      });
    }
    if (resource.sharedSheet) sheet.getRange(rowNumber, 1, 1, headers.length).clearContent();
    else sheet.deleteRow(rowNumber);
    return json_({ success: true, message: "Record deleted successfully." });
  } finally { lock.releaseLock(); }
}

/* ---------------- Read-only analysis ---------------- */

function analysisFields_(resourceName, headers) {
  const derived = {
    work: [],
    staffManagement: ["Staff Type"],
    statement: []
  };
  if (!Object.prototype.hasOwnProperty.call(derived, resourceName)) {
    throw new Error("This resource does not support analysis.");
  }
  return headers.concat(derived[resourceName]);
}

function analysisDateValue_(value) {
  const text = analysisText_(value);
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return match[1] + ("0" + match[2]).slice(-2) + ("0" + match[3]).slice(-2);
  // Spreadsheet date cells are displayed as day/month/year in this app.
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return match[3] + ("0" + match[2]).slice(-2) + ("0" + match[1]).slice(-2);
  return "";
}

function analysisDelimitedValues_(value) {
  return analysisText_(value).split(",").map(item => item.trim()).filter(Boolean);
}

function analysisText_(value) {
  return String(value == null ? "" : value).trim();
}

function recordMatchesFilters_(record, filters) {
  return Object.keys(filters).every(field => {
    if (field === "DateFrom" || field === "DateTo") {
      const recordDate = analysisDateValue_(record.Date);
      const boundary = analysisDateValue_(filters[field]);
      return Boolean(recordDate && boundary && (field === "DateFrom" ? recordDate >= boundary : recordDate <= boundary));
    }
    if (field === "Vehicle" || field === "Staff" || field === "Client" || field === "Project") {
      const wanted = analysisDelimitedValues_(filters[field]);
      const recordValues = analysisDelimitedValues_(record[field]);
      return !wanted.length || wanted.some(value => recordValues.includes(value));
    }
    const wanted = analysisText_(filters[field]).toLowerCase();
    return !wanted || analysisText_(record[field]).toLowerCase().includes(wanted);
  });
}

function analyzeMasterData_(resourceName, filters) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw new Error("Invalid analysis filters.");
  }

  const result = readMasterData_(resourceName);
  const allowedFields = analysisFields_(resourceName, result.headers);
  Object.keys(filters).forEach(field => {
    const isDateRange = (field === "DateFrom" || field === "DateTo") && allowedFields.includes("Date");
    const isFullClientData = resourceName === "work" && field === "Full Client Data";
    if (!allowedFields.includes(field) && !isDateRange && !isFullClientData) throw new Error("Invalid analysis filter.");
    if (typeof filters[field] === "object" || analysisText_(filters[field]).length > 1000) {
      throw new Error("Invalid analysis filter value.");
    }
    if (isDateRange && !analysisDateValue_(filters[field])) throw new Error("Use a valid date.");
  });

  let source = result;
  const selectedClients = resourceName === "work" ? analysisDelimitedValues_(filters.Client) : [];
  const selectedProjects = resourceName === "work" ? analysisDelimitedValues_(filters.Project) : [];
  const fullClientId = resourceName === "work" ? analysisText_(filters["Full Client Data"]) : "";
  if (fullClientId || selectedClients.length || selectedProjects.length) {
    const selectedRecords = [];
    const addWorkSheetRecords = sheet => {
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return;
      sheet.getRange(2, 1, lastRow - 1, result.headers.length).getDisplayValues()
        .filter(row => row.some(value => String(value).trim()))
        .forEach((row, index) => {
          const record = { _rowId: String(index + 2) };
          result.headers.forEach((header, column) => { record[header] = String(row[column] || "").trim(); });
          selectedRecords.push(record);
        });
    };
    const projectsById = {};
    const projects = readMasterData_("projects").records;
    projects.forEach(project => { projectsById[String(project.Id)] = project; });
    const clientsById = {};
    readClients_().clients.forEach(client => { clientsById[String(client.Id)] = client; });
    if (fullClientId) {
      const client = clientsById[fullClientId];
      if (!client) throw new Error("Select a valid full client data value.");
      addWorkSheetRecords(createClientWorkSheet_(client.Id, client.Name, result.headers));
      projects.filter(project => String(project.ClientId) === fullClientId).forEach(project => {
        addWorkSheetRecords(createProjectWorkSheet_(project.Id, project.ProjectName, result.headers));
      });
    } else {
      selectedClients.forEach(id => {
        const client = clientsById[id];
        if (!client) throw new Error("Select valid client values.");
        addWorkSheetRecords(createClientWorkSheet_(client.Id, client.Name, result.headers));
      });
      selectedProjects.forEach(id => {
        const project = projectsById[id];
        if (!project) throw new Error("Select valid project values.");
        addWorkSheetRecords(createProjectWorkSheet_(project.Id, project.ProjectName, result.headers));
      });
    }
    const seenWorkIds = {};
    source = Object.assign({}, result, { records: selectedRecords.filter(record => {
      const id = analysisText_(record.WorkId);
      if (!id || seenWorkIds[id]) return false;
      seenWorkIds[id] = true;
      return true;
    }) });
  }

  const staff = resourceName === "staffManagement"
    ? readMasterData_("staff").records : [];

  const rowFilters = Object.assign({}, filters);
  // Client/project selections decide which mirror tabs are read. Applying
  // them again would turn a requested union of tabs into an intersection.
  if (resourceName === "work") {
    delete rowFilters["Full Client Data"];
    if (!fullClientId) {
      delete rowFilters.Client;
      delete rowFilters.Project;
    }
  }
  const records = source.records.map(record => {
    const enriched = Object.assign({}, record);
    if (resourceName === "staffManagement") {
      const staffMember = staff.find(item => String(item.Id) === String(record.Staff));
      enriched["Staff Type"] = staffMember ? staffMember.Type : "";
    }
    return enriched;
  }).filter(record => recordMatchesFilters_(record, rowFilters));

  return json_({ success: true, records, fields: allowedFields });
}
