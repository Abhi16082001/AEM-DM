
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwMXVJbB9p1gN97r1bFDmv7pHpjdy4txkamzE4odFA1jhejuo-UUbu_i9v-ohrmcJRI/exec",

  APP_NAME: "Anil Earth Mover",
  SESSION_TOKEN_KEY: "billCreatorToken",
  SESSION_EXPIRY_KEY: "billCreatorTokenExpiresAt",

  NAV_LINKS: [
    { label: "Home", path: "home.html" }
  ],

  MENU_CARDS: [
    {
      id: "clients",
      title: "Client Management",
      description: "Create, view, edit and manage your clients.",
      path: "clients.html",
      icon: "♧",
      color: "#f2b354"
    },
     {
    id: "billers",
    title: "Biller Management",
    description: "Manage company details, contact information and formatted billing details.",
    path: "billers.html",
    icon: "▦",
    color: "#66afec"
  },
    {
      id: "bills",
      title: "Bill Management",
      description: "Create, calculate, view, edit, print and manage bills.",
      path: "bills.html",
      icon: "▦",
      color: "#7aec7e"
    },
    { id: "vehicle-types", title: "Vehicle Types", description: "Add and maintain vehicle types.", path: "master-data.html?feature=vehicleTypes", icon: "V", color: "#c686ec" },
    { id: "vehicles", title: "Vehicles", description: "Add and maintain vehicles and their types.", path: "master-data.html?feature=vehicles", icon: "V", color: "#c0836c" },
    { id: "staff-types", title: "Staff Types", description: "Add and maintain staff types.", path: "master-data.html?feature=staffTypes", icon: "S", color: "#5da89e" },
    { id: "staff", title: "Staff", description: "Add and maintain staff details.", path: "master-data.html?feature=staff", icon: "S", color: "#f0d680" },
    { id: "work", title: "Work Management", description: "Record vehicle work, quantities, rates and staff.", path: "master-data.html?feature=work", icon: "W", color: "#b9d7f5" },
    { id: "staff-management", title: "Staff Management", description: "Record staff payments and remarks.", path: "master-data.html?feature=staffManagement", icon: "S", color: "#f4b6c2" },
    { id: "statement", title: "Statement Management", description: "Record bank debit and credit statements.", path: "master-data.html?feature=statement", icon: "T", color: "#c4e6a4" },
    { id: "bank", title: "Add Bank Account", description: "Add and maintain bank accounts.", path: "master-data.html?feature=bank", icon: "B", color: "#d7c4f2" },
    { id: "data-type", title: "Data Type", description: "Create and manage unique data types.", path: "master-data.html?feature=dataType", icon: "D", color: "#f1c9db" },
    { id: "projects", title: "Project Management", description: "Create and manage client projects.", path: "master-data.html?feature=projects", icon: "P", color: "#8cc5bd" },
    { id: "analyze-work", title: "Analyze Work", description: "Read and filter work records.", path: "analysis.html?feature=work", icon: "W", color: "#a9d7ea" },
    { id: "analyze-statement", title: "Analyze Statement", description: "Read and filter statement entries.", path: "analysis.html?feature=statement", icon: "T", color: "#b8e2bd" },
    { id: "analyze-staff", title: "Analyze Staff", description: "Read and filter staff payments.", path: "analysis.html?feature=staff", icon: "S", color: "#f1d1a8" }
  ],

  CLIENTS: {
    SHEET_NAME: "Clients",

    FIELDS: [
      {
        name: "Id",
        label: "Client ID",
        type: "text",
        visibleInTable: true,
        editable: true,
        readOnly: true,
        required: false
      },
      {
        name: "Name",
        label: "Client Name",
        type: "text",
        visibleInTable: true,
        editable: true,
        required: true,
        maxLength: 150
      },
      {
        name: "Address",
        label: "Address",
        type: "textarea",
        visibleInTable: true,
        editable: true,
        required: true,
        maxLength: 1000
      },
 {
        name: "Phone",
        label: "Phone No.",
        type: "number",
        visibleInTable: true,
        editable: true,
        required: true,
        maxLength: 10
      },
      {
        name: "GST",
        label: "GST Number",
        type: "text",
        visibleInTable: true,
        editable: true,
        required: false,
        maxLength: 30
      },
        {
        name: "CompanyName",
        label: "Company Name",
        type: "text",
        visibleInTable: true,
        editable: true,
        required: false
      },
      { name: "NonProjectBalance", label: "Non-Project Balance", type: "number", visibleInTable: true, editable: true, required: false, maxLength: 100 },
      { name: "ProjectBalance", label: "Project Balance", type: "number", visibleInTable: true, editable: true, required: false, maxLength: 100 },
      { name: "TotalBalance", label: "Total Balance", type: "number", visibleInTable: true, editable: true, required: false, maxLength: 100 },
      { name: "PaymentRecieved", label: "Payment Recieved", type: "number", visibleInTable: true, editable: true, required: false, maxLength: 100 },
      { name: "PaymentLeft", label: "Payment Left", type: "number", visibleInTable: true, editable: true, required: false, maxLength: 100 },
      { name: "Remarks", label: "Remarks", type: "textarea", visibleInTable: true, editable: true, required: false, maxLength: 1000 }
    ],

    CALCULATIONS: [
      { target: "TotalBalance", inputs: ["ProjectBalance", "NonProjectBalance"], operation: "sum", label: "Calculate Total Balance" },
      { target: "PaymentLeft", inputs: ["TotalBalance", "PaymentRecieved"], operation: "subtract", label: "Calculate Payment Left" }
    ],

    ACTIONS: ["view", "edit", "delete"]
  },

