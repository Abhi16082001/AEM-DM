
const TOKEN_TTL_SECONDS = 60 * 60;
const USERS_SHEET_NAME = "Users";
const TOKEN_PREFIX = "bill_session_";
const BILLER_SHEET_NAME = "Billers";

const BILLER_HEADERS = [
  "Id",
  "Name",
  "Phone",
  "Alt.Phone",
  "GST",
  "Company Name",
  "Address",
  "PAN",
  "Description"
];

const BILLER_RICH_FIELDS = new Set([
  "Address",
  "Description"
]);

const BILLER_TEXT_LIMITS = {
  "Name": 150,
  "Phone": 30,
  "Alt.Phone": 30,
  "GST": 30,
  "Company Name": 200,
  "Address": 5000,
  "PAN": 20,
  "Description": 10000
};
function doGet() {
  return json_({
    success: true,
    service: "Personal Bill Creator API",
    message: "API is running."
  });
}

function doPost(e) {
  try {
    const text = e && e.postData && e.postData.contents;
    if (!text) {
      return json_({ success: false, message: "Missing request body." });
    }

    const request = JSON.parse(text);

    if (request.action === "login") return login_(request);

    const publicActions = [];
    if (publicActions.includes(request.action)) {
      return json_({ success: false, message: "Unsupported action." });
    }

    const session = validateToken_(request.token);

    if (!session.valid) {
      return json_({
        success: false,
        code: session.expired ? "SESSION_EXPIRED" : "SESSION_INVALID",
        message: "Your session is invalid or has expired. Please sign in again."
      });
    }

    switch (request.action) {
      case "logout":
        logout_(request.token);
        return json_({ success: true, message: "Signed out." });

      case "listClients":
        return listClients_();

      case "createClient":
        return createClient_(request.data);

      case "updateClient":
        return updateClient_(request.id, request.data);

      case "deleteClient":
        return deleteClient_(request.id);

      case "listBillers":
        return listBillers_();

      case "createBiller":
        return createBiller_(request.data || {});

      case "updateBiller":
        return updateBiller_(request.id, request.data || {});

      case "deleteBiller":
        return deleteBiller_(request.id);

      case "listBills":
        return listBills_();

      case "getBill":
        return getBill_(request.billNo);

      case "saveBill":
        return saveBill_(request.data, request.originalBillNo);

      case "deleteBill":
        return deleteBill_(request.billNo);

      default:
        const masterDataResponse = handleMasterDataAction_(request);
        if (masterDataResponse) return masterDataResponse;
        return json_({ success: false, message: "Unsupported action." });
    }
  } catch (error) {
    console.error(error);
    return json_({
      success: false,
      message: "The request could not be processed."
    });
  }
}

/* ---------------- Authentication ---------------- */

function login_(request) {
  const username = String(request.username || "").trim();
  const password = String(request.password || "");

  if (!username || !password ||
      username.length > 80 || password.length > 200) {
    return json_({
      success: false,
      message: "Invalid username or password."
    });
  }

  const sheet = getUsersSheet_();
  const rows = sheet.getDataRange().getValues();

  if (rows.length < 2) {
    return invalidLogin_();
  }

  const headers = rows[0].map(v => String(v).trim());
  const usernameCol = headers.indexOf("Username");
  const saltCol = headers.indexOf("Salt");
  const hashCol = headers.indexOf("PasswordHash");
  const activeCol = headers.indexOf("Active");

  if ([usernameCol, saltCol, hashCol, activeCol].some(i => i < 0)) {
    throw new Error("Users sheet is missing required headers.");
  }

  const normalized = username.toLowerCase();
  let matched = null;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][usernameCol]).trim().toLowerCase() === normalized) {
      matched = rows[i];
      break;
    }
  }

  if (!matched || !isActive_(matched[activeCol])) {
    return invalidLogin_();
  }

  const expected = String(matched[hashCol]);
  const supplied = hashPassword_(String(matched[saltCol]), password);

  if (!constantTimeEqual_(expected, supplied)) {
    return invalidLogin_();
  }

  const token = Utilities.getUuid().replace(/-/g, "") +
                Utilities.getUuid().replace(/-/g, "");

  const expiresAt = Date.now() + TOKEN_TTL_SECONDS * 1000;
  const tokenHash = sha256Hex_(token);

  CacheService.getScriptCache().put(
    TOKEN_PREFIX + tokenHash,
    JSON.stringify({
      username: normalized,
      expiresAt
    }),
    TOKEN_TTL_SECONDS
  );

  return json_({
    success: true,
    token,
    expiresAt,
    expiresIn: TOKEN_TTL_SECONDS
  });
}

function invalidLogin_() {
  Utilities.sleep(250);
  return json_({
    success: false,
    message: "Invalid username or password."
  });
}

