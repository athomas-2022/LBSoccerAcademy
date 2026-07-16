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

  // --- Shared Google Calendar: events added in the dashboard are created here ---
  // Make a Google Calendar (calendar.google.com ▸ + ▸ Create new calendar),
  // set it "Make available to public", then Settings ▸ Integrate calendar ▸
  // copy the "Calendar ID" (looks like ...@group.calendar.google.com) here.
  // Paste the SAME id into public/app.js GOOGLE_CALENDAR_ID and src/app.js
  // CALENDAR_ID. Leave "" to skip calendar creation (events still save & sync).
  CALENDAR_ID: "c_a280d4cafbf4f9838c8141178df7d56c29221939f94bf2b1810d6c5426f8490c@group.calendar.google.com",

  // --- Access control: who may open the Coach Dashboard + read its data ---
  // CLIENT_ID must equal the OAuth client id pasted into src/app.js
  // GOOGLE_CLIENT_ID. Owners are always approved and manage the approved list
  // (Manage access in the dashboard, or the "Access" sheet tab). List each
  // owner's Google email in lowercase. Leave CLIENT_ID "" to disable the gate
  // (open access — only while finishing setup).
  CLIENT_ID:    "272844850821-4li2sup0s44gvasaub514d5qbg9nfq5p.apps.googleusercontent.com",
  OWNER_EMAILS: ["athomas@liberty-benton.org"],

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
var SHEET_EVENTS  = "Events";
var SHEET_ACCESS  = "Access";
var ACCESS_HEADERS = ["Email", "Name", "Added", "Added by"];
var SHEET_FIN     = "Finances";
var FIN_HEADERS   = ["Id", "Date", "Type", "Category", "Amount", "Method",
                     "Paid to/from", "Description", "Note", "Updated", "Deleted"];
var HEADERS = ["When", "Child", "Graduation class", "Program",
               "Parent", "Email", "Mobile", "Alerts", "Note", "Other sports"];
var ATT_HEADERS = ["Date", "Event", "EventId", "Child", "Grad year", "Program", "Updated"];
var EVENT_HEADERS = ["Id", "Title", "Date", "Start", "End", "Location",
                     "Program", "Tier", "Note", "CalendarEventId", "Updated", "Deleted"];

// ================================================================
//  ACCESS CONTROL — verify Google ID token + approved-email list
// ================================================================
function authEnabled_() { return !!CONFIG.CLIENT_ID; }

// Validate a Google Identity Services ID token and return {email,name} or null.
function verifyToken_(token) {
  if (!token) return null;
  try {
    var resp = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token),
      { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return null;
    var info = JSON.parse(resp.getContentText());
    if (String(info.aud) !== String(CONFIG.CLIENT_ID)) return null;                 // issued for another app
    if (info.exp && (Number(info.exp) * 1000) < Date.now()) return null;            // expired
    if (info.email_verified !== true && String(info.email_verified) !== "true") return null;
    return { email: String(info.email || "").toLowerCase(), name: info.name || "" };
  } catch (e) { return null; }
}

function owners_() { return (CONFIG.OWNER_EMAILS || []).map(function (e) { return String(e).toLowerCase(); }); }
function isOwner_(email) { return owners_().indexOf(String(email).toLowerCase()) > -1; }
function accessEmails_() {
  var rows = sheetOf_(SHEET_ACCESS).getDataRange().getValues();
  var out = [];
  for (var r = 1; r < rows.length; r++) { if (rows[r][0]) out.push({ email: String(rows[r][0]).toLowerCase(), name: rows[r][1] || "" }); }
  return out;
}
function isApproved_(email) {
  email = String(email).toLowerCase();
  if (isOwner_(email)) return true;
  return accessEmails_().some(function (x) { return x.email === email; });
}
// Resolve identity from a token. Gate off -> open. Returns null on bad token.
function authOf_(token) {
  if (!authEnabled_()) return { email: "", owner: true, approved: true, open: true };
  var v = verifyToken_(token);
  if (!v) return null;
  return { email: v.email, name: v.name, owner: isOwner_(v.email), approved: isApproved_(v.email) };
}
function accessAdd_(d, auth) {
  if (!auth || !auth.owner) return json_({ ok: false, error: "auth" });
  var email = String(d.email || "").toLowerCase().trim();
  if (!email || email.indexOf("@") < 1) return json_({ ok: false, error: "bad email" });
  var sh = sheetOf_(SHEET_ACCESS);
  var rows = sh.getDataRange().getValues();
  for (var r = 1; r < rows.length; r++) { if (String(rows[r][0]).toLowerCase() === email) return json_({ ok: true, already: true }); }
  sh.appendRow([email, d.name || "", new Date(), auth.email || ""]);
  return json_({ ok: true });
}
function accessRemove_(d, auth) {
  if (!auth || !auth.owner) return json_({ ok: false, error: "auth" });
  var email = String(d.email || "").toLowerCase().trim();
  var sh = sheetOf_(SHEET_ACCESS);
  var rows = sh.getDataRange().getValues();
  for (var r = rows.length - 1; r >= 1; r--) { if (String(rows[r][0]).toLowerCase() === email) sh.deleteRow(r + 1); }
  return json_({ ok: true });
}

