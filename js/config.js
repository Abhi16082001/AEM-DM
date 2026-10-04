
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwMXVJbB9p1gN97r1bFDmv7pHpjdy4txkamzE4odFA1jhejuo-UUbu_i9v-ohrmcJRI/exec",

  APP_NAME: "Bill Creator",
  SESSION_TOKEN_KEY: "billCreatorToken",
  SESSION_EXPIRY_KEY: "billCreatorTokenExpiresAt",

  NAV_LINKS: [
    { label: "Home", path: "home.html" },
    // { label: "Client Management", path: "clients.html" }
  ],

  MENU_CARDS: [
    {
      id: "clients",
      title: "Client Management",
      description: "Create, view, edit and manage your clients.",
      path: "clients.html",
      icon: "users"
    },
     {
    id: "billers",
    title: "Biller Management",
    description: "Manage company details, contact information and formatted billing details.",
    path: "billers.html",
    icon: "building-2"
  }
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
        name: "SiteAddress",
        label: "Site Address",
        type: "textarea",
        visibleInTable: false,
        editable: true,
        required: false,
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
}
  
};