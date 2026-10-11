BILL MANAGEMENT INSTALLATION
=============================

This package adds Bill Management to the existing AEM-DM static HTML/CSS/JS + Apps Script project. It does not replace Code.gs, common.js, config.js, or your existing client/biller code.

1. Copy files
-------------
- bills.html -> repository root
- js/bills.js -> repository js/ folder
- css/bills.css -> repository css/ folder
- BillManagement.gs -> Apps Script editor as a NEW script file named BillManagement.gs

The Apps Script code intentionally reuses the existing getSpreadsheet_() and json_() helpers. Do not create another doPost(e).

2. Add four actions to the EXISTING doPost(e) switch in Code.gs
----------------------------------------------------------------
Inside the existing switch(request.action), after the existing biller cases and before default, add:

      case "listBills":
        return listBills_();

      case "getBill":
        return getBill_(request.billNo);

      case "saveBill":
        return saveBill_(request.data, request.originalBillNo);

      case "deleteBill":
        return deleteBill_(request.billNo);

Do not add these outside the switch, and do not remove any existing cases. The existing doPost must continue validating the session before this switch.

3. Add a dashboard card to js/config.js
---------------------------------------
Inside APP_CONFIG.MENU_CARDS, add this object after the Biller Management card (remember to add a comma after the previous object):

    {
      id: "bills",
      title: "Bill Management",
      description: "Create, calculate, view, edit, print and manage bills.",
      path: "bills.html",
      icon: "receipt"
    }

No change is required to home.html or js/home.js: the home page automatically renders MENU_CARDS. Optional: add { label: "Bill Management", path: "bills.html" } to NAV_LINKS.

4. Google Sheets
----------------
The backend automatically creates the three tabs if they do not exist, and writes the expected header row when a new tab is empty. If tabs already exist, their first-row headers must match exactly and in this order:

Bills:
ClientId | BillerId | BillNo | OrderNo | Date | TotalAmount | AmountInWords | Tax | TaxPercentage | InState | OutState | CGST | SGST | IGST | GrandTotal

BillParticulars:
BillNo | ParticularTitle | SNo | Amount

ParticularDetails:
BillNo | SNo | Description | Quantity | HSN Code | Rate

Existing tabs with incorrect headers are not automatically renamed or overwritten; correct the headers manually first. The existing Script Property SPREADSHEET_ID is reused.

5. Deploy Apps Script
---------------------
After saving, open Deploy > Manage deployments > Edit (pencil) for the existing web app deployment. Select a new version and deploy. Keep the same web app URL configured in js/config.js. Test signing in, then open Bill Management.

6. Behaviour notes
------------------
- BillNo is suggested as max existing numeric bill number + 1 and remains editable.
- Particular SNo is assigned in display order starting from 0 per bill. Detail rows use BillNo + SNo.
- Calculate Amount parses the first numeric value from Quantity and Rate (commas/decimals allowed) and multiplies them. For example, "5.2 trips" × "Rs. 6,000/trip" = 31,200.
- Calculate bill total sums the particular amounts. TotalAmount and GrandTotal remain editable.
- Tax is stored as true/false. When disabled, TaxPercentage, InState, OutState, CGST, SGST, and IGST are blank/null-equivalent. With in-state GST, CGST and SGST are percentage rates; with out-of-state GST, IGST is the rate. The rates are applied to TotalAmount.
- The page supports create, list, search, view, edit, delete and browser Print / Save as PDF. Printing is a basic printable view, not a custom final invoice layout.
- Editing replaces the bill and its child rows under a script lock. Keep regular sheet backups.

7. Quick smoke test
-------------------
1. Sign in and confirm Client Management and Biller Management still work.
2. Open Bill Management. If no bills exist, an empty-state message appears.
3. Create a bill with one particular and two detail rows.
4. Click Calculate Amount for that particular, then Calculate bill total.
5. Enable tax and test both In-state and Out-of-state.
6. Save; confirm a row appears in each relevant sheet.
7. View, edit, print, and delete the test bill.
