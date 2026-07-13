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
 *   4. Serves the sign-up list (doGet) so the Coach Dashboard can pull new
 *      sign-ups straight into the athlete tracker.
 *
 * ONE-TIME SETUP (see the visual guide):
 *   1. Make a Google Sheet → Extensions → Apps Script.
 *   2. Paste this whole file over the default Code.gs. Save.
 *   3. Edit CONFIG below (at minimum OFFICE_EMAIL).
 *   4. Run "setup" once (menu Run ▸ setup) and grant permissions.
 *   5. Deploy ▸ New deployment ▸ Web app.
 *        Execute as: Me    Who has access: Anyone
 *      Copy the /exec URL — paste it into BOTH:
 *        • public/app.js  -> FORM_ENDPOINT   (site writes sign-ups here)
 *        • src/app.js     -> SIGNUPS_URL     (dashboard reads sign-ups here)
 * ------------------------------------------------------------------
 */

// ============ CONFIG — edit these ============
var CONFIG = {
  OFFICE_EMAIL: "athomas@Liberty-Benton.org", // where new-signup notices go
  PROGRAM_NAME: "LB Soccer Academy",
  REPLY_TO:     "athomas@Liberty-Benton.org", // families reply here

  // --- Remind auto-invite: every signup's welcome email invites them to join ---
  // Your class code (no @) and join link. Leave REMIND_CODE blank to skip.
  REMIND_CODE:     "6ee4bkk",
  REMIND_JOIN_URL: "https://www.remind.com/join/6ee4bkk",

  // --- OPTIONAL: automated TEXT messages via Twilio ---
  // Leave all three blank to skip texting (email still works fully).
  // Get these free-trial/paid values from twilio.com (Console).
  TWILIO_SID:   "",                            // "ACxxxx…"
  TWILIO_TOKEN: "",                            // auth token
  TWILIO_FROM:  ""                             // your Twilio number, e.g. "+14195550123"
};

var SHEET_SIGNUPS = "Signups";
var SHEET_SEND    = "Send a message";
var SHEET_ATT     = "Attendance";
var HEADERS = ["When", "Child", "Graduation class", "Program",
               "Parent", "Email", "Mobile", "Alerts", "Note", "Other sports"];
var ATT_HEADERS = ["Date", "Child", "Grad year", "Program", "Updated"];

// ================================================================
//  1) INTAKE — website form  ->  this spreadsheet (automatic)
// ================================================================
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.type === "attendance") return saveAttendance_(d);   // dashboard attendance sync
    var sh = sheetOf_(SHEET_SIGNUPS);
    sh.appendRow([
      new Date(), d.childName || "", d.gradClass || "", d.program || "",
      d.parentName || "", d.email || "", d.phone || "",
      d.alerts ? "yes" : "no", d.note || "", d.sports || ""
    ]);
    if (d.email) sendWelcome_(d);
    notifyOffice_(d);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// Save one session's attendance: overwrite the rows for that date.
function saveAttendance_(d) {
  var sh = sheetOf_(SHEET_ATT);
  if (sh.getLastRow() === 0) sh.appendRow(ATT_HEADERS);
  var date = String(d.date || "");
  var vals = sh.getDataRange().getValues();
  for (var r = vals.length - 1; r >= 1; r--) { if (String(vals[r][0]) === date) sh.deleteRow(r + 1); }
  var updated = d.updated || new Date().toISOString();
  (d.present || []).forEach(function (p) {
    sh.appendRow([date, p.name || "", p.gradYear || "", p.program || "", updated]);
  });
  return json_({ ok: true, saved: (d.present || []).length });
}

// ================================================================
//  READ — lets the Coach Dashboard pull the sign-up list.
//  The dashboard fetches this web-app URL (GET) and imports new
//  sign-ups as athletes.
// ================================================================
function doGet(e) {
  var sh = sheetOf_(SHEET_SIGNUPS);
  var rows = sh.getDataRange().getValues();
  var signups = [];
  for (var r = 1; r < rows.length; r++) {
    signups.push({
      when: String(rows[r][0]), child: rows[r][1], gradClass: rows[r][2],
      program: rows[r][3], parent: rows[r][4], email: rows[r][5],
      phone: rows[r][6], alerts: rows[r][7], note: rows[r][8], sports: rows[r][9] || ""
    });
  }
  var att = sheetOf_(SHEET_ATT).getDataRange().getValues();
  var attendance = [];
  for (var a = 1; a < att.length; a++) {
    if (!att[a][0]) continue;
    attendance.push({ date: String(att[a][0]), name: att[a][1], gradYear: att[a][2],
      program: att[a][3], updated: String(att[a][4]) });
  }
  return json_({ ok: true, signups: signups, attendance: attendance });
}

function sendWelcome_(d) {
  var subject = "You're in — " + CONFIG.PROGRAM_NAME;
  var join = CONFIG.REMIND_CODE
    ? ("ONE QUICK STEP — turn on alerts (10 seconds):\n" +
       "   Text  @" + CONFIG.REMIND_CODE + "  to  81010\n" +
       (CONFIG.REMIND_JOIN_URL ? "   or open  " + CONFIG.REMIND_JOIN_URL + "\n" : "") +
       "\nThat's how you'll get session reminders and urgent weather/cancellation " +
       "alerts on your phone. Do it once and you're set.\n\n")
    : "";
  var body =
    "Hi " + (d.parentName || "there") + ",\n\n" +
    (d.childName || "Your child") + " is signed up for the " + CONFIG.PROGRAM_NAME + ".\n\n" +
    join +
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
    d.sports ? "Other sports: " + d.sports : "",
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
    .createMenu("LB Academy")
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
    (urgent ? "\n\nIt will be marked URGENT." : "") + "\n\nGo?";
  if (ui.alert(subject, ask, ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;

  var subj = urgent ? "URGENT — " + subject : subject;
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
  m.getRange("A4").setValue("Then use the LB Academy menu → Send message to all families.");
  m.getRange("B2").setWrap(true);
  m.setColumnWidth(2, 520);

  var att = ss.getSheetByName(SHEET_ATT) || ss.insertSheet(SHEET_ATT);
  if (att.getLastRow() === 0) att.appendRow(ATT_HEADERS);
  att.getRange(1, 1, 1, ATT_HEADERS.length).setFontWeight("bold");
  att.setFrozenRows(1);

  SpreadsheetApp.getUi().alert("Ready.", "Sheets are set up. Deploy as a Web app next.", SpreadsheetApp.getUi().ButtonSet.OK);
}

function sheetOf_(name) {
  var ss = SpreadsheetApp.getActive();
  var s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name);
    if (name === SHEET_SIGNUPS) s.appendRow(HEADERS);
    else if (name === SHEET_ATT) s.appendRow(ATT_HEADERS); }
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
