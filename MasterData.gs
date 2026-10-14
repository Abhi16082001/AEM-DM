/**
 * Config-driven master-data API for Vehicle Types, Vehicles, Staff Types,
 * and Staff. Keep this file separate from Code.gs and BillManagement.gs.
 */
const MASTER_DATA_RESOURCES = {
  vehicleTypes: { sheetName: "Types", headers: ["Vehicle Type Name", "Staff Type Name"], fields: ["Vehicle Type Name"], primaryKey: "Vehicle Type Name", required: ["Vehicle Type Name"], sharedSheet: true },
  staffTypes: { sheetName: "Types", headers: ["Vehicle Type Name", "Staff Type Name"], fields: ["Staff Type Name"], primaryKey: "Staff Type Name", required: ["Staff Type Name"], sharedSheet: true },
  vehicles: { sheetName: "Vehicles", headers: ["Vehicle No", "Type"], fields: ["Vehicle No", "Type"], primaryKey: "Vehicle No", required: ["Vehicle No", "Type"] },
  staff: { sheetName: "Staff", headers: ["Id", "Name", "Type", "Remarks"], fields: ["Id", "Name", "Type", "Remarks"], primaryKey: "Id", required: ["Id", "Name", "Type"], autoId: true }
};

function handleMasterDataAction_(request) {
  switch (request.action) {
    case "listMasterData": return listMasterData_(request.resource);
    case "createMasterData": return createMasterData_(request.resource, request.data || {});
    case "updateMasterData": return updateMasterData_(request.resource, request.id, request.data || {});
    case "deleteMasterData": return deleteMasterData_(request.resource, request.id);
    case "nextMasterDataId": return nextMasterDataId_(request.resource);
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
    sheet.getRange(1, 1, 1, resource.headers.length).setValues([resource.headers]);
    headers = resource.headers.slice();
  } else {
    const missing = resource.headers.filter(header => !headers.includes(header));
    if (missing.length) {
      sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
      headers = headers.concat(missing);
    }
  }
  return { resource, sheet, headers };
}

function readMasterData_(resourceName) {
  const result = getMasterDataSheet_(resourceName);
  const { resource, sheet, headers } = result;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return Object.assign(result, { records: [] });
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getDisplayValues();
  const keyIndex = headers.indexOf(resource.primaryKey);
  const records = values.filter(row => String(row[keyIndex] || "").trim()).map(row => {
    const record = {};
    headers.forEach((header, index) => { record[header] = String(row[index] || "").trim(); });
    return record;
  });
  return Object.assign(result, { records });
}

function validateMasterData_(resource, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid record data.");
  const invalid = Object.keys(data).filter(key => !resource.fields.includes(key));
  if (invalid.length) throw new Error("Invalid field supplied.");
  const clean = {};
  resource.fields.forEach(header => {
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
  return json_({ success: true, records: result.records, fields: result.resource.headers });
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
    const clean = validateMasterData_(resource, data);
    if (resource.autoId && !clean[resource.primaryKey]) clean[resource.primaryKey] = getNextStaffId_(sheet, headers);
    const id = clean[resource.primaryKey];
    if (!id) throw new Error(`${resource.primaryKey} is required.`);
    if (findMasterDataRow_(sheet, headers, resource.primaryKey, id) !== -1) throw new Error(`${resource.primaryKey} already exists.`);
    validateMasterDataLookup_(resourceName, clean);
    const row = headers.map(header => clean[header] || "");
    const rowNumber = sheet.getLastRow() + 1;
    sheet.getRange(rowNumber, 1, 1, row.length).setNumberFormat("@").setValues([row]);
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
    const clean = validateMasterData_(resource, data);
    const newId = clean[resource.primaryKey];
    if (!newId) throw new Error(`${resource.primaryKey} is required.`);
    const duplicateRow = findMasterDataRow_(sheet, headers, resource.primaryKey, newId);
    if (duplicateRow !== -1 && duplicateRow !== rowNumber) throw new Error(`${resource.primaryKey} already exists.`);
    validateMasterDataLookup_(resourceName, clean);
    if (resource.sharedSheet) {
      sheet.getRange(rowNumber, headers.indexOf(resource.primaryKey) + 1).setValue(clean[resource.primaryKey]);
    } else {
      headers.forEach((header, index) => sheet.getRange(rowNumber, index + 1).setValue(clean[header] || ""));
    }
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
