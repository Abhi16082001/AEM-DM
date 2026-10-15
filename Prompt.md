Now we are adding 4 more menu cards : Work management, Staff management, Statement management, Add Bank account.
Fields for each feature:
Work management: date, vehicle, client ,quantity ,night, rate, total ,staff, remarks. In this night is a checkbox if checked store true otherwise false, vehicle, client, staff are drop-down and should get their value from respective sheets already present. Vehicle should visible as [Vehicleno (Vehicle Type)]; Client should be visible as [Company Name (Name)] and Staff should be visiable as[Name (Staff Type)] inside dropdown but store just their respective primary keys [Vehicleno, staffid, clientid] in this sheet. A button in form to calculate amount from quantity*rate and in both these fields there can be other strings like 2 trips, rs. 6, 000 per trip so fetch only numerical part and then multiply and store in Total  but still keep amount editabe.
Sheet Name: Work

Staff Management: Date, Staff, Amount, Remarks. Staff is drop-down as above.
Sheet Name: StaffManagement.

Add Bank Account: Id, Account holder name, Last 6 digit of bank account, Bankn Name, Branch name, Saving/Current, IFSC Code. Saving/Current is dropdown with just these two values; Id should automatically generate as max current id + 1 from sheet but still keep its editable.
Sheet Name: Bank

Statement Management: Date, Bank, Debit/Credit, Amount, To/From, BillNo,Remarks. Bank Id will come from Bank Sheet. Sheet Name: Statement; Bank shoudl be visible as [Bank Name(last 6 digit/ HolderName)] but store only Id in this sheet.

All dropdowns must be searchable, Date should be a date picker not textbox and all forms must be dynamic , means they should come from config file as other similar forms. Means if i want to add some field later then i should only need to add column in config and in the sheet not anywhere else and also do this for current 4 forms of master data.