/**
 * THE LB SOCCER ACADEMY — signup intake + one-click messaging
 * ------------------------------------------------------------------
 * A free Google Apps Script "backend" for the public site. No server to host.
 *
 * WHAT IT DOES
 *   1. Receives every website signup and logs it to this spreadsheet — hands-off.
 *   2. Auto-emails a welcome to the parent and notifies your office.
 *   3. Adds an "LB Academy" menu so you can message ALL families — email
 *      (free) and, if you turn on Twilio, text — in one click.
 *
 * ONE-TIME SETUP (see the visual guide):
 *   1. Make a Google Sheet → Extensions → Apps Script.
 *   2. Paste this whole file over the default Code.gs. Save.
 *   3. Edit CONFIG below (at minimum OFFICE_EMAIL).
 *   4. Run "setup" once (menu Run ▸ setup) and grant permissions.
 *   5. Deploy ▸ New deployment ▸ Web app.
 *        Execute as: Me    Who has access: Anyone
 *      Copy the /exec URL — paste it into public/app.js (FORM_ENDPOINT).
 * ------------------------------------------------------------------
 */

// ============ CONFIG — edit these ============
var CONFIG = {
  OFFICE_EMAIL: "athomas@Liberty-Benton.org", // where new-signup notices go
  PROGRAM_NAME: "LB Soccer Academy",
  REPLY_TO:     "athomas@Liberty-Benton.org", // families reply here

  // --- OPTIONAL: automated TEXT messages via Twilio ---
  // Leave all three blank to skip texting (email still works fully).
  // Get these free-trial/paid values from twilio.com (Console).
  TWILIO_SID:   "",                            // "ACxxxx…"
  TWILIO_TOKEN: "",                            // auth token
  TWILIO_FROM:  ""                             // your Twilio number, e.g. "+14195550123"
};

var SHEET_SIGNUPS = "Signups";
var SHEET_SEND    = "Send a message";
var HEADERS = ["When", "Child", "Graduation class", "Program",
               "Parent", "Email", "Mobile", "Alerts", "Note"];

// ================================================================
//  1) INTAKE — website form  ->  this spreadsheet (automatic)
// ================================================================
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var sh = sheetOf_(SHEET_SIGNUPS);
    sh.appendRow([
      new Date(), d.childName || "", d.gradClass || "", d.program || "",
      d.parentName || "", d.email || "", d.phone || "",
      d.alerts ? "yes" : "no", d.note || ""
    ]);
    if (d.email) sendWelcome_(d);
    notifyOffice_(d);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function sendWelcome_(d) {
  var subject = "You're in — " + CONFIG.PROGRAM_NAME;
  var body =
    "Hi " + (d.parentName || "there") + ",\n\n" +
    (d.childName || "Your child") + " is signed up for the " + CONFIG.PROGRAM_NAME + ".\n\n" +
    "You're all set for alerts — we'll send session reminders and any urgent weather " +
    "or cancellation notices by text and email. Nothing else to join.\n\n" +
    "Questions? Just reply to this email.\n\n— " + CONFIG.PROGRAM_NAME;
  MailApp.sendEmail({ to: d.email, subject: subject, body: body,
    replyTo: CONFIG.REPLY_TO, name: CONFIG.PROGRAM_NAME });
}

function notifyOffice_(d) {
  var subject = "New signup: " + (d.childName || "?") + " (" + (d.program || "?") + ")";
  var body = [
    "Child: " + (d.childName || ""),
    "Graduation class: " + (d.gradClass || ""),
    "Program: " + (d.program || ""),
    "Parent: " + (d.parentName || ""),
    "Email: " + (d.email || ""),
    "Mobile: " + (d.phone || ""),
    "Alerts OK: " + (d.alerts ? "yes" : "no"),
    d.note ? "Note: " + d.note : ""
  ].filter(String).join("\n");
  MailApp.sendEmail({ to: CONFIG.OFFICE_EMAIL, subject: subject, body: body,
    replyTo: d.email || CONFIG.REPLY_TO });
}

// ================================================================
//  2) SEND A MESSAGE — one click to every family
// ================================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📣 LB Academy")
    .addItem("Send message to all families", "sendMessage")
    .addItem("Send URGENT message to all families", "sendUrgent")
    .addSeparator()
    .addItem("Set up / repair sheets", "setup")
    .addToUi();
}

function sendMessage() { broadcast_(false); }
function sendUrgent()  { broadcast_(true); }