function validateToken_(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
    return { valid: false, expired: false };
  }

  const key = TOKEN_PREFIX + sha256Hex_(token);
  const cache = CacheService.getScriptCache();
  const value = cache.get(key);

  if (!value) {
    return { valid: false, expired: true };
  }

  try {
    const session = JSON.parse(value);

    if (!session.username || !session.expiresAt ||
        Date.now() >= Number(session.expiresAt)) {
      cache.remove(key);
      return { valid: false, expired: true };
    }

    return { valid: true, username: session.username };
  } catch (_) {
    cache.remove(key);
    return { valid: false, expired: false };
  }
}

function logout_(token) {
  CacheService.getScriptCache().remove(
    TOKEN_PREFIX + sha256Hex_(token)
  );
}

function getUsersSheet_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(USERS_SHEET_NAME);

  if (!sheet) throw new Error("Users sheet was not found.");
  return sheet;
}

function isActive_(value) {
  return value === true ||
    String(value).trim().toLowerCase() === "true" ||
    String(value).trim() === "1";
}

function hashPassword_(salt, password) {
  return sha256Hex_(salt + ":" + password);
}

function sha256Hex_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8
  );

  return bytes.map(b =>
    (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")
  ).join("");
}

function constantTimeEqual_(a, b) {
  a = String(a);
  b = String(b);

  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/* ---------------- Spreadsheet helpers ---------------- */

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties()
    .getProperty("SPREADSHEET_ID");

  if (!id) throw new Error("Set SPREADSHEET_ID in Script Properties.");

  return SpreadsheetApp.openById(id);
}

function getClientsSheet_() {
  const sheet = getSpreadsheet_().getSheetByName("Clients");

  if (!sheet) throw new Error("Clients sheet was not found.");

  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) throw new Error("Clients sheet needs a header row.");

  const headers = sheet.getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(v => String(v).trim());

  if (!headers.includes("Id")) {
    throw new Error("Clients sheet must have an Id header.");
  }

  if (headers.some(h => !h)) {
    throw new Error("Clients sheet has an empty header.");
  }

  if (new Set(headers).size !== headers.length) {
    throw new Error("Clients sheet has duplicate headers.");
  }

  return { sheet, headers };
}

function readClients_() {
  const { sheet, headers } = getClientsSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return { sheet, headers, clients: [] };

  const values = sheet.getRange(
    2, 1, lastRow - 1, headers.length
  ).getValues();

  const clients = values
    .filter(row => row.some(v => v !== ""))
    .map(row => {
      const client = {};
      headers.forEach((header, i) => {
        client[header] = row[i] == null ? "" : String(row[i]);
      });
      return client;
    });

  return { sheet, headers, clients };
}

function validateClientData_(data, headers, isUpdate) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid client data.");
  }

  // Never accept a user-supplied ID or unconfigured columns.
  const forbidden = Object.keys(data).filter(key =>
    key === "Id" || !headers.includes(key)
  );

  if (forbidden.length) {
    throw new Error("Invalid or system-managed field supplied.");
  }

  const clean = {};

  Object.keys(data).forEach(key => {
    const value = data[key];

    if (value !== null && typeof value === "object") {
      throw new Error("Field values must be plain text.");
    }

    clean[key] = String(value ?? "").trim();

    if (clean[key].length > 5000) {
      throw new Error("A field value is too long.");
    }
  });

  if (!isUpdate && !String(clean.Name || "").trim()) {
    throw new Error("Client Name is required.");
  }

  return clean;
}

function findClientRow_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1)
    .getDisplayValues();

  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }

  return -1;
}

/* ---------------- Client CRUD ---------------- */

function listClients_() {
  const result = readClients_();

  return json_({
    success: true,
    fields: result.headers,
    clients: result.clients
  });
}

function createClient_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const { sheet, headers } = getClientsSheet_();
    const clean = validateClientData_(data, headers, false);

    // Use the maximum existing numeric suffix, not merely the last row.
    let maxId = 0;
    const lastRow = sheet.getLastRow();

    if (lastRow >= 2) {
      const idIndex = headers.indexOf("Id");
      const ids = sheet.getRange(
        2, idIndex + 1, lastRow - 1, 1
      ).getDisplayValues();

      ids.forEach(([id]) => {
        const match = String(id).match(/^C(\d+)$/);
        if (match) maxId = Math.max(maxId, Number(match[1]));
      });
    }

    const id = "C" + (maxId + 1);
    const row = headers.map(header =>
      header === "Id" ? id : (clean[header] ?? "")
    );

    const newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, row.length).setNumberFormat("@");
    sheet.getRange(newRow, 1, 1, row.length).setValues([row]);

    return json_({
      success: true,
      id,
      message: `Client ${id} created successfully.`
    });
  } finally {
    lock.releaseLock();
  }
}

