/**
 * Bill Management API additions.
 * Keep this in a separate .gs file in the EXISTING Apps Script project.
 * Add the four action cases shown in README-BillManagement.txt to the
 * existing doPost(e) switch. Do not add another doPost(e).
 */
const BILL_HEADERS_ = [
  "ClientId","BillerId","BillNo","OrderNo","Date","TotalAmount",
  "AmountInWords","Tax","TaxPercentage","InState","OutState",
  "CGST","SGST","IGST","GrandTotal","CGSTAmount","SGSTAmount","IGSTAmount","SiteAddress"
];
const BILL_PARTICULAR_HEADERS_ = ["BillNo","ParticularTitle","SNo","Amount","HSN Code"];
// HSN belongs to a bill particular, not an individual detail row. Detail SNo
// is numbered within a particular; ParticularSNo identifies its parent.
const BILL_DETAIL_HEADERS_ = ["BillNo","ParticularSNo","SNo","Description","Quantity","Rate"];

function billSheet_(name, expectedHeaders) {
  const ss = getSpreadsheet_(); // Reuses the existing helper in Code.gs.
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  if (name === "ParticularDetails" && sheet.getLastRow() > 0) {
    migrateParticularDetailsSheet_(sheet, expectedHeaders);
  }

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(1, 1, 1, expectedHeaders.length)
      .setValues([expectedHeaders]);

    sheet.setFrozenRows(1);

  } else if (
    name === "Bills" &&
    sheet.getLastColumn() === 15 &&
    expectedHeaders.length >= 18
  ) {
    // Migrate the legacy Bills sheet by appending new columns.
    const legacy = sheet
      .getRange(1, 1, 1, 15)
      .getDisplayValues()[0]
      .map(v => String(v).trim());

    const expectedLegacy = expectedHeaders.slice(0, 15);

    if (expectedLegacy.every((h, i) => legacy[i] === h)) {
      sheet
        .getRange(1, 16, 1, expectedHeaders.length - 15)
        .setValues([expectedHeaders.slice(15)]);
    }

  } else if (
    sheet.getLastColumn() === expectedHeaders.length - 1
  ) {
    // Append the final expected column when all existing headers match.
    // Supports Bills and BillParticulars migrations.
    const existing = sheet
      .getRange(1, 1, 1, expectedHeaders.length - 1)
      .getDisplayValues()[0]
      .map(v => String(v).trim());

    const expectedExisting = expectedHeaders.slice(0, -1);

    if (expectedExisting.every((h, i) => existing[i] === h)) {
      sheet
        .getRange(1, expectedHeaders.length)
        .setValue(expectedHeaders[expectedHeaders.length - 1]);
    }
  }

  const columnCount = Math.max(
    sheet.getLastColumn(),
    expectedHeaders.length
  );

  const headers = sheet
    .getRange(1, 1, 1, columnCount)
    .getDisplayValues()[0]
    .map(v => String(v).trim())
    .slice(0, expectedHeaders.length);

  if (expectedHeaders.some((h, i) => headers[i] !== h)) {
    throw new Error(
      'Incorrect headers in "' + name +
      '". Expected: ' + expectedHeaders.join(", ")
    );
  }

  return sheet;
}

/**
 * Converts the two legacy ParticularDetails layouts to the current layout:
 *   BillNo, ParticularSNo, SNo, Description, Quantity, Rate
 *
 * Older versions stored the parent particular serial number in SNo, and
 * optionally had an obsolete HSN Code column. The conversion keeps the
 * existing detail rows, makes that value ParticularSNo, and assigns a
 * one-based detail SNo within each bill/particular pair.
 */
