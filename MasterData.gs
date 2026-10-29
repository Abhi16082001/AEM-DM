/**
 * Config-driven master-data API for Vehicle Types, Vehicles, Staff Types,
 * and Staff. Keep this file separate from Code.gs and BillManagement.gs.
 */
const MASTER_DATA_RESOURCES = {
  // initialHeaders are used only when this project creates an empty sheet.
  // Once a sheet has headers, those headers are the form's data contract. This
  // lets a new column be added by updating the sheet and js/config.js only.
  vehicleTypes: { sheetName: "Types", initialHeaders: ["Vehicle Type Name", "Staff Type Name"], primaryKey: "Vehicle Type Name", required: ["Vehicle Type Name"], sharedSheet: true },
  staffTypes: { sheetName: "Types", initialHeaders: ["Vehicle Type Name", "Staff Type Name"], primaryKey: "Staff Type Name", required: ["Staff Type Name"], sharedSheet: true },
  vehicles: { sheetName: "Vehicles", initialHeaders: ["Vehicle No", "Type"], primaryKey: "Vehicle No", required: ["Vehicle No", "Type"] },
  staff: { sheetName: "Staff", initialHeaders: ["Id", "Name", "Type", "Remarks"], primaryKey: "Id", required: ["Id", "Name", "Type"], autoId: true },
  work: { sheetName: "Work", initialHeaders: ["Date", "Vehicle", "Client", "Quantity", "Night", "Rate", "Total", "Staff", "Remarks"], required: ["Date", "Vehicle", "Client", "Quantity", "Rate", "Total", "Staff"] },
  staffManagement: { sheetName: "StaffManagement", initialHeaders: ["Date", "Staff", "Amount", "Remarks"], required: ["Date", "Staff", "Amount"] },
  bank: { sheetName: "Bank", initialHeaders: ["Id", "Account Holder Name", "Last 6 Digit of Bank Account", "Bank Name", "Branch Name", "Saving/Current", "IFSC Code"], primaryKey: "Id", required: ["Id", "Account Holder Name", "Last 6 Digit of Bank Account", "Bank Name", "Saving/Current", "IFSC Code"], autoId: true },
  statement: { sheetName: "Statement", initialHeaders: ["Date", "Bank", "Debit/Credit", "Amount", "To/From", "BillNo", "Remarks"], required: ["Date", "Bank", "Debit/Credit", "Amount", "To/From"] },
  projects: { sheetName: "Projects", initialHeaders: ["Id", "ProjectName", "ClientId", "ProjectStartDate", "ProjectEndDate", "ProjectAmount", "ProjectDescription"], primaryKey: "Id", required: ["ProjectName", "ClientId", "ProjectStartDate", "ProjectEndDate", "ProjectAmount"], autoId: true }
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
  const records = values.map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(item => resource.primaryKey ? String(item.row[keyIndex] || "").trim() : item.row.some(value => String(value).trim()))
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
    if (clean[header].length > 1000) throw new Error("A field value is too long.");
  });
  resource.required.forEach(header => {
    if (!clean[header] && !(resource.autoId && header === resource.primaryKey)) {
      throw new Error(`${header} is required.`);
    }
  });
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
    const types = readMasterData_("vehicleTypes").records.map(record => record["Vehicle Type Name"]);
    if (!types.includes(clean.Type)) throw new Error("Select a valid vehicle type.");
  }
  if (resourceName === "staff" && clean.Type) {
    const types = readMasterData_("staffTypes").records.map(record => record["Staff Type Name"]);
    if (!types.includes(clean.Type)) throw new Error("Select a valid staff type.");
  }
  if (resourceName === "work") {
    if (!masterDataKeyExists_("vehicles", clean.Vehicle)) throw new Error("Select a valid vehicle.");
    if (!readClients_().clients.some(client => String(client.Id) === clean.Client)) throw new Error("Select a valid client.");
    if (!masterDataKeyExists_("staff", clean.Staff)) throw new Error("Select a valid staff member.");
  }
  if (resourceName === "staffManagement" && !masterDataKeyExists_("staff", clean.Staff)) {
    throw new Error("Select a valid staff member.");
  }
  if (resourceName === "statement") {
    if (!masterDataKeyExists_("bank", clean.Bank)) throw new Error("Select a valid bank account.");
    if (!["Debit", "Credit"].includes(clean["Debit/Credit"])) throw new Error("Select Debit or Credit.");
  }
  if (resourceName === "projects" && clean.ClientId &&
      !readClients_().clients.some(client => String(client.Id) === clean.ClientId)) {
    throw new Error("Select a valid client.");
  }
  if (resourceName === "bank" && !["Saving", "Current"].includes(clean["Saving/Current"])) {
    throw new Error("Select Saving or Current.");
  }
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

function listMasterData_(resourceName) {
  const result = readMasterData_(resourceName);
  return json_({ success: true, records: result.records, fields: result.headers });
}

function nextMasterDataId_(resourceName) {
  const { resource, sheet, headers } = getMasterDataSheet_(resourceName);
  if (!resource.autoId) throw new Error("This resource does not use generated IDs.");
  return json_({ success: true, nextId: getNextStaffId_(sheet, headers) });
}