// ================================================================
//  1) INTAKE — website form  ->  this spreadsheet (automatic)
// ================================================================
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    // Dashboard writes require an approved signed-in account; website signups don't.
    var DASH = { attendance: 1, event: 1, "event-delete": 1, finance: 1, "finance-delete": 1, "access-add": 1, "access-remove": 1 };
    if (DASH[d.type]) {
      var auth = authOf_(d.token);
      if (authEnabled_() && (!auth || !auth.approved)) return json_({ ok: false, error: "auth" });
      if (d.type === "attendance")     return saveAttendance_(d);
      if (d.type === "event")          return saveEvent_(d);
      if (d.type === "event-delete")   return deleteEvent_(d);
      if (d.type === "finance")        return saveFinance_(d);
      if (d.type === "finance-delete") return deleteFinance_(d);
      if (d.type === "access-add")     return accessAdd_(d, auth);
      if (d.type === "access-remove")  return accessRemove_(d, auth);
    }
    // ---- public website signup (no auth) ----
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

// Save one session's attendance: overwrite the rows for that event (or date).
// Columns: Date, Event, EventId, Child, Grad year, Program, Updated
function saveAttendance_(d) {
  var sh = sheetOf_(SHEET_ATT);
  if (sh.getLastRow() === 0) sh.appendRow(ATT_HEADERS);
  var eventId = String(d.eventId || "");
  var date = String(d.date || "");
  var vals = sh.getDataRange().getValues();
  for (var r = vals.length - 1; r >= 1; r--) {
    var match = eventId ? (String(vals[r][2]) === eventId)
                        : (String(vals[r][2]) === "" && String(vals[r][0]) === date);
    if (match) sh.deleteRow(r + 1);
  }
  var updated = d.updated || new Date().toISOString();
  (d.present || []).forEach(function (p) {
    sh.appendRow([date, d.event || "", eventId, p.name || "", p.gradYear || "", p.program || "", updated]);
  });
  return json_({ ok: true, saved: (d.present || []).length });
}

