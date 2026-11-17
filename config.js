// =====================================================================
//  SETTINGS — this is the only file you normally need to edit.
// =====================================================================
window.DSF = {
  // WhatsApp number that receives admission forms and payment confirmations
  whatsapp: "918777292030",

  // ---- Fee payment (Pay Fees page) ----
  // Put your UPI ID here to switch on the QR code and "Open UPI app" button.
  upiId: "9748792539@upi",                               // e.g. "dreamerswimming@okhdfcbank"
  upiName: "Dreamer Swimming Foundation",  // name shown to the payer

  // ---- Admin login + Notice Board (see README.md, "Admin login setup") ----
  firebase: {
    apiKey: "AIzaSyBXGRjN-8EAweCjgIPFn2Z0SzDBeDIL6dg",                            // Firebase console > Project settings > Web API key
    projectId: "bdsf-website-database"                          // Firebase console > Project settings > Project ID
  },

  // ---- Student & staff portal ----
  // Keep false until firestore.rules is published in Firebase (README.md, "One-time Firebase setup").
  // While false, the portal pages show "opening soon" and collect no personal data.
  portalReady: false
};

// Shown on the Notice Board only until admin login is set up.
window.NOTICES = [
  { date: "Welcome", title: "This is where we post updates",
    text: "Batch timing changes, holiday closures and other announcements will appear here.", important: false }
];

// Magazine photos: upload the image into the "gallery" folder, then add a line.
// category: "Programs", "Competitions" or "Events"
window.MAGAZINE = [
  // { src: "gallery/relay-2026.jpg", caption: "District relay, October 2026", category: "Competitions" },
];