BILLERS: {
  SHEET_NAME: "Billers",
  ID_PREFIX: "B",
  FIELDS: [
    {
      name: "Id",
      label: "Biller ID",
      type: "text",
      visibleInTable: true,
      editable: true,
      readOnly: true,
      required: false
    },
    {
      name: "Name",
      label: "Biller Name",
      type: "text",
      visibleInTable: true,
      editable: true,
      required: true,
      maxLength: 150
    },
    {
      name: "Phone",
      label: "Phone",
      type: "text",
      visibleInTable: true,
      editable: true,
      required: false,
      maxLength: 30
    },
    {
      name: "Alt.Phone",
      label: "Alternate Phone",
      type: "text",
      visibleInTable: false,
      editable: true,
      required: false,
      maxLength: 30
    },
    {
      name: "GST",
      label: "GST Number",
      type: "text",
      visibleInTable: true,
      editable: true,
      required: false,
      maxLength: 30
    },
    {
      name: "Company Name",
      label: "Company Name",
      type: "text",
      visibleInTable: true,
      editable: true,
      required: false,
      maxLength: 200
    },
    {
      name: "Address",
      label: "Address",
      type: "richtext",
      visibleInTable: false,
      editable: true,
      required: false,
      maxLength: 5000
    },
    {
      name: "PAN",
      label: "PAN",
      type: "text",
      visibleInTable: true,
      editable: true,
      required: false,
      maxLength: 20
    },
    {
      name: "Description",
      label: "Description",
      type: "richtext",
      visibleInTable: false,
      editable: true,
      required: false,
      maxLength: 10000
    }
  ],
  ACTIONS: ["view", "edit", "delete"]
},

  MASTER_DATA: {
    vehicleTypes: {
      resource: "vehicleTypes", title: "Vehicle Type Management", singular: "Vehicle Type", sheetName: "Types", primaryKey: "Id", autoId: true,
      fields: [
        { name: "Id", label: "ID", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 30 },
        { name: "Vehicle Type Name", label: "Vehicle Type Name", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 150 }
      ]
    },
    vehicles: {
      resource: "vehicles", title: "Vehicle Management", singular: "Vehicle", sheetName: "Vehicles", primaryKey: "Vehicle No",
      fields: [
        { name: "Vehicle No", label: "Vehicle No", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 80 },
        { name: "Type", label: "Type", type: "lookup", lookupResource: "vehicleTypes", lookupKey: "Id", lookupDisplay: record => record["Vehicle Type Name"], required: true, editable: true, visibleInTable: true, maxLength: 150 }
      ]
    },
    staffTypes: {
      resource: "staffTypes", title: "Staff Type Management", singular: "Staff Type", sheetName: "Types", primaryKey: "Id", autoId: true,
      fields: [
        { name: "Id", label: "ID", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 30 },
        { name: "Staff Type Name", label: "Staff Type Name", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 150 }
      ]
    },
    staff: {
      resource: "staff", title: "Staff Management", singular: "Staff Member", sheetName: "Staff", primaryKey: "Id", autoId: true,
      fields: [
        { name: "Id", label: "ID", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 30 },
        { name: "Name", label: "Name", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 150 },
        { name: "Type", label: "Type", type: "lookup", lookupResource: "staffTypes", lookupKey: "Id", lookupDisplay: record => record["Staff Type Name"], required: true, editable: true, visibleInTable: true, maxLength: 150 },
        { name: "Salary", label: "Salary", type: "number", required: true, editable: true, visibleInTable: true, maxLength: 20 },
        { name: "Remarks", label: "Remarks", type: "textarea", required: false, editable: true, visibleInTable: true, maxLength: 1000 }
      ]
    },
    work: {
      resource: "work", title: "Work Management", singular: "Work Record", sheetName: "Work", primaryKey: "WorkId", autoId: true,
      calculations: [
        { target: "Total", inputs: ["Quantity", "Rate"], operation: "multiply", label: "Calculate Total" },
        { target: "Net Amount", inputs: ["Total", "Diesel", "Additional Charge"], operation: "sum", label: "Calculate Net Amount" }
      ],
      fields: [
        { name: "TargetType", label: "Add work to", type: "workTargetType", required: true, editable: true, visibleInTable: false },
        { name: "TargetSheet", label: "Target Sheet", type: "workTargetSheet", required: true, editable: true, visibleInTable: false },
        { name: "WorkId", label: "Work ID", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 30 },
        { name: "DataType", label: "Data Type", type: "lookup", lookupResource: "dataType", lookupKey: "Id", lookupDisplay: record => record["Data Type Name"], required: true, editable: true, visibleInTable: true },
        { name: "Description", label: "Description", type: "textarea", required: false, editable: true, visibleInTable: true, maxLength: 5000 },
        { name: "Date", label: "Date", type: "date", required: true, editable: true, visibleInTable: true },
        { name: "VehicleType", label: "Vehicle Type", type: "lookup", lookupResource: "vehicleTypes", lookupKey: "Id", lookupDisplay: record => record["Vehicle Type Name"], required: false, editable: true, visibleInTable: true },
        { name: "Vehicle", label: "Vehicle", type: "multilookup", lookupResource: "vehicles", lookupKey: "Vehicle No", lookupDisplay: record => `${record["Vehicle No"]} (${record.TypeName || record.Type})`, required: false, editable: true, visibleInTable: true },
        { name: "Client", label: "Client", type: "lookup", lookupAction: "listClients", lookupResponse: "clients", lookupKey: "Id", lookupDisplay: record => `${record["Company Name"] || record.CompanyName || ""} (${record.Name || ""})`, required: false, editable: true, visibleInTable: true, hiddenInForm: true },
        { name: "Project", label: "Project", type: "lookup", lookupResource: "projects", lookupKey: "Id", lookupDisplay: record => `${record.ProjectName}(${record.ClientName || record.ClientId})`, required: false, editable: true, visibleInTable: true, hiddenInForm: true },
        { name: "SiteAddress", label: "Site Address", type: "textarea", required: false, editable: true, visibleInTable: true, maxLength: 1000 },
        { name: "Quantity", label: "Quantity", type: "text", required: false, editable: true, visibleInTable: true, maxLength: 100 },
        { name: "Night", label: "Night", type: "checkbox", required: false, editable: true, visibleInTable: true },
        { name: "Rate", label: "Rate", type: "text", required: false, editable: true, visibleInTable: true, maxLength: 100 },
        { name: "Total", label: "Total", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 100 },
        { name: "Diesel", label: "Diesel", type: "integer", required: false, editable: true, visibleInTable: true, maxLength: 100 },
        { name: "Additional Charge", label: "Additional Charge", type: "integer", required: false, editable: true, visibleInTable: true, maxLength: 100 },
        { name: "Net Amount", label: "Net Amount", type: "integer", required: true, editable: true, visibleInTable: true, maxLength: 100 },
        { name: "Staff", label: "Staff", type: "multilookup", lookupResource: "staff", lookupKey: "Id", lookupDisplay: record => `${record.Name}(${record.TypeName || record.Type})`, required: false, editable: true, visibleInTable: true },
        { name: "Remarks", label: "Remarks", type: "textarea", required: false, editable: true, visibleInTable: true, maxLength: 1000 }
      ]
    },
    staffManagement: {
      resource: "staffManagement", title: "Staff Management", singular: "Staff Payment", sheetName: "StaffManagement", primaryKey: "Id", autoId: true,
      fields: [
        { name: "Id", label: "ID", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 30 },
        { name: "Date", label: "Date", type: "date", required: true, editable: true, visibleInTable: true },
        { name: "Staff", label: "Staff", type: "lookup", lookupResource: "staff", lookupKey: "Id", lookupDisplay: record => `${record.Name} (${record.TypeName || record.Type})`, required: true, editable: true, visibleInTable: true },
        { name: "Amount", label: "Amount", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 100 },
        { name: "Remarks", label: "Remarks", type: "textarea", required: false, editable: true, visibleInTable: true, maxLength: 1000 }
      ]
    },
    bank: {
      resource: "bank", title: "Bank Account Management", singular: "Bank Account", sheetName: "Bank", primaryKey: "Id", autoId: true,
      fields: [
        { name: "Id", label: "ID", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 30 },
        { name: "Account Holder Name", label: "Account Holder Name", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 150 },
        { name: "Last 6 Digit of Bank Account", label: "Last 6 Digit of Bank Account", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 6 },
        { name: "Bank Name", label: "Bank Name", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 150 },
        { name: "Branch Name", label: "Branch Name", type: "text", required: false, editable: true, visibleInTable: true, maxLength: 150 },
        { name: "Saving/Current", label: "Saving/Current", type: "options", options: ["Saving", "Current"], required: true, editable: true, visibleInTable: true },
        { name: "IFSC Code", label: "IFSC Code", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 30 }
      ]
    },
    statement: {
      resource: "statement", title: "Statement Management", singular: "Statement Entry", sheetName: "Statement", primaryKey: "Id", autoId: true,
      fields: [
        { name: "Id", label: "ID", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 30 },
        { name: "Date", label: "Date", type: "date", required: true, editable: true, visibleInTable: true },
        { name: "Bank", label: "Bank", type: "lookup", lookupResource: "bank", lookupKey: "Id", lookupDisplay: record => `${record["Bank Name"]} (${record["Last 6 Digit of Bank Account"]}/${record["Account Holder Name"]})`, required: true, editable: true, visibleInTable: true },
        { name: "Debit/Credit", label: "Debit/Credit", type: "options", options: ["Debit", "Credit"], required: true, editable: true, visibleInTable: true },
        { name: "Amount", label: "Amount", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 100 },
        { name: "To/From", label: "To/From", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 250 },
        { name: "BillNo", label: "Bill No.", type: "text", required: false, editable: true, visibleInTable: true, maxLength: 100 },
        { name: "Remarks", label: "Remarks", type: "textarea", required: false, editable: true, visibleInTable: true, maxLength: 1000 }
      ]
    },
    dataType: {
      resource: "dataType", title: "Data Type", singular: "Data Type", sheetName: "Types", primaryKey: "Id", autoId: true,
      fields: [
        { name: "Id", label: "ID", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 30 },
        { name: "Data Type Name", label: "Data Type Name", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 150 }
      ]
    },
    projects: {
      resource: "projects", title: "Project Management", singular: "Project", sheetName: "Projects", primaryKey: "Id", autoId: true,
      calculations: [
        { target: "PaymentLeft", inputs: ["ProjectAmount", "PaymentRecieved"], operation: "subtract", label: "Calculate Payment Left" }
      ],
      fields: [
        { name: "Id", label: "Project ID", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 30 },
        { name: "ProjectName", label: "Project Name", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 200 },
        { name: "ClientId", label: "Client", type: "lookup", lookupAction: "listClients", lookupResponse: "clients", lookupKey: "Id", lookupDisplay: record => `${record["Company Name"] || record.CompanyName || record.Name || ""} (${record.Id})`, required: true, editable: true, visibleInTable: true },
        { name: "ProjectStartDate", label: "Project Start Date", type: "date", required: true, editable: true, visibleInTable: true },
        { name: "ProjectEndDate", label: "Project End Date", type: "date", required: true, editable: true, visibleInTable: true },
        { name: "ProjectAmount", label: "Project Amount", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 100 },
        { name: "ProjectDescription", label: "Project Description", type: "textarea", required: false, editable: true, visibleInTable: true, maxLength: 5000 },
        { name: "PaymentRecieved", label: "Payment Recieved", type: "number", required: false, editable: true, visibleInTable: true, maxLength: 100 },
        { name: "PaymentLeft", label: "Payment Left", type: "number", required: false, editable: true, visibleInTable: true, maxLength: 100 },
        { name: "ProjectStatus", label: "Project Status", type: "options", options: ["Not Started", "Started", "Pending", "Completed", "Not Completed"], required: false, editable: true, visibleInTable: true },
        { name: "Remarks", label: "Remarks", type: "textarea", required: false, editable: true, visibleInTable: true, maxLength: 1000 }
      ]
    }
  }
  
};