// ================================================================
//  EVENTS — dashboard schedule  ->  this spreadsheet + Google Calendar
// ================================================================
// Create or update one event row (keyed by Id) and mirror it onto the shared
// Google Calendar so families who subscribed see it automatically.
function saveEvent_(d) {
  var sh = sheetOf_(SHEET_EVENTS);
  if (sh.getLastRow() === 0) sh.appendRow(EVENT_HEADERS);
  var id = String(d.id || "");
  if (!id) return json_({ ok: false, error: "missing id" });
  var vals = sh.getDataRange().getValues();
  var rowIdx = -1;
  for (var r = 1; r < vals.length; r++) { if (String(vals[r][0]) === id) { rowIdx = r; break; } }
  var existingCalId = rowIdx > -1 ? String(vals[rowIdx][9] || "") : "";
  var calId = syncCalendar_(d, existingCalId);
  var row = [id, d.title || "", String(d.date || ""), String(d.start || ""), String(d.end || ""),
    d.location || "", d.program || "All", d.tier || "", d.note || "", calId,
    d.updated || new Date().toISOString(), ""];
  if (rowIdx > -1) sh.getRange(rowIdx + 1, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  return json_({ ok: true, calId: calId });
}

// Delete an event: remove its row, its calendar entry, and its attendance rows.
function deleteEvent_(d) {
  var id = String(d.id || "");
  if (!id) return json_({ ok: false, error: "missing id" });
  var sh = sheetOf_(SHEET_EVENTS);
  var vals = sh.getDataRange().getValues();
  for (var r = vals.length - 1; r >= 1; r--) {
    if (String(vals[r][0]) === id) { removeCalendar_(String(vals[r][9] || "")); sh.deleteRow(r + 1); }
  }
  var at = sheetOf_(SHEET_ATT);
  var av = at.getDataRange().getValues();
  for (var a = av.length - 1; a >= 1; a--) { if (String(av[a][2]) === id) at.deleteRow(a + 1); }
  return json_({ ok: true });
}

// ================================================================
//  FINANCES — dashboard ledger  ->  this spreadsheet
// ================================================================
function saveFinance_(d) {
  var sh = sheetOf_(SHEET_FIN);
  if (sh.getLastRow() === 0) sh.appendRow(FIN_HEADERS);
  var id = String(d.id || "");
  if (!id) return json_({ ok: false, error: "missing id" });
  var vals = sh.getDataRange().getValues();
  var rowIdx = -1;
  for (var r = 1; r < vals.length; r++) { if (String(vals[r][0]) === id) { rowIdx = r; break; } }
  var row = [id, String(d.date || ""), d.kind === "in" ? "in" : "out", d.category || "",
    Number(d.amount) || 0, d.method || "", d.party || "", d.desc || "", d.note || "",
    d.updated || new Date().toISOString(), ""];
  if (rowIdx > -1) sh.getRange(rowIdx + 1, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  return json_({ ok: true });
}
function deleteFinance_(d) {
  var id = String(d.id || "");
  if (!id) return json_({ ok: false, error: "missing id" });
  var sh = sheetOf_(SHEET_FIN);
  var vals = sh.getDataRange().getValues();
  for (var r = vals.length - 1; r >= 1; r--) { if (String(vals[r][0]) === id) sh.deleteRow(r + 1); }
  return json_({ ok: true });
}

// ---- Google Calendar helpers ----
function calendar_() {
  if (!CONFIG.CALENDAR_ID) return null;
  try { return CalendarApp.getCalendarById(CONFIG.CALENDAR_ID); } catch (e) { return null; }
}
function pad2_(t) { var p = String(t).split(":"); return ("0" + (p[0] || "0")).slice(-2) + ":" + ("0" + (p[1] || "0")).slice(-2); }
function eventTimes_(d) {
  var date = String(d.date || ""); if (!date) return null;
  if (d.start) {
    var s = new Date(date + "T" + pad2_(d.start) + ":00");
    var e = d.end ? new Date(date + "T" + pad2_(d.end) + ":00") : new Date(s.getTime() + 3600000);
    if (e <= s) e = new Date(s.getTime() + 3600000);
    return { start: s, end: e, allDay: false };
  }
  return { start: new Date(date + "T00:00:00"), allDay: true };
}
function eventTitle_(d) { return (d.title || "Session") + (d.program && d.program !== "All" ? " (" + d.program + ")" : ""); }
function eventDesc_(d) {
  var parts = [];
  if (d.tier) parts.push(d.tier);
  if (d.note) parts.push(d.note);
  parts.push(CONFIG.PROGRAM_NAME);
  return parts.join("\n");
}
function syncCalendar_(d, existingCalId) {
  var cal = calendar_(); if (!cal) return existingCalId || "";
  var t = eventTimes_(d); if (!t) return existingCalId || "";
  var title = eventTitle_(d);
  try {
    var ev = existingCalId ? cal.getEventById(existingCalId) : null;
    if (ev) {
      ev.setTitle(title);
      if (t.allDay) ev.setAllDayDate(t.start); else ev.setTime(t.start, t.end);
      ev.setLocation(d.location || ""); ev.setDescription(eventDesc_(d));
      return ev.getId();
    }
    var created = t.allDay
      ? cal.createAllDayEvent(title, t.start, { location: d.location || "", description: eventDesc_(d) })
      : cal.createEvent(title, t.start, t.end, { location: d.location || "", description: eventDesc_(d) });
    return created.getId();
  } catch (e) { return existingCalId || ""; }
}
function removeCalendar_(calId) {
  if (!calId) return;
  var cal = calendar_(); if (!cal) return;
  try { var ev = cal.getEventById(calId); if (ev) ev.deleteEvent(); } catch (e) {}
}

// ================================================================
//  READ — lets the Coach Dashboard pull the sign-up list.
//  The dashboard fetches this web-app URL (GET) and imports new
//  sign-ups as athletes.
// ================================================================
function doGet(e) {
  var token = (e && e.parameter) ? e.parameter.token : "";
  var auth = authOf_(token);
  if (authEnabled_()) {
    if (!auth) return json_({ ok: false, error: "auth" });
    if (!auth.approved) return json_({ ok: false, error: "pending", email: auth.email });
  }
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
    if (!att[a][0] && !att[a][2]) continue;
    attendance.push({ date: String(att[a][0]), event: att[a][1], eventId: String(att[a][2] || ""),
      name: att[a][3], gradYear: att[a][4], program: att[a][5], updated: String(att[a][6]) });
  }
  var evRows = sheetOf_(SHEET_EVENTS).getDataRange().getValues();
  var events = [];
  for (var v = 1; v < evRows.length; v++) {
    if (!evRows[v][0]) continue;                                    // no id
    if (String(evRows[v][11]).toLowerCase() === "yes") continue;    // soft-deleted
    events.push({ id: String(evRows[v][0]), title: evRows[v][1], date: String(evRows[v][2]),
      start: String(evRows[v][3] || ""), end: String(evRows[v][4] || ""), location: evRows[v][5],
      program: evRows[v][6], tier: evRows[v][7], note: evRows[v][8],
      calId: String(evRows[v][9] || ""), updated: String(evRows[v][10] || "") });
  }
  var finRows = sheetOf_(SHEET_FIN).getDataRange().getValues();
  var finances = [];
  for (var f = 1; f < finRows.length; f++) {
    if (!finRows[f][0]) continue;
    finances.push({ id: String(finRows[f][0]), date: String(finRows[f][1]), kind: finRows[f][2],
      category: finRows[f][3], amount: Number(finRows[f][4]) || 0, method: finRows[f][5],
      party: finRows[f][6], desc: finRows[f][7], note: finRows[f][8], updated: String(finRows[f][9] || "") });
  }
  var out = { ok: true, approved: true, owner: auth ? !!auth.owner : true,
    signups: signups, attendance: attendance, events: events, finances: finances };
  if (out.owner) { out.access = accessEmails_(); out.owners = owners_(); }
  return json_(out);
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
  var ah = att.getLastRow() ? att.getRange(1, 1, 1, ATT_HEADERS.length).getValues()[0].join("|") : "";
  if (ah !== ATT_HEADERS.join("|")) { att.clear(); att.appendRow(ATT_HEADERS); } // migrate old schema
  att.getRange(1, 1, 1, ATT_HEADERS.length).setFontWeight("bold");
  att.setFrozenRows(1);

  var ev = ss.getSheetByName(SHEET_EVENTS) || ss.insertSheet(SHEET_EVENTS);
  if (ev.getLastRow() === 0) ev.appendRow(EVENT_HEADERS);
  ev.getRange(1, 1, 1, EVENT_HEADERS.length).setFontWeight("bold");
  ev.setFrozenRows(1);

  var acc = ss.getSheetByName(SHEET_ACCESS) || ss.insertSheet(SHEET_ACCESS);
  if (acc.getLastRow() === 0) acc.appendRow(ACCESS_HEADERS);
  acc.getRange(1, 1, 1, ACCESS_HEADERS.length).setFontWeight("bold");
  acc.setFrozenRows(1);

  var fin = ss.getSheetByName(SHEET_FIN) || ss.insertSheet(SHEET_FIN);
  if (fin.getLastRow() === 0) fin.appendRow(FIN_HEADERS);
  fin.getRange(1, 1, 1, FIN_HEADERS.length).setFontWeight("bold");
  fin.setFrozenRows(1);

  // Confirmation popup only works when run from the sheet's menu; running from
  // the editor has no UI, so don't let that throw.
  try {
    var ui = SpreadsheetApp.getUi();
    ui.alert("Ready.", "Sheets are set up. Deploy as a Web app next.", ui.ButtonSet.OK);
  } catch (e) {
    Logger.log("Setup complete. Sheets are ready — deploy as a Web app next.");
  }
}

function sheetOf_(name) {
  var ss = SpreadsheetApp.getActive();
  var s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name);
    if (name === SHEET_SIGNUPS) s.appendRow(HEADERS);
    else if (name === SHEET_ATT) s.appendRow(ATT_HEADERS);
    else if (name === SHEET_EVENTS) s.appendRow(EVENT_HEADERS);
    else if (name === SHEET_ACCESS) s.appendRow(ACCESS_HEADERS);
    else if (name === SHEET_FIN) s.appendRow(FIN_HEADERS); }
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
