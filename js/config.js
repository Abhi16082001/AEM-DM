
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbywDp-FgVBXAfEyDJ-PJZfVT74RF5bCGiCRr8yW-ozyraZUX2VJzYLcLfeGSV7XNDjX/exec",

  APP_NAME: "Bill Creator",
  SESSION_TOKEN_KEY: "billCreatorToken",
  SESSION_EXPIRY_KEY: "billCreatorTokenExpiresAt",

  NAV_LINKS: [
    { label: "Home", path: "home.html" },
    { label: "Client Management", path: "clients.html" }
  ],

  MENU_CARDS: [
    {
      id: "clients",
      title: "Client Management",
      description: "Create, view, edit and manage your clients.",
      path: "clients.html",
      icon: "users"
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
  }
};