function migrateParticularDetailsSheet_(sheet, expectedHeaders) {
  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) return;

  const headers = sheet.getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(value => String(value).trim());

  if (expectedHeaders.every((header, index) => headers[index] === header) &&
      headers.length === expectedHeaders.length) {
    return;
  }

  const legacyHeaders = [
    ["BillNo", "SNo", "Description", "Quantity", "Rate"],
    ["BillNo", "SNo", "Description", "Quantity", "HSN Code", "Rate"]
  ];
  const legacy = legacyHeaders.find(candidate =>
    candidate.length === headers.length &&
    candidate.every((header, index) => headers[index] === header)
  );

  if (!legacy) return;

  const rows = sheet.getLastRow() < 2
    ? []
    : sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  const indexOf = header => headers.indexOf(header);
  const detailCounts = {};
  const migratedRows = rows
    .filter(row => row.some(value => value !== "" && value !== null))
    .map(row => {
      const billNo = row[indexOf("BillNo")];
      const particularSNo = row[indexOf("SNo")];
      const key = String(billNo) + "\u0000" + String(particularSNo);
      detailCounts[key] = (detailCounts[key] || 0) + 1;

      return [
        billNo,
        particularSNo,
        detailCounts[key],
        row[indexOf("Description")],
        row[indexOf("Quantity")],
        row[indexOf("Rate")]
      ];
    });

  sheet.clearContents();
  sheet.getRange(1, 1, 1, expectedHeaders.length)
    .setValues([expectedHeaders]);
  sheet.setFrozenRows(1);

  if (migratedRows.length) {
    sheet.getRange(2, 1, migratedRows.length, expectedHeaders.length)
      .setNumberFormat("@");
    sheet.getRange(2, 1, migratedRows.length, expectedHeaders.length)
      .setValues(migratedRows);
  }
}