window.APP_CONFIG.ANALYSIS = {
  work: {
    resource: "work", title: "Analyze Work", singular: "Work Record", totalField: "Total", totalLabel: "work record(s)",
    calculationFields: [
      { field: "Total", label: "Calculate Total" },
      { field: "Diesel", label: "Calculate Diesel" },
      { field: "Additional Charge", label: "Calculate Additional Charge" },
      { field: "Net Amount", label: "Calculate Net Amount" }
    ],
    groupColors: [{ background: "#a2bde1", color: "#17307d" }, { background: "#e0f2fe", color: "#0c4a6e" }],
    fields: [
      ...window.APP_CONFIG.MASTER_DATA.work.fields
        .filter(field => !["workTargetType", "workTargetSheet"].includes(field.type))
        .map(field => {
        const analysisField = Object.assign({}, field, { required: false });
        return ["Vehicle", "Client", "Project"].includes(field.name)
          ? Object.assign(analysisField, { type: "multilookup" }) : analysisField;
      }),
      { name: "Full Client Data", label: "Full Client Data", type: "lookup", lookupAction: "listClients", lookupResponse: "clients", lookupKey: "Id", lookupDisplay: record => `${record["Company Name"] || record.CompanyName || ""} (${record.Name || ""})`, required: false, filterOnly: true }
    ]
  },
  statement: {
    resource: "statement", title: "Analyze Statement", singular: "Statement Entry",
    groupColors: [{ background: "#dbeafe", color: "#1e3a8a" }, { background: "#e0f2fe", color: "#0c4a6e" }],
    fields: window.APP_CONFIG.MASTER_DATA.statement.fields.map(field => Object.assign({}, field, { required: false }))
  },
  staff: {
    resource: "staffManagement", title: "Analyze Staff", singular: "Staff Payment", totalField: "Amount", totalLabel: "staff payment(s)",
    groupColors: [{ background: "#dbeafe", color: "#1e3a8a" }, { background: "#e0f2fe", color: "#0c4a6e" }],
    fields: [
      ...window.APP_CONFIG.MASTER_DATA.staffManagement.fields.map(field => Object.assign({}, field, { required: false })),
      { name: "Staff Type", label: "Staff Type", type: "lookup", lookupResource: "staffTypes", lookupKey: "Id", lookupDisplay: record => record["Staff Type Name"], required: false, visibleInTable: true }
    ]
  }
};
