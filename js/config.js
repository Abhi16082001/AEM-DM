
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
    { id: "vehicle-types", title: "Vehicle Types", description: "Add and maintain vehicle types.", path: "master-data.html?feature=vehicleTypes", icon: "V", color: "#d9a7f5" },
    { id: "vehicles", title: "Vehicles", description: "Add and maintain vehicles and their types.", path: "master-data.html?feature=vehicles", icon: "V", color: "#f3a98b" },
    { id: "staff-types", title: "Staff Types", description: "Add and maintain staff types.", path: "master-data.html?feature=staffTypes", icon: "S", color: "#9cd7cf" },
    { id: "staff", title: "Staff", description: "Add and maintain staff details.", path: "master-data.html?feature=staff", icon: "S", color: "#f0d680" }
  ],

  CLIENTS: {
    SHEET_NAME: "Clients",

    FIELDS: [
      {
        name: "Id",
        label: "Client ID",
        type: "text",
        visibleInTable: true,
        editable: false,
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
      }
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
      editable: false,
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
      resource: "vehicleTypes", title: "Vehicle Type Management", singular: "Vehicle Type", sheetName: "Types", primaryKey: "Vehicle Type Name",
      fields: [
        { name: "Vehicle Type Name", label: "Vehicle Type Name", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 150 }
      ]
    },
    vehicles: {
      resource: "vehicles", title: "Vehicle Management", singular: "Vehicle", sheetName: "Vehicles", primaryKey: "Vehicle No",
      fields: [
        { name: "Vehicle No", label: "Vehicle No", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 80 },
        { name: "Type", label: "Type", type: "lookup", lookupResource: "vehicleTypes", lookupField: "Vehicle Type Name", required: true, editable: true, visibleInTable: true, maxLength: 150 }
      ]
    },
    staffTypes: {
      resource: "staffTypes", title: "Staff Type Management", singular: "Staff Type", sheetName: "Types", primaryKey: "Staff Type Name",
      fields: [
        { name: "Staff Type Name", label: "Staff Type Name", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 150 }
      ]
    },
    staff: {
      resource: "staff", title: "Staff Management", singular: "Staff Member", sheetName: "Staff", primaryKey: "Id", autoId: true,
      fields: [
        { name: "Id", label: "ID", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 30 },
        { name: "Name", label: "Name", type: "text", required: true, editable: true, visibleInTable: true, maxLength: 150 },
        { name: "Type", label: "Type", type: "lookup", lookupResource: "staffTypes", lookupField: "Staff Type Name", required: true, editable: true, visibleInTable: true, maxLength: 150 },
        { name: "Remarks", label: "Remarks", type: "textarea", required: false, editable: true, visibleInTable: true, maxLength: 1000 }
      ]
    }
  }
  
};