function billRows_(sheet, headers) {
  if (sheet.getLastRow()<2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues()
    .filter(row=>row.some(v=>v!=="" && v!==null))
    .map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i] instanceof Date
      ? Utilities.formatDate(row[i],Session.getScriptTimeZone(),"yyyy-MM-dd")
      : row[i]])));
}
function billText_(v, max, field) {
  const s=String(v==null?"":v).trim();
  if(s.length>max) throw new Error(field+" exceeds "+max+" characters.");
  return s;
}
function billNum_(v, field, nullable) {
  if(nullable && (v===null || v==="")) return "";
  const n=Number(String(v==null?"":v).replace(/,/g,""));
  if(!Number.isFinite(n)||n<0) throw new Error(field+" must be a non-negative number.");
  return n;
}
function billBool_(v) { return v===true || String(v).toLowerCase()==="true"; }
function listBills_() {
  const bills=billRows_(billSheet_("Bills",BILL_HEADERS_),BILL_HEADERS_);
  return json_({success:true,bills});
}
function getBill_(billNoValue) {
  const billNo=String(billNoValue==null?"":billNoValue).trim();
  if(!billNo) throw new Error("Bill number is required.");
  const bills=billRows_(billSheet_("Bills",BILL_HEADERS_),BILL_HEADERS_);
  const bill=bills.find(b=>String(b.BillNo)===billNo);
  if(!bill) throw new Error("Bill not found.");
  const particulars=billRows_(billSheet_("BillParticulars",BILL_PARTICULAR_HEADERS_),BILL_PARTICULAR_HEADERS_)
    .filter(p=>String(p.BillNo)===billNo)
    .sort((a,b)=>Number(a.SNo)-Number(b.SNo));
  const details=billRows_(billSheet_("ParticularDetails",BILL_DETAIL_HEADERS_),BILL_DETAIL_HEADERS_)
    .filter(d=>String(d.BillNo)===billNo);
  particulars.forEach(p=>{
    p.details=details
      .filter(d=>Number(d.ParticularSNo)===Number(p.SNo))
      .sort((a,b)=>Number(a.SNo)-Number(b.SNo));
  });
  return json_({success:true,bill,particulars});
}
function saveBill_(payload, originalBillNoValue) {
  if(!payload || typeof payload!=="object" || !payload.bill || !Array.isArray(payload.particulars))
    throw new Error("Invalid bill payload.");
  const bill=payload.bill;
  const billNo=billText_(bill.BillNo,80,"Bill number");
  const originalBillNo=String(originalBillNoValue||"").trim();
  if(!billNo) throw new Error("Bill number is required.");
  if(!billText_(bill.ClientId,100,"Client ID") || !billText_(bill.BillerId,100,"Biller ID"))
    throw new Error("Choose a client and a biller.");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(bill.Date||""))) throw new Error("A valid bill date is required.");
  if(payload.particulars.length<1 || payload.particulars.length>300) throw new Error("A bill must have 1–300 particulars.");
  const lock=LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const billSheet=billSheet_("Bills",BILL_HEADERS_);
    const partSheet=billSheet_("BillParticulars",BILL_PARTICULAR_HEADERS_);
    const detailSheet=billSheet_("ParticularDetails",BILL_DETAIL_HEADERS_);
    const existing=billRows_(billSheet,BILL_HEADERS_);
    const found=existing.find(b=>String(b.BillNo)===billNo);
    const original=originalBillNo && existing.find(b=>String(b.BillNo)===originalBillNo);
    if(found && billNo!==originalBillNo) throw new Error("That bill number already exists.");
    if(originalBillNo && !original) throw new Error("The bill being edited was not found. Reload the list and try again.");
    const tax=billBool_(bill.Tax);
    const inState=tax && billBool_(bill.InState);
    const outState=tax && billBool_(bill.OutState);
    if(tax && inState===outState) throw new Error("Choose exactly one supply state.");
    const clean={
      ClientId:billText_(bill.ClientId,100,"Client ID"), BillerId:billText_(bill.BillerId,100,"Biller ID"),
      BillNo:billNo, OrderNo:billText_(bill.OrderNo,120,"Order number"), Date:String(bill.Date),
      TotalAmount:billNum_(bill.TotalAmount,"Total amount",false),
      AmountInWords:billText_(bill.AmountInWords,1000,"Amount in words"),
      Tax:tax, TaxPercentage:tax?billNum_(bill.TaxPercentage,"Tax percentage",false):"",
      InState:tax?inState:"", OutState:tax?outState:"",
      CGST:tax&&inState?billNum_(bill.CGST,"CGST rate",false):"",
      SGST:tax&&inState?billNum_(bill.SGST,"SGST rate",false):"",
      IGST:tax&&outState?billNum_(bill.IGST,"IGST rate",false):"",
      GrandTotal:billNum_(bill.GrandTotal,"Grand total",false),
      CGSTAmount:tax&&inState?Number((billNum_(bill.TotalAmount,"Total amount",false)*billNum_(bill.CGST,"CGST rate",false)/100).toFixed(2)):"",
      SGSTAmount:tax&&inState?Number((billNum_(bill.TotalAmount,"Total amount",false)*billNum_(bill.SGST,"SGST rate",false)/100).toFixed(2)):"",
      IGSTAmount:tax&&outState?Number((billNum_(bill.TotalAmount,"Total amount",false)*billNum_(bill.IGST,"IGST rate",false)/100).toFixed(2)):"",
      SiteAddress:billText_(bill.SiteAddress,500,"Site address")
    };
    const seen=new Set();
    const parts=[], details=[];
    payload.particulars.forEach((p,i)=>{
      const title=billText_(p.ParticularTitle,250,"Particular title");
      if(!title) throw new Error("Every particular needs a title.");
      const sno=i+1;
      if(seen.has(sno)) throw new Error("Duplicate particular serial number.");
      seen.add(sno);
      parts.push([billNo,title,sno,billNum_(p.Amount,"Particular amount",false),billText_(p["HSN Code"], 80, "HSN Code")]);
      const rows=Array.isArray(p.details)?p.details:[];
      if(rows.length>1000) throw new Error("Too many detail rows in a particular.");
      rows.forEach((d, detailIndex)=>details.push([
        billNo,sno,detailIndex+1,billText_(d.Description,1000,"Description"),
        billText_(d.Quantity,100,"Quantity"),
        billText_(d.Rate,100,"Rate")
      ]));
    });
    // Remove old parent/child rows first, then write the replacement atomically under script lock.
    if(originalBillNo) {
      deleteRowsByBillNo_(detailSheet, BILL_DETAIL_HEADERS_, originalBillNo);
      deleteRowsByBillNo_(partSheet, BILL_PARTICULAR_HEADERS_, originalBillNo);
      const oldRow=findBillRow_(billSheet,BILL_HEADERS_.indexOf("BillNo")+1,originalBillNo);
      if(oldRow>0) billSheet.deleteRow(oldRow);
    }
    const billRow=BILL_HEADERS_.map(h=>clean[h]);
    appendTextRow_(billSheet,billRow);
    if(parts.length) appendRowsText_(partSheet,parts);
    if(details.length) appendRowsText_(detailSheet,details);
    return json_({success:true,message:"Bill "+billNo+" saved successfully.",billNo});
  } finally { lock.releaseLock(); }
}
function findBillRow_(sheet,col,value) {
  if(sheet.getLastRow()<2)return -1;
  const values=sheet.getRange(2,col,sheet.getLastRow()-1,1).getDisplayValues();
  for(let i=0;i<values.length;i++)if(String(values[i][0])===String(value))return i+2;
  return -1;
}
function deleteRowsByBillNo_(sheet,headers,billNo) {
  if(sheet.getLastRow()<2)return;
  const col=headers.indexOf("BillNo")+1;
  const values=sheet.getRange(2,col,sheet.getLastRow()-1,1).getDisplayValues();
  for(let i=values.length-1;i>=0;i--)if(String(values[i][0])===String(billNo))sheet.deleteRow(i+2);
}
function appendTextRow_(sheet,row) {
  const r=sheet.getLastRow()+1;
  sheet.getRange(r,1,1,row.length).setNumberFormat("@");
  sheet.getRange(r,1,1,row.length).setValues([row.map(v=>v==null?"":String(v))]);
}
function appendRowsText_(sheet,rows) {
  const r=sheet.getLastRow()+1;
  sheet.getRange(r,1,rows.length,rows[0].length).setNumberFormat("@");
  sheet.getRange(r,1,rows.length,rows[0].length).setValues(rows.map(row=>row.map(v=>v==null?"":String(v))));
}
function deleteBill_(billNoValue) {
  const billNo=String(billNoValue==null?"":billNoValue).trim();
  if(!billNo) throw new Error("Bill number is required.");
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const billSheet=billSheet_("Bills",BILL_HEADERS_);
    const partSheet=billSheet_("BillParticulars",BILL_PARTICULAR_HEADERS_);
    const detailSheet=billSheet_("ParticularDetails",BILL_DETAIL_HEADERS_);
    const row=findBillRow_(billSheet,BILL_HEADERS_.indexOf("BillNo")+1,billNo);
    if(row<0) throw new Error("Bill not found.");
    deleteRowsByBillNo_(detailSheet,BILL_DETAIL_HEADERS_,billNo);
    deleteRowsByBillNo_(partSheet,BILL_PARTICULAR_HEADERS_,billNo);
    billSheet.deleteRow(row);
    return json_({success:true,message:"Bill "+billNo+" deleted successfully."});
  } finally {lock.releaseLock();}
}