function updateClient_(idValue, data) {
  const id = String(idValue || "").trim();
  if (!/^C\d+$/.test(id)) throw new Error("Invalid client ID.");

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const { sheet, headers } = getClientsSheet_();
    const rowNumber = findClientRow_(sheet, id);

    if (rowNumber < 0) {
      throw new Error("Client not found.");
    }

    const clean = validateClientData_(data, headers, true);

    const current = sheet.getRange(
      rowNumber, 1, 1, headers.length
    ).getValues()[0];

    const updated = current.map((value, index) => {
      const header = headers[index];

      if (header === "Id") return value;

      return Object.prototype.hasOwnProperty.call(clean, header)
        ? clean[header]
        : value;
    });

    sheet.getRange(rowNumber, 1, 1, updated.length)
      .setNumberFormat("@");
    sheet.getRange(rowNumber, 1, 1, updated.length)
      .setValues([updated]);

    return json_({
      success: true,
      message: `Client ${id} updated successfully.`
    });
  } finally {
    lock.releaseLock();
  }
}

function deleteClient_(idValue) {
  const id = String(idValue || "").trim();
  if (!/^C\d+$/.test(id)) throw new Error("Invalid client ID.");

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const { sheet } = getClientsSheet_();
    const rowNumber = findClientRow_(sheet, id);

    if (rowNumber < 0) {
      throw new Error("Client not found.");
    }

    sheet.deleteRow(rowNumber);

    return json_({
      success: true,
      message: `Client ${id} deleted successfully.`
    });
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- Response helper ---------------- */

function json_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}




/**
 * Biller Management API
 *
 * Sheet headers:
 * Id, Name, Phone, Alt.Phone, GST, Company Name,
 * Address, PAN, Description
 *
 * Address and Description store sanitized HTML strings.
 * Existing doPost(e) must validate the session before routing
 * requests to these functions.
 */



function getBillersSheet_() {
  const spreadsheetId = PropertiesService
    .getScriptProperties()
    .getProperty("SPREADSHEET_ID");

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID is missing in Script Properties.");
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(BILLER_SHEET_NAME);

  if (!sheet) {
    throw new Error('The "' + BILLER_SHEET_NAME + '" sheet does not exist.');
  }

  const actualHeaders = sheet
    .getRange(1, 1, 1, BILLER_HEADERS.length)
    .getDisplayValues()[0];

  const matches = BILLER_HEADERS.every(
    (header, index) => actualHeaders[index] === header
  );

  if (!matches) {
    throw new Error(
      'Incorrect headers in "Billers". Expected: ' +
      BILLER_HEADERS.join(", ")
    );
  }

  return sheet;
}

/**
 * Sanitize HTML from the rich-text editors.
 * This intentionally allows only formatting tags and safe CSS
 * properties. Links, scripts, event handlers and embedded content
 * are not retained.
 */