function broadcast_(urgent) {
  var ui = SpreadsheetApp.getUi();
  var send = sheetOf_(SHEET_SEND);
  var subject = String(send.getRange("B1").getValue() || "").trim();
  var message = String(send.getRange("B2").getValue() || "").trim();
  if (!message) { ui.alert("Type your message in the 'Send a message' tab first (cell B2)."); return; }
  if (!subject) subject = CONFIG.PROGRAM_NAME + " update";

  var recips = recipients_();
  var texting = CONFIG.TWILIO_SID && CONFIG.TWILIO_TOKEN && CONFIG.TWILIO_FROM;
  var ask = "Send this to " + recips.emails.length + " emails" +
    (texting ? " and " + recips.phones.length + " texts" : "") +
    (urgent ? "\n\n🚨 It will be marked URGENT." : "") + "\n\nGo?";
  if (ui.alert(subject, ask, ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;

  var subj = urgent ? "🚨 URGENT — " + subject : subject;
  var body = (urgent ? "URGENT NOTICE\n\n" : "") + message + "\n\n— " + CONFIG.PROGRAM_NAME;

  if (recips.emails.length) {
    GmailApp.sendEmail(CONFIG.OFFICE_EMAIL, subj, body,
      { bcc: recips.emails.join(","), replyTo: CONFIG.REPLY_TO, name: CONFIG.PROGRAM_NAME });
  }
  var texts = 0;
  if (texting) {
    var sms = (urgent ? "URGENT — " : "") + message;
    for (var i = 0; i < recips.phones.length; i++) {
      if (sendSms_(recips.phones[i], sms)) texts++;
    }
  }
  ui.alert("Sent.", "Emailed " + recips.emails.length + " families" +
    (texting ? " · texted " + texts : "") + ".", ui.ButtonSet.OK);
}

// Pull every family flagged "alerts = yes" with a contact on file.
function recipients_() {
  var sh = sheetOf_(SHEET_SIGNUPS);
  var rows = sh.getDataRange().getValues();
  var emails = {}, phones = {};   // objects = automatic de-dupe
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][7]).toLowerCase() !== "yes") continue; // Alerts column
    var email = String(rows[r][5] || "").trim();
    var phone = String(rows[r][6] || "").trim();
    if (email.indexOf("@") > 0) emails[email.toLowerCase()] = email;
    if (phone) phones[normPhone_(phone)] = normPhone_(phone);
  }
  return { emails: Object.keys(emails).map(function (k) { return emails[k]; }),
           phones: Object.keys(phones) };
}

function sendSms_(to, text) {
  try {
    var url = "https://api.twilio.com/2010-04-01/Accounts/" + CONFIG.TWILIO_SID + "/Messages.json";
    UrlFetchApp.fetch(url, {
      method: "post",
      headers: { Authorization: "Basic " + Utilities.base64Encode(CONFIG.TWILIO_SID + ":" + CONFIG.TWILIO_TOKEN) },
      payload: { From: CONFIG.TWILIO_FROM, To: to, Body: text },
      muteHttpExceptions: true
    });
    return true;
  } catch (err) { return false; }
}

// Best-effort E.164 for US numbers (Twilio wants +1XXXXXXXXXX).
function normPhone_(p) {
  var digits = String(p).replace(/[^0-9]/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.charAt(0) === "1") return "+" + digits;
  return p.charAt(0) === "+" ? p : "+" + digits;
}

// ================================================================
//  Helpers
// ================================================================
function setup() {
  var ss = SpreadsheetApp.getActive();
  var s = ss.getSheetByName(SHEET_SIGNUPS) || ss.insertSheet(SHEET_SIGNUPS);
  if (s.getLastRow() === 0) s.appendRow(HEADERS);
  s.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  s.setFrozenRows(1);

  var m = ss.getSheetByName(SHEET_SEND) || ss.insertSheet(SHEET_SEND);
  m.clear();
  m.getRange("A1").setValue("Subject:").setFontWeight("bold");
  m.getRange("A2").setValue("Message:").setFontWeight("bold");
  m.getRange("A4").setValue("Then use the 📣 LB Academy menu → Send message to all families.");
  m.getRange("B2").setWrap(true);
  m.setColumnWidth(2, 520);
  SpreadsheetApp.getUi().alert("Ready.", "Sheets are set up. Deploy as a Web app next.", SpreadsheetApp.getUi().ButtonSet.OK);
}

function sheetOf_(name) {
  var ss = SpreadsheetApp.getActive();
  var s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); if (name === SHEET_SIGNUPS) s.appendRow(HEADERS); }
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