/**
 * Run this function ONCE manually from the Apps Script editor if older bills
 * were saved with SNo starting at 0. It increments SNo for a bill only when
 * that bill's particular rows contain 0, and updates matching detail rows too.
 */
function migrateBillSerialNumbersToOneBased_() {
  const partSheet = billSheet_("BillParticulars", BILL_PARTICULAR_HEADERS_);
  const detailSheet = billSheet_("ParticularDetails", BILL_DETAIL_HEADERS_);
  const parts = billRows_(partSheet, BILL_PARTICULAR_HEADERS_);
  const details = billRows_(detailSheet, BILL_DETAIL_HEADERS_);
  const billNumbers = [...new Set(parts.filter(p=>Number(p.SNo)===0).map(p=>String(p.BillNo)))];
  let migrated = 0;
  billNumbers.forEach(billNo => {
    const billParts = parts.filter(p=>String(p.BillNo)===billNo);
    // Avoid modifying unusual mixed-numbering data.
    const sorted = billParts.map(p=>Number(p.SNo)).sort((a,b)=>a-b);
    if (!sorted.length || sorted.some((n,i)=>!Number.isInteger(n) || n!==i)) return;
    const partStart = 2;
    const partBillCol = BILL_PARTICULAR_HEADERS_.indexOf("BillNo")+1;
    const partSNoCol = BILL_PARTICULAR_HEADERS_.indexOf("SNo")+1;
    const detailBillCol = BILL_DETAIL_HEADERS_.indexOf("BillNo")+1;
    const detailParticularSNoCol = BILL_DETAIL_HEADERS_.indexOf("ParticularSNo")+1;
    const partLast = partSheet.getLastRow();
    if (partLast >= partStart) {
      const values = partSheet.getRange(partStart,1,partLast-1,BILL_PARTICULAR_HEADERS_.length).getDisplayValues();
      values.forEach((row,i)=>{
        if (String(row[partBillCol-1])===billNo) {
          partSheet.getRange(partStart+i,partSNoCol).setValue(Number(row[partSNoCol-1])+1);
        }
      });
    }
    const detailLast = detailSheet.getLastRow();
    if (detailLast >= 2) {
      const values = detailSheet.getRange(2,1,detailLast-1,BILL_DETAIL_HEADERS_.length).getDisplayValues();
      values.forEach((row,i)=>{
        if (String(row[detailBillCol-1])===billNo && row[detailParticularSNoCol-1]!=="") {
          detailSheet.getRange(i+2,detailParticularSNoCol).setValue(Number(row[detailParticularSNoCol-1])+1);
        }
      });
    }
    migrated++;
  });
  return json_({success:true,message:"Updated serial numbering for "+migrated+" bill(s)."});
}