function sanitizeBillerHTML_(html) {
  let value = String(html == null ? "" : html);

  // Remove complete dangerous elements and their contents first.
  value = value.replace(
    /<(script|style|iframe|object|embed|svg|math|form|input|button|textarea|select)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    ""
  );
  value = value.replace(
    /<(script|style|iframe|object|embed|svg|math|form|input|button|textarea|select)\b[^>]*\/?>/gi,
    ""
  );

  // Remove event attributes and non-style attributes.
  value = value.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  value = value.replace(/\s+(href|src|srcdoc|action|formaction|id|class|contenteditable|tabindex)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Sanitize style declarations and allow only a small CSS whitelist.
  value = value.replace(/\s+style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    function (_match, doubleQuoted, singleQuoted) {
      const styleText = doubleQuoted || singleQuoted || "";
      const allowed = [];

      styleText.split(";").forEach(function (declaration) {
        const colon = declaration.indexOf(":");
        if (colon < 0) return;

        const property = declaration.slice(0, colon).trim().toLowerCase();
        const cssValue = declaration.slice(colon + 1).trim();

        if (/url\s*\(|expression\s*\(|javascript:|[<>]/i.test(cssValue)) {
          return;
        }

        const allowedProperties = [
          "font-size",
          "font-weight",
          "font-style",
          "text-decoration",
          "color",
          "font-family",
          "text-align"
        ];

        if (allowedProperties.indexOf(property) === -1) return;

        if (property === "font-size" &&
            !/^\d+(\.\d+)?(px|pt|em|rem|%)$/i.test(cssValue)) return;

        if (property === "font-weight" &&
            !/^(normal|bold|[1-9]00)$/i.test(cssValue)) return;

        if (property === "font-style" &&
            !/^(normal|italic|oblique)$/i.test(cssValue)) return;

        if (property === "text-decoration" &&
            !/^(none|underline|line-through|overline)$/i.test(cssValue)) return;

        if (property === "text-align" &&
            !/^(left|right|center|justify)$/i.test(cssValue)) return;

        if (property === "color" &&
            !/^(#[0-9a-f]{3,8}|[a-z]+|rgb[a]?\([\d\s,.%]+\))$/i.test(cssValue)) return;

        if (property === "font-family" &&
            !/^[a-z0-9 ,"'_-]+$/i.test(cssValue)) return;

        allowed.push(property + ":" + cssValue);
      });

      return allowed.length
        ? ' style="' + allowed.join("; ") + '"'
        : "";
    }
  );

  // Keep only the HTML tags used by the editor.
  const allowedTags = [
    "div", "p", "br", "span", "b", "strong",
    "i", "em", "u", "ul", "ol", "li", "font"
  ];

  value = value.replace(/<\/?([a-z0-9]+)\b[^>]*>/gi,
    function (tag, tagName) {
      const lower = tagName.toLowerCase();

      if (allowedTags.indexOf(lower) === -1) {
        return "";
      }

      // Only simple opening/closing tags remain. Preserve safe style
      // attributes already processed above.
      if (/^<\//.test(tag)) {
        return "</" + lower + ">";
      }

      const styleMatch = tag.match(/\sstyle="([^"]*)"/i);
      const style = styleMatch ? ' style="' + styleMatch[1] + '"' : "";

      return "<" + lower + style + ">";
    }
  );

  return value;
}

function normalizeBillerData_(data) {
  const result = {};

  BILLER_HEADERS.forEach(function (header) {
    if (header === "Id") return;

    let value = data[header] == null ? "" : String(data[header]);

    if (BILLER_RICH_FIELDS.has(header)) {
      value = sanitizeBillerHTML_(value);
    } else {
      value = value.trim();
    }

    const maxLength = BILLER_TEXT_LIMITS[header];

    if (maxLength && value.length > maxLength) {
      throw new Error(header + " exceeds the maximum length of " +
        maxLength + " characters.");
    }

    result[header] = value;
  });

  if (!result.Name) {
    throw new Error("Biller Name is required.");
  }

  return result;
}

function getBillerRows_() {
  const sheet = getBillersSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  return sheet
    .getRange(2, 1, lastRow - 1, BILLER_HEADERS.length)
    .getValues()
    .map(function (row, index) {
      const record = { _row: index + 2 };

      BILLER_HEADERS.forEach(function (header, column) {
        record[header] = row[column] == null
          ? ""
          : String(row[column]);
      });

      return record;
    });
}

function listBillers_() {
  const billers = getBillerRows_().map(function (record) {
    const result = {};

    BILLER_HEADERS.forEach(function (header) {
      result[header] = record[header];
    });

    return result;
  });

  // return {
  //   success: true,
  //   billers: billers
  // };
   return json_({
    success: true,
    billers: billers
  });
}

function nextBillerId_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return "B1";

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  let maxId = 0;

  ids.forEach(function (row) {
    const match = String(row[0]).match(/^B(\d+)$/i);
    if (match) maxId = Math.max(maxId, Number(match[1]));
  });

  return "B" + (maxId + 1);
}

function createBiller_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const sheet = getBillersSheet_();
    const normalized = normalizeBillerData_(data);
    const id = nextBillerId_(sheet);

    const row = BILLER_HEADERS.map(function (header) {
      return header === "Id" ? id : normalized[header];
    });

    sheet.appendRow(row);

    return json_({
      success: true,
      message: "Biller created successfully.",
      id: id
    });
  } finally {
    lock.releaseLock();
  }
}

function updateBiller_(id, data) {
  const requestedId = String(id || "").trim();
  if (!requestedId) throw new Error("Biller ID is required.");

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const sheet = getBillersSheet_();
    const records = getBillerRows_();
    const existing = records.find(function (record) {
      return record.Id === requestedId;
    });

    if (!existing) throw new Error("Biller not found.");

    const normalized = normalizeBillerData_(data);
    const row = BILLER_HEADERS.map(function (header) {
      return header === "Id" ? requestedId : normalized[header];
    });

    sheet.getRange(existing._row, 1, 1, BILLER_HEADERS.length)
      .setValues([row]);

    return json_({
      success: true,
      message: "Biller updated successfully.",
      id: requestedId
    });
  } finally {
    lock.releaseLock();
  }
}

function deleteBiller_(id) {
  const requestedId = String(id || "").trim();
  if (!requestedId) throw new Error("Biller ID is required.");

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const sheet = getBillersSheet_();
    const records = getBillerRows_();
    const existing = records.find(function (record) {
      return record.Id === requestedId;
    });

    if (!existing) throw new Error("Biller not found.");

    sheet.deleteRow(existing._row);

    return json_({
      success: true,
      message: "Biller deleted successfully."
    });
  } finally {
    lock.releaseLock();
  }
}