function createMasterData_(resourceName, data) {
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const { resource, sheet, headers } = getMasterDataSheet_(resourceName);
    const clean = validateMasterData_(resource, headers, data);
    if (resource.autoId && !clean[resource.primaryKey]) clean[resource.primaryKey] = getNextStaffId_(sheet, headers);
    const id = resource.primaryKey ? clean[resource.primaryKey] : "";
    if (resource.primaryKey && !id) throw new Error(`${resource.primaryKey} is required.`);
    if (resource.primaryKey && findMasterDataRow_(sheet, headers, resource.primaryKey, id) !== -1) throw new Error(`${resource.primaryKey} already exists.`);
    validateMasterDataLookup_(resourceName, clean);
    const row = headers.map(header => Object.prototype.hasOwnProperty.call(clean, header) ? clean[header] : "");
    let clientSheet = null;
    if (resourceName === "work") {
      const client = readClients_().clients.find(item => String(item.Id) === String(clean.Client));
      // The client was validated above, but keep this guard so the sheet name
      // is never constructed from incomplete data.
      if (!client) throw new Error("Select a valid client.");
      // Check/provision the destination before the primary Work row is written.
      clientSheet = createClientWorkSheet_(client.Id, client.Name, headers);
    }

    const rowNumber = sheet.getLastRow() + 1;
    sheet.getRange(rowNumber, 1, 1, row.length).setNumberFormat("@").setValues([row]);

    if (clientSheet) {
      const clientRow = clientSheet.getLastRow() + 1;
      clientSheet.getRange(clientRow, 1, 1, row.length)
        .setNumberFormat("@")
        .setValues([row]);
    }

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
    validateMasterDataLookup_(resourceName, clean);
    const current = sheet.getRange(rowNumber, 1, 1, headers.length).getDisplayValues()[0];
    const updated = headers.map((header, index) =>
      Object.prototype.hasOwnProperty.call(clean, header) ? clean[header] : current[index]
    );
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
    if (resource.sharedSheet) sheet.getRange(rowNumber, headers.indexOf(resource.primaryKey) + 1).clearContent();
    else sheet.deleteRow(rowNumber);
    return json_({ success: true, message: "Record deleted successfully." });
  } finally { lock.releaseLock(); }
}

/* ---------------- Read-only analysis ---------------- */

function analysisFields_(resourceName, headers) {
  const derived = {
    work: ["Vehicle Type", "Staff Type"],
    staffManagement: ["Staff Type"],
    statement: []
  };
  if (!Object.prototype.hasOwnProperty.call(derived, resourceName)) {
    throw new Error("This resource does not support analysis.");
  }
  return headers.concat(derived[resourceName]);
}

function analysisText_(value) {
  return String(value == null ? "" : value).trim();
}

function recordMatchesFilters_(record, filters) {
  return Object.keys(filters).every(field => {
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
    if (!allowedFields.includes(field)) throw new Error("Invalid analysis filter.");
    if (typeof filters[field] === "object" || analysisText_(filters[field]).length > 1000) {
      throw new Error("Invalid analysis filter value.");
    }
  });

  let source = result;
  const selectedClient = resourceName === "work" && analysisText_(filters.Client);
  if (selectedClient) {
    const client = readClients_().clients.find(item => String(item.Id) === selectedClient);
    if (!client) throw new Error("Select a valid client.");

    const clientSheet = createClientWorkSheet_(client.Id, client.Name, result.headers);
    const lastRow = clientSheet.getLastRow();
    const values = lastRow < 2 ? [] : clientSheet
      .getRange(2, 1, lastRow - 1, result.headers.length)
      .getDisplayValues();
    const records = values
      .filter(row => row.some(value => String(value).trim()))
      .map((row, index) => {
        const record = { _rowId: String(index + 2) };
        result.headers.forEach((header, column) => {
          record[header] = String(row[column] || "").trim();
        });
        return record;
      });
    source = Object.assign({}, result, { records });
  }

  const vehicles = resourceName === "work" ? readMasterData_("vehicles").records : [];
  const staff = (resourceName === "work" || resourceName === "staffManagement")
    ? readMasterData_("staff").records : [];

  const records = source.records.map(record => {
    const enriched = Object.assign({}, record);
    if (resourceName === "work") {
      const vehicle = vehicles.find(item => String(item["Vehicle No"]) === String(record.Vehicle));
      const staffMember = staff.find(item => String(item.Id) === String(record.Staff));
      enriched["Vehicle Type"] = vehicle ? vehicle.Type : "";
      enriched["Staff Type"] = staffMember ? staffMember.Type : "";
    }
    if (resourceName === "staffManagement") {
      const staffMember = staff.find(item => String(item.Id) === String(record.Staff));
      enriched["Staff Type"] = staffMember ? staffMember.Type : "";
    }
    return enriched;
  }).filter(record => recordMatchesFilters_(record, filters));

  return json_({ success: true, records, fields: allowedFields });
}
