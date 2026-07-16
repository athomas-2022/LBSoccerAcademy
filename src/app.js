/* ============================================================
   THE LB SOCCER ACADEMY — Coach's Dashboard logic
   Vanilla, localStorage-backed, file://-friendly.
   ============================================================ */
(function () {
  "use strict";
  var LB = window.LBSA;
  var KEY = "lbsa.dashboard.v1";
  var CONTACT_EMAIL = "athomas@Liberty-Benton.org";   // sender / reply-to for family emails
  // Remind is the primary channel. Paste your Remind class link here (the page
  // where you compose/send) so "Message families" opens straight to it.
  var REMIND_URL = "https://www.remind.com/";
  // Connect website sign-ups to this dashboard: paste your Google Apps Script
  // web-app URL (the same /exec URL used for the sign-up form). "Sync sign-ups"
  // then pulls new sign-ups straight into Athletes. Leave "" to disable.
  var SIGNUPS_URL = "https://script.google.com/macros/s/AKfycby68vlCB8FhoyOk03A5Yam4f1Vhwumm8rqSPz8bAw26Tk2UUH1mLwwy0MvnLl7-YQD5/exec";
  // Shared Google Calendar ID (the calendar events post to and parents subscribe
  // to). Looks like "...@group.calendar.google.com". Paste the SAME id into the
  // Apps Script CONFIG.CALENDAR_ID and public/app.js GOOGLE_CALENDAR_ID. Leave ""
  // to skip the "View shared calendar" link (events still save + sync).
  var CALENDAR_ID = "c_a280d4cafbf4f9838c8141178df7d56c29221939f94bf2b1810d6c5426f8490c@group.calendar.google.com";
  // Sign-in gate: only approved Google accounts can open the dashboard or reach
  // its data. Create a free OAuth Client ID (Google Cloud Console ▸ Credentials ▸
  // OAuth client ID ▸ Web application), add https://athomas-2022.github.io as an
  // Authorized JavaScript origin, and paste the "...apps.googleusercontent.com"
  // id here AND into the Apps Script CONFIG.CLIENT_ID. Leave "" to disable the
  // gate (open access — only while you finish setup).
  var GOOGLE_CLIENT_ID = "272844850821-4li2sup0s44gvasaub514d5qbg9nfq5p.apps.googleusercontent.com";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); };
  var money = function (n) { return "$" + Number(n || 0).toLocaleString("en-US"); };

  var SETTINGS_DEFAULT = { districtAthletes: 240, openingBalance: 0 };
  var SPONSOR_GOAL = 3000;

  // ---- state -------------------------------------------------------
  var state, ui = { view: "overview", prog: "all", search: "", status: "all", grad: "all", attDate: "", attEvent: "", present: {} };

  var FIN_CATS = {
    in: ["Sponsorship", "Donation", "Grant", "Fundraiser", "Registration/fees", "Refund received", "Interest", "Other income"],
    out: ["Equipment & balls", "Uniforms & kit", "Field/facility rental", "Referees", "Insurance",
      "Marketing/printing", "Website/software/domain", "Trophies & awards", "Food & water", "Travel",
      "Scholarships/aid", "Bank & processing fees", "Supplies", "Other expense"]
  };
  var FIN_METHODS = ["Cash", "Check", "Card", "Bank transfer", "Online (PayPal/Venmo)", "In-kind (no cash)", "Other"];
  var FIN_INKIND = "In-kind (no cash)";

  function blank() { return { athletes: [], sponsors: [], phasesDone: [], sessions: [], events: [], finances: [], settings: Object.assign({}, SETTINGS_DEFAULT), seeded: false }; }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) { var d = JSON.parse(raw);
      d.settings = Object.assign({}, SETTINGS_DEFAULT, d.settings || {}); d.athletes = d.athletes || [];
      d.sponsors = d.sponsors || []; d.phasesDone = d.phasesDone || []; d.sessions = d.sessions || []; d.events = d.events || []; d.finances = d.finances || []; return d; } }
    catch (e) {}
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function uid(p) { return (p || "x") + "-" + Math.abs((Date.now() ^ (idSeed++ * 2654435761)) >>> 0).toString(36); }
  var idSeed = 1;

  state = load();

  // ================================================================
  //  AUTH GATE — Google Sign-In + approved-email allowlist
  // ================================================================
  var AUTH = { token: "", email: "", name: "", owner: false, enabled: !!GOOGLE_CLIENT_ID, ready: false };
  function authToken() { return AUTH.token || ""; }
  function apiGet(extra) {
    var url = SIGNUPS_URL + "?token=" + encodeURIComponent(authToken()) + (extra || "");
    return fetch(url, { method: "GET" }).then(function (r) { return r.json(); });
  }
  function apiPost(body) {
    body = body || {}; body.token = authToken();
    return fetch(SIGNUPS_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body) });
  }
  function b64url(s) { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    try { return decodeURIComponent(escape(atob(s))); } catch (e) { try { return atob(s); } catch (e2) { return ""; } } }
  function decodeJwt(t) { try { return JSON.parse(b64url(String(t).split(".")[1])); } catch (e) { return null; } }

  function gateMsg(m) { var el = $("#authMsg"); if (el) el.textContent = m; }
  function showGate() { var g = $("#authGate"); if (g) g.style.display = "flex"; document.body.classList.remove("is-authed"); }
  function hideGate() { document.body.classList.add("is-authed"); var g = $("#authGate"); if (g) g.style.display = "none"; }
  function showPending(email) {
    $("#authBtn").hidden = true; $("#authPending").hidden = false;
    $("#authEmail").textContent = email || AUTH.email || "This account";
    gateMsg("Signed in, but not approved yet.");
  }
  function relock(msg) { if (!AUTH.enabled) return; AUTH.ready = false; showGate(); renderSignIn(); if (msg) gateMsg(msg); }

  function initAuth() {
    if (!AUTH.enabled) { hideGate(); AUTH.ready = true; runBootSyncs(); return; }  // gate not configured yet
    showGate(); gateMsg("Checking sign-in…");
    var stored = null; try { stored = sessionStorage.getItem("lbsa.idtoken"); } catch (e) {}
    if (stored) { var p = decodeJwt(stored);
      if (p && p.exp * 1000 > Date.now() + 60000) { AUTH.token = stored; AUTH.email = p.email || ""; AUTH.name = p.name || p.email || ""; verifyAccess(); return; } }
    renderSignIn();
  }
  function renderSignIn() {
    $("#authPending").hidden = true; $("#authBtn").hidden = false;
    var host = $("#authBtn"); host.innerHTML = "";
    if (!(window.google && google.accounts && google.accounts.id)) { gateMsg("Loading Google sign-in…"); setTimeout(renderSignIn, 400); return; }
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onCredential, auto_select: false });
    google.accounts.id.renderButton(host, { theme: "filled_blue", size: "large", text: "signin_with", shape: "pill", width: 260 });
    gateMsg("Sign in with an approved Google account.");
  }
  function onCredential(resp) {
    var t = resp && resp.credential; if (!t) return;
    var p = decodeJwt(t); AUTH.token = t; AUTH.email = (p && p.email) || ""; AUTH.name = (p && p.name) || AUTH.email;
    try { sessionStorage.setItem("lbsa.idtoken", t); } catch (e) {}
    gateMsg("Checking access…"); verifyAccess();
  }
  function verifyAccess() {
    apiGet("&check=1").then(function (data) {
      if (data && data.ok && data.approved) { AUTH.owner = !!data.owner; hideGate(); AUTH.ready = true; renderIdentity(); runBootSyncs(); }
      else if (data && data.error === "pending") { showPending(data.email); }
      else { try { sessionStorage.removeItem("lbsa.idtoken"); } catch (e) {} AUTH.token = ""; renderSignIn(); gateMsg("Sign-in expired or invalid — please sign in again."); }
    }).catch(function () { gateMsg("Couldn't reach the server — check your connection and retry."); setTimeout(function () { if (!AUTH.ready) renderSignIn(); }, 2500); });
  }
  function signOut() {
    try { sessionStorage.removeItem("lbsa.idtoken"); } catch (e) {}
    AUTH.token = ""; AUTH.email = ""; AUTH.owner = false; AUTH.ready = false;
    try { google.accounts.id.disableAutoSelect(); } catch (e) {}
    renderIdentity(); showGate(); renderSignIn();
  }
  function renderIdentity() {
    var foot = $("#authFoot"); if (!foot) return;
    if (!AUTH.enabled || !AUTH.email) { foot.hidden = true; foot.innerHTML = ""; return; }
    foot.hidden = false;
    foot.innerHTML = '<div class="side__who"><span class="side__whoname">' + esc(AUTH.name || AUTH.email) + '</span>' +
      '<span class="side__whomail">' + esc(AUTH.email) + (AUTH.owner ? " · owner" : "") + '</span></div>' +
      '<div class="side__authbtns">' +
        (AUTH.owner ? '<button class="side__authbtn" data-action="manage-access">Manage access</button>' : "") +
        '<button class="side__authbtn" data-action="sign-out">Sign out</button>' +
      '</div>';
  }
  function runBootSyncs() { if (SIGNUPS_URL) { syncSignups(true); syncEvents(true); syncFinances(true); } }

  // ---- approve / remove people (owners only) ----
  function openAccess() {
    if (!AUTH.owner) { toast("Owners only."); return; }
    showDrawer("Team access", '<div id="accessBody" class="access-body">Loading…</div>');
    refreshAccess();
  }
  function refreshAccess() {
    apiGet().then(function (data) {
      var b = $("#accessBody"); if (!b) return;
      if (!data || !data.ok || !data.owner) { b.innerHTML = '<p class="cast-note">Only owners can manage access.</p>'; return; }
      renderAccessBody(data.access || [], data.owners || []);
    }).catch(function () { var b = $("#accessBody"); if (b) b.innerHTML = '<p class="cast-note">Couldn\'t load the list — retry.</p>'; });
  }
  function renderAccessBody(list, owners) {
    var b = $("#accessBody"); if (!b) return;
    var ownerRows = owners.map(function (e) {
      return '<li class="acc-row"><span class="acc-mail">' + esc(e) + '</span><span class="acc-tag">owner</span></li>'; }).join("");
    var rows = list.map(function (x) {
      var email = x.email || x;
      return '<li class="acc-row"><span class="acc-mail">' + esc(email) + (x.name ? ' <i>' + esc(x.name) + '</i>' : "") + '</span>' +
        '<button class="acc-rm" data-accrm="' + esc(email) + '">Remove</button></li>'; }).join("");
    b.innerHTML =
      '<p class="cast-note">Approved people can sign in and use the dashboard. Owners are set in config and can\'t be removed here.</p>' +
      '<ul class="acc-list">' + ownerRows + rows + (list.length ? "" : '<li class="acc-empty">No one else approved yet.</li>') + '</ul>' +
      '<form id="accAdd" class="acc-add">' +
        '<input id="acc-email" type="email" placeholder="name@email.com" required>' +
        '<input id="acc-name" placeholder="Name (optional)">' +
        '<button class="btn btn--primary btn--sm" type="submit">Approve</button>' +
      '</form>' +
      '<p class="cast-hint">They sign in with that exact Google account. Changes take effect next time they load the page.</p>';
    var f = $("#accAdd");
    if (f) f.addEventListener("submit", function (e) { e.preventDefault();
      var email = $("#acc-email").value.trim().toLowerCase(); if (!email || email.indexOf("@") < 1) { $("#acc-email").focus(); return; }
      apiPost({ type: "access-add", email: email, name: $("#acc-name").value.trim() });
      toast("Approved " + email + "."); b.innerHTML = "Updating…"; setTimeout(refreshAccess, 900);
    });
    b.addEventListener("click", function (e) {
      var rm = e.target.closest("[data-accrm]"); if (!rm) return;
      var email = rm.dataset.accrm;
      if (!window.confirm("Remove " + email + "'s access?")) return;
      apiPost({ type: "access-remove", email: email });
      toast("Removed " + email + "."); b.innerHTML = "Updating…"; setTimeout(refreshAccess, 900);
    });
  }

  // ---- derived -----------------------------------------------------
  function pool() {
    return state.athletes.filter(function (a) { return ui.prog === "all" || a.program === ui.prog; });
  }
  function numbers() {
    var all = state.athletes;
    var touched = all.filter(function (a) { return a.status !== "prospect"; });
    var active = all.filter(function (a) { return a.status === "active"; }).length;
    var atrisk = all.filter(function (a) { return a.status === "atrisk"; }).length;
    var lost = all.filter(function (a) { return a.status === "lost"; }).length;
    var t = touched.length, dist = state.settings.districtAthletes || 0;
    return {
      touched: t, active: active, atrisk: atrisk, lost: lost,
      capture: dist > 0 ? Math.round(t / dist * 100) : 0,
      retention: t > 0 ? Math.round((active + atrisk) / t * 100) : 0,
      activeShare: dist > 0 ? Math.round(active / dist * 100) : 0,
      sponsorTotal: state.sponsors.reduce(function (s, x) { return s + (Number(x.amount) || 0); }, 0),
      sponsorCount: state.sponsors.length
    };
  }
  function initials(a) { return (a.first[0] || "") + (a.last[0] || ""); }
  function statusPill(status, asButton, id) {
    var st = LB.STATUSES[status]; var cls = "pill pill--" + st.tone;
    var inner = '<span class="pdot"></span>' + esc(st.label);
    if (asButton) return '<button class="' + cls + '" data-action="status" data-id="' + id + '" title="Change status">' + inner + '</button>';
    return '<span class="' + cls + '">' + inner + '</span>';
  }

  // ================================================================
  //  TOPBAR + NAV
  // ================================================================
  var VIEW_META = {
    overview: { title: "Overview", sub: "The whole pipeline at a glance." },
    athletes: { title: "Athletes", sub: "Every athletic kid, K–8, by graduation year." },
    schedule: { title: "Schedule", sub: "Sessions & events — auto-added to the shared calendar families follow." },
    attendance: { title: "Attendance", sub: "Pick a session, tap kids in — it flows into the tracker." },
    plan: { title: "The 360-Day Plan", sub: "Twelve phases from first conversation to year two." },
    finances: { title: "Finances", sub: "Every dollar in and out, plus your sponsors." }
  };
  function renderTopbar() {
    var m = VIEW_META[ui.view];
    $("#viewTitle").textContent = m.title; $("#viewSub").textContent = m.sub;
    var slot = $("#topActions"); slot.innerHTML = "";
    if (ui.view === "overview") {
      slot.innerHTML = '<button class="btn btn--ghost" data-action="settings">Edit numbers</button>' +
        '<button class="btn btn--primary" data-action="add-athlete"><svg class="ic"><use href="#ic-plus"/></svg>Add athlete</button>';
    } else if (ui.view === "athletes") {
      slot.innerHTML = '<button class="btn btn--ghost" data-action="sync-signups">Sync sign-ups</button>' +
        '<button class="btn btn--ghost" data-action="broadcast"><svg class="ic"><use href="#ic-phone"/></svg>Message families</button>' +
        '<button class="btn btn--primary" data-action="add-athlete"><svg class="ic"><use href="#ic-plus"/></svg>Add athlete</button>';
    } else if (ui.view === "schedule") {
      slot.innerHTML = (CALENDAR_ID ? '<a class="btn btn--ghost" href="https://calendar.google.com/calendar/u/0/r?cid=' + encodeURIComponent(CALENDAR_ID) + '" target="_blank" rel="noopener">Open shared calendar</a>' : "") +
        '<button class="btn btn--primary" data-action="add-event"><svg class="ic"><use href="#ic-plus"/></svg>Add event</button>';
    } else if (ui.view === "attendance") {
      slot.innerHTML = '<button class="btn btn--primary" data-action="save-session"><svg class="ic"><use href="#ic-check"/></svg>Save session</button>';
    } else if (ui.view === "finances") {
      slot.innerHTML = '<button class="btn btn--ghost" data-action="fin-opening">Opening balance</button>' +
        '<button class="btn btn--primary" data-action="add-finance"><svg class="ic"><use href="#ic-plus"/></svg>Add transaction</button>';
    }
  }
  function setView(v) {
    ui.view = v;
    $$(".side__link").forEach(function (b) { b.setAttribute("aria-current", String(b.dataset.view === v)); });
    $$(".view").forEach(function (s) { s.classList.remove("is-active"); });
    $("#view-" + v).classList.add("is-active");
    closeSidebar();
    if (v === "attendance") { ui.presentEvent = null; if (!ui.attEvent || !eventById(ui.attEvent)) ui.attEvent = defaultAttEvent(); }
    renderTopbar(); renderView();
    if (v === "attendance") syncAttendance(true);     // pull other devices' latest
    if (v === "schedule") syncEvents(true);           // pull events other devices added
    if (v === "finances") syncFinances(true);         // pull ledger entries from other devices
    $("#view-" + v).focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  function renderView() {
    if (ui.view === "overview") renderOverview();
    else if (ui.view === "athletes") renderAthletes();
    else if (ui.view === "schedule") renderSchedule();
    else if (ui.view === "attendance") renderAttendance();
    else if (ui.view === "plan") renderPlan();
    else if (ui.view === "finances") renderFinances();
    renderNavBadge(); renderDataNote();
  }
  function renderNavBadge() {
    var n = state.athletes.filter(function (a) { return a.status === "atrisk"; }).length;
    var b = $("#navRisk"); if (n > 0) { b.hidden = false; b.textContent = n; } else b.hidden = true;
  }
  function renderDataNote() {
    var note = $("#dataNote");
    if (!state.athletes.length && !state.sponsors.length) { note.innerHTML = ""; return; }
    note.innerHTML = (state.seeded ? "Showing sample data. " : "") +
      '<button data-action="clear">Clear all data</button>';
  }

  // ================================================================
  //  OVERVIEW
  // ================================================================
  function renderOverview() {
    var n = numbers();
    var host = $("#view-overview");
    if (!state.athletes.length && !state.sponsors.length) { host.innerHTML = firstRunEmpty(); return; }

    var pct = function (v) { return Math.max(0, Math.min(100, v)); };
    var board =
      '<div class="scoreboard" role="group" aria-label="The Four Numbers">' +
        scoreCell("Capture rate", n.capture + '<small>%</small>', "touched " + n.touched + " of ~" + state.settings.districtAthletes + " kids", pct(n.capture), true) +
        scoreCell("Retention", n.retention + '<small>%</small>', n.active + " active · " + n.atrisk + " at risk", pct(n.retention), true) +
        scoreCell("Active players", String(n.active), "playing right now, K–8", pct(n.activeShare), true) +
        scoreCell("Sponsor dollars", money(n.sponsorTotal), "from " + n.sponsorCount + " sponsor" + (n.sponsorCount === 1 ? "" : "s"), pct(n.sponsorTotal / SPONSOR_GOAL * 100), false) +
      '</div>';

    var atrisk = pool().filter(function (a) { return a.status === "atrisk"; });
    var riskPanel =
      '<section class="panel panel--risk">' +
        '<div class="panel__head"><span class="risk-flag"><span class="dot"></span>Kids at risk of being lost</span>' +
          '<span class="count">' + atrisk.length + (atrisk.length === 1 ? " kid" : " kids") + '</span></div>' +
        '<div class="panel__body">' +
          (atrisk.length ? '<div class="risk-list">' + atrisk.map(riskRow).join("") + '</div>'
            : '<p style="color:var(--ink-2)">No one is slipping right now. Every identified kid is still with us. 🔵</p>') +
        '</div></section>';

    var done = state.phasesDone.length, planPct = Math.round(done / LB.PHASES.length * 100);
    var sideCol =
      '<section class="panel"><div class="panel__head"><h2>Where we stand</h2></div><div class="panel__body">' +
        '<div class="mini">' +
          miniRow("Launch plan", done + " / " + LB.PHASES.length + " phases", planPct, false) +
          miniRow("Capture rate", n.capture + "%", n.capture, false) +
          miniRow("Retention", n.retention + "%", n.retention, false) +
          miniRow("At risk", n.atrisk + " of " + n.touched, n.touched ? Math.round(n.atrisk / n.touched * 100) : 0, true) +
          miniRow("Sponsor goal", money(n.sponsorTotal) + " / " + money(SPONSOR_GOAL), Math.min(100, Math.round(n.sponsorTotal / SPONSOR_GOAL * 100)), false) +
        '</div></div></section>';

    host.innerHTML = board + '<div class="overview-grid">' + riskPanel + sideCol + '</div>';
  }
  function scoreCell(label, num, sub, barPct, accent) {
    return '<div class="score' + (accent ? " score--accent" : "") + '">' +
      '<span class="score__label">' + esc(label) + '</span>' +
      '<span class="score__num tnum">' + num + '</span>' +
      '<span class="score__sub">' + esc(sub) + '</span>' +
      '<span class="score__bar"><i style="width:' + barPct + '%"></i></span></div>';
  }
  function miniRow(lbl, val, pct, risk) {
    return '<div class="mini__row"><span class="lbl">' + esc(lbl) + '</span>' +
      '<span class="bar"><i class="' + (risk ? "is-risk" : "") + '" style="width:' + Math.max(2, Math.min(100, pct)) + '%"></i></span>' +
      '<span class="val tnum">' + esc(val) + '</span></div>';
  }
  function riskRow(a) {
    return '<div class="risk-row">' +
      '<span class="risk-row__who">' + esc(a.first + " " + a.last) + '</span>' +
      '<span class="risk-row__meta">' + LB.GRADE_LABELS[a.grade] + " · " + esc(a.program) + '</span>' +
      '<span class="risk-row__note">' + (a.note ? esc(a.note) : '<b>Reach out — no note yet.</b>') + '</span>' +
      '<button class="btn btn--sm btn--ghost" data-action="edit" data-id="' + a.id + '">Open</button>' +
      '<button class="btn btn--sm btn--primary" data-action="reached" data-id="' + a.id + '">Mark active</button>' +
      '</div>';
  }
  function firstRunEmpty() {
    return '<div class="empty">' +
      '<img src="assets/logos/Eagle Head.png" alt="" />' +
      '<h3>Let’s build the map.</h3>' +
      '<p>Every athletic kid in the district matters — today’s second-grader is tomorrow’s varsity. Start by adding the kids you know, or load a sample roster to see how it works.</p>' +
      '<div class="empty__actions">' +
        '<button class="btn btn--primary" data-action="add-athlete"><svg class="ic"><use href="#ic-plus"/></svg>Add your first athlete</button>' +
        '<button class="btn btn--ghost" data-action="load-sample">Explore with sample data</button>' +
      '</div></div>';
  }

  // ================================================================
  //  ATHLETES
  // ================================================================
  function filteredAthletes() {
    var q = ui.search.trim().toLowerCase();
    return pool().filter(function (a) {
      if (ui.status !== "all" && a.status !== ui.status) return false;
      if (ui.grad !== "all" && String(a.gradYear) !== ui.grad) return false;
      if (q) { var hay = (a.first + " " + a.last + " " + (a.sports || []).join(" ") + " " + a.note).toLowerCase();
        if (hay.indexOf(q) === -1) return false; }
      return true;
    }).sort(function (x, y) { return x.gradYear - y.gradYear || x.last.localeCompare(y.last); });
  }
  function renderAthletes() {
    var host = $("#view-athletes");
    if (!state.athletes.length) {
      host.innerHTML = '<div class="empty"><img src="assets/logos/Eagle Head.png" alt="" />' +
        '<h3>No athletes yet.</h3><p>Map every athletic kid K–8 — including the fast basketball kid who’s never touched a soccer ball. A future center back or keeper.</p>' +
        '<div class="empty__actions"><button class="btn btn--primary" data-action="add-athlete"><svg class="ic"><use href="#ic-plus"/></svg>Add an athlete</button>' +
        '<button class="btn btn--ghost" data-action="load-sample">Load sample roster</button></div></div>';
      return;
    }
    var list = filteredAthletes();
    // grad-year map (respects program filter, ignores status/search so the map stays whole)
    var byYear = {};
    pool().forEach(function (a) { (byYear[a.gradYear] = byYear[a.gradYear] || []).push(a); });
    var years = Object.keys(byYear).sort();
    var map = '<div class="gymap">' + years.map(function (y) {
      var arr = byYear[y]; var c = { active: 0, atrisk: 0, prospect: 0, lost: 0 };
      arr.forEach(function (a) { c[a.status]++; });
      var g = LB.GRADE_LABELS[arr[0].grade];
      var seg = function (k) { return c[k] ? '<i class="s-' + k + '" style="flex:' + c[k] + '" title="' + c[k] + ' ' + k + '"></i>' : ""; };
      return '<button class="gycol" data-action="filter-grad" data-grad="' + y + '"' + (ui.grad === y ? ' style="border-color:var(--accent)"' : "") + '>' +
        '<div class="gycol__yr tnum">’' + String(y).slice(2) + '</div><div class="gycol__grade">Class of ' + y + '</div>' +
        '<div class="gycol__stack">' + seg("active") + seg("atrisk") + seg("prospect") + seg("lost") + '</div>' +
        '<div class="gycol__n tnum">' + arr.length + (arr.length === 1 ? " kid" : " kids") + '</div></button>';
    }).join("") + '</div>';

    var chip = function (val, label, cls) {
      return '<button class="chip ' + (cls || "") + '" data-action="filter-status" data-status="' + val + '" aria-pressed="' + (ui.status === val) + '">' + esc(label) + '</button>';
    };
    var toolbar = '<div class="toolbar">' +
      '<div class="search"><svg class="ic"><use href="#ic-search"/></svg>' +
      '<input type="search" id="athSearch" placeholder="Search name, sport, note…" value="' + esc(ui.search) + '" aria-label="Search athletes"></div>' +
      '<div class="filterset">' + chip("all", "All") + chip("active", "Active") +
        chip("atrisk", "At risk", "chip--risk") + chip("prospect", "Prospects") + chip("lost", "Lost") +
        (ui.grad !== "all" ? '<button class="chip" data-action="filter-grad" data-grad="all" aria-pressed="true">Class of ' + ui.grad + ' ✕</button>' : "") +
      '</div></div>';

    var rows = list.map(function (a) {
      return '<tr data-action="edit" data-id="' + a.id + '"' + (a.status === "atrisk" ? ' class="is-risk"' : "") + '>' +
        '<td><div class="who"><span class="avatar ' + (a.program === "Girls" ? "g" : "") + '">' + esc(initials(a)) + '</span>' +
          '<span><button type="button" class="who__name" data-action="edit" data-id="' + a.id + '">' + esc(a.first + " " + a.last) + '</button>' +
          (a.sports && a.sports.length ? '<span class="who__sports">' + esc(a.sports.join(", ")) + '</span>' : "") + seenChip(a) + '</span></div></td>' +
        '<td class="tnum">' + LB.GRADE_LABELS[a.grade] + '</td>' +
        '<td class="tnum">' + a.gradYear + '</td>' +
        '<td><span class="prog-tag ' + (a.program === "Girls" ? "g" : "b") + '">' + esc(a.program) + '</span></td>' +
        '<td>' + statusPill(a.status, true, a.id) + '</td>' +
        '</tr>';
    }).join("");

    var table = list.length
      ? '<div class="tablewrap"><table class="roster"><thead><tr>' +
          '<th>Athlete</th><th>Grade</th><th>Class of</th><th>Program</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="empty"><h3>No matches.</h3><p>No athletes fit these filters. Try clearing them.</p>' +
        '<div class="empty__actions"><button class="btn btn--ghost" data-action="clear-filters">Clear filters</button></div></div>';

    host.innerHTML = map + toolbar + table;
    var s = $("#athSearch");
    if (s) s.addEventListener("input", function () { ui.search = this.value; var pos = this.selectionStart;
      renderAthletes(); var s2 = $("#athSearch"); if (s2) { s2.focus(); try { s2.setSelectionRange(pos, pos); } catch (e) {} } });
  }

  // ================================================================
  //  ATTENDANCE  (tap kids in each session -> drives retention)
  //  Synced through the Google Sheet so phone + laptop match.
  //  Sessions store PRESENT as device-stable keys (name|gradYear),
  //  not local ids, so they map across devices.
  // ================================================================
  var ATT_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function athKey(a) { return (a.first + " " + a.last).trim().toLowerCase() + "|" + a.gradYear; }
  function athleteByKey(k) { for (var i = 0; i < state.athletes.length; i++) if (athKey(state.athletes[i]) === k) return state.athletes[i]; return null; }
  function fmtDate(d) { var x = new Date(d + "T00:00:00"); return isNaN(x) ? d : ATT_MON[x.getMonth()] + " " + x.getDate(); }
  function daysAgo(d) { var a = new Date(d + "T00:00:00"), b = new Date(today() + "T00:00:00"); return Math.round((b - a) / 86400000); }
  // ================================================================
  //  SCHEDULE / EVENTS
  // ================================================================
  var WK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function fmtDateFull(d) { var x = new Date(d + "T00:00:00"); return isNaN(x) ? d : WK[x.getDay()] + ", " + fmtDate(d); }
  function fmtTime(t) {
    if (!t) return ""; var p = String(t).split(":"); var h = parseInt(p[0], 10), m = p[1] || "00";
    if (isNaN(h)) return ""; var ap = h < 12 ? "AM" : "PM"; var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + (m === "00" ? "" : ":" + m) + " " + ap;
  }
  function eventWhen(e) {
    var t = e.start ? (fmtTime(e.start) + (e.end ? "–" + fmtTime(e.end) : "")) : "";
    return fmtDateFull(e.date) + (t ? " · " + t : "");
  }
  function tierName(k) { for (var i = 0; i < LB.TIERS.length; i++) if (LB.TIERS[i].key === k) return LB.TIERS[i].name; return ""; }
  function eventsSorted() { return state.events.slice().sort(function (a, b) { return (a.date + (a.start || "")).localeCompare(b.date + (b.start || "")); }); }
  function eventById(id) { for (var i = 0; i < state.events.length; i++) if (state.events[i].id === id) return state.events[i]; return null; }
  function defaultAttEvent() {
    var evs = eventsSorted(); if (!evs.length) return "";
    var td = today();
    var todays = evs.filter(function (e) { return e.date === td; }); if (todays.length) return todays[0].id;
    var up = evs.filter(function (e) { return e.date > td; }); if (up.length) return up[0].id;
    return evs[evs.length - 1].id;
  }

  function renderSchedule() {
    var host = $("#view-schedule");
    var calNote = CALENDAR_ID
      ? '<p class="sched-note">Every event is added to your shared Google Calendar — families who tapped “Add to calendar” see it, and any change, automatically.</p>'
      : '<p class="sched-note sched-note--off">Events save and sync across your devices. To also push them to a calendar families can subscribe to, connect a shared Google Calendar (see setup).</p>';
    if (!state.events.length) {
      host.innerHTML = calNote + '<div class="empty"><img src="assets/logos/Eagle Head.png" alt="" />' +
        '<h3>No events yet.</h3><p>Add your first session — practices, game nights, Youth Nights. You’ll take attendance against these.</p>' +
        '<div class="empty__actions"><button class="btn btn--primary" data-action="add-event"><svg class="ic"><use href="#ic-plus"/></svg>Add an event</button></div></div>';
      return;
    }
    var td = today(), evs = eventsSorted();
    var upcoming = evs.filter(function (e) { return e.date >= td; });
    var past = evs.filter(function (e) { return e.date < td; }).reverse();
    function card(e) {
      var att = sessionForEvent(e.id);
      var chips = '<span class="ev-chip ev-chip--prog">' + esc(e.program || "All") + '</span>' +
        (e.tier ? '<span class="ev-chip">' + esc(tierName(e.tier)) + '</span>' : "") +
        (att ? '<span class="ev-chip ev-chip--done"><svg class="ic"><use href="#ic-check"/></svg>' + att.present.length + ' present</span>' : "");
      return '<div class="ev-card">' +
        '<div class="ev-card__main">' +
          '<div class="ev-when">' + esc(eventWhen(e)) + '</div>' +
          '<h3 class="ev-title">' + esc(e.title) + '</h3>' +
          (e.location ? '<div class="ev-loc">' + esc(e.location) + '</div>' : "") +
          '<div class="ev-chips">' + chips + '</div>' +
          (e.note ? '<p class="ev-note">' + esc(e.note) + '</p>' : "") +
        '</div>' +
        '<div class="ev-card__actions">' +
          '<button class="btn btn--primary btn--sm" data-action="take-attendance" data-id="' + e.id + '"><svg class="ic"><use href="#ic-attend"/></svg>Attendance</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="edit-event" data-id="' + e.id + '">Edit</button>' +
        '</div></div>';
    }
    var html = calNote;
    if (upcoming.length) html += '<div class="sched-group"><h3 class="sched-h">Upcoming</h3>' + upcoming.map(card).join("") + '</div>';
    if (past.length) html += '<div class="sched-group"><h3 class="sched-h">Past</h3>' + past.map(card).join("") + '</div>';
    host.innerHTML = html;
  }

  function eventForm(e) {
    e = e || {};
    var prog = e.program || "All";
    var tierOpts = '<option value="">All ages / mixed</option>' + LB.TIERS.map(function (t) {
      return '<option value="' + t.key + '"' + (e.tier === t.key ? " selected" : "") + '>' + esc(t.name) + ' (' + esc(t.grades) + ')</option>'; }).join("");
    return '<form id="evForm">' +
      '<div class="field"><label for="e-title">Event name</label><input id="e-title" value="' + esc(e.title || "") + '" placeholder="Grassroot session, Youth Night…" required></div>' +
      '<div class="field"><label for="e-date">Date</label><input id="e-date" type="date" value="' + esc(e.date || today()) + '" required></div>' +
      '<div class="field--row">' +
        '<div class="field"><label for="e-start">Start time</label><input id="e-start" type="time" value="' + esc(e.start || "") + '"></div>' +
        '<div class="field"><label for="e-end">End time</label><input id="e-end" type="time" value="' + esc(e.end || "") + '"></div>' +
      '</div>' +
      '<div class="field"><label for="e-loc">Location</label><input id="e-loc" value="' + esc(e.location || "") + '" placeholder="LB practice fields"></div>' +
      '<div class="field"><label>Who it\'s for</label><div class="segfield">' +
        ["All", "Boys", "Girls"].map(function (p) { return '<label><input type="radio" name="e-prog" value="' + p + '"' + (prog === p ? " checked" : "") + '><span>' + p + '</span></label>'; }).join("") +
      '</div></div>' +
      '<div class="field"><label for="e-tier">Age group</label><select id="e-tier">' + tierOpts + '</select></div>' +
      '<div class="field"><label for="e-note">Note <span style="font-weight:500;color:var(--ink-3)">(optional)</span></label>' +
        '<textarea id="e-note" placeholder="Bring water · indoor if it rains…">' + esc(e.note || "") + '</textarea></div>' +
      '<div class="drawer__foot">' +
        (e.id ? '<button type="button" class="btn btn--danger" data-action="delete-event" data-id="' + e.id + '">Delete</button>' : "") +
        '<button type="submit" class="btn btn--primary">' + (e.id ? "Save event" : "Add event") + '</button>' +
      '</div></form>';
  }
  function openEvent(e) {
    showDrawer(e ? "Edit event" : "Add event", eventForm(e));
    $("#evForm").addEventListener("submit", function (sub) {
      sub.preventDefault();
      var title = $("#e-title").value.trim(), date = $("#e-date").value;
      $("#e-title").closest(".field").classList.toggle("field--invalid", !title);
      $("#e-date").closest(".field").classList.toggle("field--invalid", !date);
      if (!title || !date) { $(!title ? "#e-title" : "#e-date").focus(); return; }
      var data = { title: title, date: date, start: $("#e-start").value || "", end: $("#e-end").value || "",
        location: $("#e-loc").value.trim(),
        program: (document.querySelector('input[name="e-prog"]:checked') || {}).value || "All",
        tier: $("#e-tier").value || "", note: $("#e-note").value.trim(),
        updated: new Date().toISOString(), unsynced: true };
      var rec;
      if (e && e.id) { var idx = state.events.findIndex(function (x) { return x.id === e.id; });
        rec = Object.assign({}, e, data); state.events[idx] = rec; toast("Saved “" + title + ".”"); }
      else { data.id = uid("ev"); data.calId = ""; rec = data; state.events.push(rec); toast("Added “" + title + ".”"); }
      save(); pushEvent(rec); hideDrawer(); renderView();
    });
  }
  function deleteEvent(id) {
    var e = eventById(id); if (!e) return;
    if (!window.confirm("Delete “" + e.title + "”? This also removes its attendance and its calendar entry.")) return;
    state.events = state.events.filter(function (x) { return x.id !== id; });
    state.sessions = state.sessions.filter(function (s) { return s.eventId !== id; });
    if (ui.attEvent === id) ui.attEvent = defaultAttEvent();
    save(); pushEventDelete(e); hideDrawer(); renderView(); toast("Event removed.");
  }

  // ---- events cross-device + calendar sync via the Sheet/Apps Script ----
  function pushEvent(e) {
    if (!SIGNUPS_URL || !e) return;
    apiPost({ type: "event", id: e.id, title: e.title, date: e.date, start: e.start, end: e.end,
      location: e.location, program: e.program, tier: e.tier, note: e.note, updated: e.updated })
      .then(function () { delete e.unsynced; save(); }).catch(function () {});
  }
  function pushEventDelete(e) {
    if (!SIGNUPS_URL || !e) return;
    apiPost({ type: "event-delete", id: e.id }).catch(function () {});
  }
  function syncEvents(quiet) {
    if (!SIGNUPS_URL || (AUTH.enabled && !AUTH.ready)) return;
    state.events.forEach(function (e) { if (e.unsynced) pushEvent(e); });
    apiGet().then(function (data) {
      if (data && data.error === "auth") { relock("Session expired — sign in again."); return; }
      if (!data || !data.events) return;
      var byId = {}; state.events.forEach(function (e) { byId[e.id] = e; });
      data.events.forEach(function (row) {
        if (!row.id) return;
        var local = byId[row.id];
        var remote = { id: row.id, title: row.title, date: String(row.date), start: row.start || "", end: row.end || "",
          location: row.location || "", program: row.program || "All", tier: row.tier || "", note: row.note || "",
          calId: row.calId || "", updated: String(row.updated || "") };
        if (!local) byId[row.id] = remote;
        else if (!local.unsynced && String(remote.updated) >= String(local.updated || "")) byId[row.id] = Object.assign(local, remote);
      });
      state.events = Object.keys(byId).map(function (id) { return byId[id]; });
      save();
      if (ui.view === "schedule") renderView();
      if (ui.view === "attendance" && (!ui.attEvent || !eventById(ui.attEvent))) { ui.attEvent = defaultAttEvent(); renderView(); }
    }).catch(function () {});
  }

  function sessionsSorted() { return state.sessions.slice().sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); }); }
  function sessionForEvent(id) { for (var i = 0; i < state.sessions.length; i++) if (state.sessions[i].eventId === id) return state.sessions[i]; return null; }
  function lastSeenOf(k) { var best = null; state.sessions.forEach(function (s) {
    if (s.present.indexOf(k) > -1 && (!best || s.date > best)) best = s.date; }); return best; }
  function attendedCount(k) { var n = 0; state.sessions.forEach(function (s) { if (s.present.indexOf(k) > -1) n++; }); return n; }
  function seenLabel(k) { var d = lastSeenOf(k); if (!d) return ""; var n = daysAgo(d);
    return n <= 0 ? "today" : (n === 1 ? "yesterday" : n + "d ago"); }
  function seenChip(a) {
    if (!state.sessions.length) return "";
    var k = athKey(a), d = lastSeenOf(k);
    if (!d) return '<span class="who__seen who__seen--none">not yet at a session</span>';
    return '<span class="who__seen">Last seen ' + seenLabel(k) + ' · ' + attendedCount(k) + ' session' + (attendedCount(k) === 1 ? "" : "s") + '</span>';
  }

  function loadPresent(eventId) { var s = sessionForEvent(eventId); ui.present = {};
    if (s) s.present.forEach(function (k) { ui.present[k] = 1; }); ui.presentEvent = eventId; ui.attDirty = false; }
  function attRoster(ev) {
    return state.athletes.filter(function (a) {
      return ev.program === "Boys" ? a.program === "Boys" : ev.program === "Girls" ? a.program === "Girls" : true;
    }).sort(function (a, b) { return a.grade - b.grade || a.last.localeCompare(b.last); });
  }

  function renderAttendance() {
    var host = $("#view-attendance");
    if (!state.athletes.length) {
      host.innerHTML = '<div class="empty"><img src="assets/logos/Eagle Head.png" alt="" />' +
        '<h3>No roster yet.</h3><p>Add athletes or sync sign-ups first, then tap kids in here each session.</p>' +
        '<div class="empty__actions"><button class="btn btn--primary" data-action="add-athlete"><svg class="ic"><use href="#ic-plus"/></svg>Add an athlete</button>' +
        '<button class="btn btn--ghost" data-action="load-sample">Load sample roster</button></div></div>';
      return;
    }
    if (!state.events.length) {
      host.innerHTML = '<div class="empty"><img src="assets/logos/Eagle Head.png" alt="" />' +
        '<h3>No sessions to take.</h3><p>Add an event on the <b>Schedule</b> first — practices, game nights — then tap kids in against it here.</p>' +
        '<div class="empty__actions"><button class="btn btn--primary" data-action="add-event"><svg class="ic"><use href="#ic-plus"/></svg>Add an event</button></div></div>';
      return;
    }
    if (!ui.attEvent || !eventById(ui.attEvent)) ui.attEvent = defaultAttEvent();
    var ev = eventById(ui.attEvent);
    if (ui.presentEvent !== ui.attEvent) loadPresent(ui.attEvent);

    var list = attRoster(ev);
    var presentCount = list.filter(function (a) { return ui.present[athKey(a)]; }).length;
    var syncNote = SIGNUPS_URL ? '<span class="att-sync">Syncs to all your devices</span>' : '<span class="att-sync att-sync--off">This device only — connect the Sheet to sync</span>';

    var options = eventsSorted().map(function (e) {
      return '<option value="' + e.id + '"' + (e.id === ui.attEvent ? " selected" : "") + '>' + esc(fmtDate(e.date) + " · " + e.title) + '</option>'; }).join("");

    var head = '<div class="att-head">' +
      '<div class="att-date"><label for="attEvent">Session</label>' +
        '<select id="attEvent" class="att-eventsel">' + options + '</select>' +
        '<div class="att-evwhen">' + esc(eventWhen(ev) + (ev.location ? " · " + ev.location : "")) + '</div></div>' +
      '<div class="att-count"><span><b class="tnum">' + presentCount + '</b> of ' + list.length + ' present</span>' +
        '<div class="att-quick"><button class="chip" data-action="att-all">All present</button>' +
          '<button class="chip" data-action="att-none">Clear</button></div></div>' +
    '</div>' + syncNote;

    var rows = list.map(function (a) {
      var k = athKey(a), on = !!ui.present[k], seen = seenLabel(k);
      return '<button class="att-row' + (on ? " is-on" : "") + '" data-action="att-toggle" data-key="' + esc(k) + '" aria-pressed="' + on + '">' +
        '<span class="att-check"><svg class="ic"><use href="#ic-check"/></svg></span>' +
        '<span class="avatar ' + (a.program === "Girls" ? "g" : "") + '">' + esc(initials(a)) + '</span>' +
        '<span class="att-who"><span class="att-name">' + esc(a.first + " " + a.last) + '</span>' +
          '<span class="att-meta">' + LB.GRADE_LABELS[a.grade] + " · " + esc(a.program) +
            (seen ? " · last " + seen : " · new") + '</span></span>' +
      '</button>';
    }).join("");

    var recent = sessionsSorted().filter(function (s) { return s.eventId && eventById(s.eventId); }).slice(0, 8);
    var history = recent.length ? '<div class="att-history"><h3>Recent sessions</h3><div class="att-hlist">' +
      recent.map(function (s) {
        var se = eventById(s.eventId);
        return '<button class="att-hitem' + (s.eventId === ui.attEvent ? " is-cur" : "") + '" data-action="att-load" data-id="' + s.eventId + '">' +
          '<span class="att-hdate">' + esc(fmtDate(s.date) + " · " + se.title) + '</span><span class="att-hn tnum">' + s.present.length + ' present</span></button>';
      }).join("") + '</div></div>' : "";

    host.innerHTML = head + '<div class="att-list">' + rows + '</div>' + history;
    var sel = $("#attEvent");
    if (sel) sel.addEventListener("change", function () { ui.attEvent = this.value; loadPresent(ui.attEvent); renderAttendance(); });
  }

  function updateAttCount() {
    var el = $(".att-count b"); var ev = eventById(ui.attEvent); if (!el || !ev) return;
    el.textContent = attRoster(ev).filter(function (a) { return ui.present[athKey(a)]; }).length;
  }

  function saveSession() {
    if (ui.view !== "attendance" || !state.athletes.length || !ui.attEvent) return;
    var ev = eventById(ui.attEvent); if (!ev) return;
    var present = Object.keys(ui.present);
    var s = sessionForEvent(ev.id);
    if (s) { s.present = present; } else { s = { id: uid("ses"), eventId: ev.id, date: ev.date, present: present }; state.sessions.push(s); }
    s.date = ev.date; s.updated = new Date().toISOString(); s.unsynced = true;
    ui.presentEvent = ev.id; ui.attDirty = false;
    var r = reconcileAttendance();
    save(); pushSession(s); renderView();
    var msg = present.length + " present saved for " + ev.title + ".";
    if (r.flagged) msg += " " + r.flagged + " now at-risk (missed 2).";
    else if (r.back) msg += " " + r.back + " back to active.";
    if (SIGNUPS_URL) msg += " Syncing…";
    toast(msg);
  }

  // A kid who attended before but missed the last 2 sessions -> at-risk.
  // A flagged kid who shows up again -> back to active.
  function reconcileAttendance() {
    var sorted = sessionsSorted(), flagged = 0, back = 0;
    if (sorted.length >= 2) {
      var newest = sorted[0], last2 = [sorted[0], sorted[1]];
      state.athletes.forEach(function (a) {
        var k = athKey(a);
        if (!state.sessions.some(function (s) { return s.present.indexOf(k) > -1; })) return; // never came yet
        var inNewest = newest.present.indexOf(k) > -1;
        var missedBoth = last2.every(function (s) { return s.present.indexOf(k) === -1; });
        if (a.status === "active" && missedBoth) { a.status = "atrisk"; a.updated = today(); flagged++; }
        else if (a.status === "atrisk" && inNewest) { a.status = "active"; a.updated = today(); back++; }
      });
    }
    return { flagged: flagged, back: back };
  }

  // ---- cross-device sync via the Google Sheet ----
  function pushSession(s) {
    if (!SIGNUPS_URL) return;
    var present = s.present.map(function (k) {
      var a = athleteByKey(k);
      if (a) return { name: a.first + " " + a.last, gradYear: a.gradYear, program: a.program };
      var parts = k.split("|"); return { name: parts[0], gradYear: parts[1] || "", program: "" };
    });
    var ev = eventById(s.eventId);
    apiPost({ type: "attendance", eventId: s.eventId || "", event: ev ? ev.title : "", date: s.date, updated: s.updated, present: present })
      .then(function () { delete s.unsynced; save(); }).catch(function () {});
  }

  function syncAttendance(quiet) {
    if (!SIGNUPS_URL || (AUTH.enabled && !AUTH.ready)) return;
    state.sessions.forEach(function (s) { if (s.unsynced) pushSession(s); });   // push local pending first
    apiGet().then(function (data) {
      if (data && data.error === "auth") { relock("Session expired — sign in again."); return; }
      if (!data || !data.attendance) return;
      var keyOf = function (s) { return s.eventId ? "e:" + s.eventId : "d:" + s.date; };
      var byDate = {};
      state.sessions.forEach(function (s) { byDate[keyOf(s)] = s; });            // local base
      var sheetByDate = {};
      data.attendance.forEach(function (row) {
        var k = (String(row.name) + "|" + row.gradYear).trim().toLowerCase();
        var eid = row.eventId || "";
        var d = eid ? "e:" + eid : "d:" + String(row.date);
        if (!sheetByDate[d]) sheetByDate[d] = { id: "ses-" + (eid || row.date), eventId: eid, date: String(row.date), present: [], updated: String(row.updated || "") };
        if (sheetByDate[d].present.indexOf(k) === -1) sheetByDate[d].present.push(k);
        if (String(row.updated) > sheetByDate[d].updated) sheetByDate[d].updated = String(row.updated);
      });
      Object.keys(sheetByDate).forEach(function (d) {                            // adopt sheet if newer / local missing
        var local = byDate[d];
        if (!local || String(sheetByDate[d].updated) >= String(local.updated || "")) byDate[d] = sheetByDate[d];
      });
      state.sessions = Object.keys(byDate).map(function (d) { return byDate[d]; });
      reconcileAttendance(); save();
      if (ui.view === "attendance" && !ui.attDirty) { if (!ui.attEvent || !eventById(ui.attEvent)) ui.attEvent = defaultAttEvent(); loadPresent(ui.attEvent); }
      renderView();
    }).catch(function () {});
  }

  // ================================================================
  //  PLAN
  // ================================================================
  function renderPlan() {
    var done = state.phasesDone.length, pct = Math.round(done / LB.PHASES.length * 100);
    var head = '<div class="plan-head"><div class="plan-progress">' +
      '<div class="lbl"><span>Launch progress</span><span class="tnum">' + done + " / " + LB.PHASES.length + ' phases · ' + pct + '%</span></div>' +
      '<div class="bar"><i style="width:' + Math.max(2, pct) + '%"></i></div></div></div>';
    var phases = '<div class="phases">' + LB.PHASES.map(function (p) {
      var isDone = state.phasesDone.indexOf(p.n) !== -1;
      return '<div class="phase' + (isDone ? " done" : "") + '">' +
        '<div class="phase__n tnum">' + p.n + '</div>' +
        '<div><div class="phase__days">Days ' + p.days + '</div>' +
          '<h3 class="phase__title">' + esc(p.title) + '</h3>' +
          '<p class="phase__goal">' + esc(p.goal) + '</p>' +
          '<ul class="phase__tasks">' + p.tasks.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + '</ul></div>' +
        '<div class="phase__toggle"><button class="check" data-action="toggle-phase" data-n="' + p.n + '" aria-pressed="' + isDone + '" aria-label="Mark phase ' + p.n + (isDone ? ' not done' : ' done') + '"><svg class="ic"><use href="#ic-check"/></svg></button></div>' +
        '</div>';
    }).join("") + '</div>';
    $("#view-plan").innerHTML = head + phases;
  }

  // ================================================================
  //  FINANCES — running ledger of money in / out (+ sponsors)
  // ================================================================
  function finById(id) { for (var i = 0; i < state.finances.length; i++) if (state.finances[i].id === id) return state.finances[i]; return null; }
  function finInkind(t) { return t.method === FIN_INKIND; }
  function finsSorted() {
    return state.finances.slice().sort(function (a, b) {
      return (b.date + (b.updated || "")).localeCompare(a.date + (a.updated || ""));
    });
  }
  function finScheduled(t) { return t.date > today(); }   // future-dated = not yet counted
  function finTotals() {
    var cashIn = 0, cashOut = 0, inkind = 0, schedIn = 0, schedOut = 0;
    state.finances.forEach(function (t) {
      var amt = Number(t.amount) || 0, future = finScheduled(t);
      if (finInkind(t)) { if (!future) inkind += amt; }
      else if (t.kind === "in") { if (future) schedIn += amt; else cashIn += amt; }
      else { if (future) schedOut += amt; else cashOut += amt; }
    });
    var opening = Number(state.settings.openingBalance) || 0;
    return { cashIn: cashIn, cashOut: cashOut, inkind: inkind, schedIn: schedIn, schedOut: schedOut,
      opening: opening, balance: opening + cashIn - cashOut, hasSched: (schedIn || schedOut) > 0 };
  }
  // date math for recurring transactions
  function finIso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function finAddMonths(d, m) {
    var day = d.getDate(), nd = new Date(d.getFullYear(), d.getMonth() + m, 1);
    var last = new Date(nd.getFullYear(), nd.getMonth() + 1, 0).getDate();
    nd.setDate(Math.min(day, last)); return nd;
  }
  function finAddPeriods(dateStr, freq, n) {
    var d = new Date(dateStr + "T00:00:00");
    if (freq === "weekly") d.setDate(d.getDate() + 7 * n);
    else if (freq === "biweekly") d.setDate(d.getDate() + 14 * n);
    else if (freq === "monthly") d = finAddMonths(d, n);
    else if (freq === "quarterly") d = finAddMonths(d, 3 * n);
    else if (freq === "yearly") d = finAddMonths(d, 12 * n);
    return finIso(d);
  }
  var FIN_FREQS = [["weekly", "Weekly"], ["biweekly", "Every 2 weeks"], ["monthly", "Monthly"], ["quarterly", "Quarterly"], ["yearly", "Yearly"]];
  function finFreqLabel(f) { for (var i = 0; i < FIN_FREQS.length; i++) if (FIN_FREQS[i][0] === f) return FIN_FREQS[i][1]; return ""; }
  function signed(t) { var amt = Number(t.amount) || 0; return (t.kind === "in" ? "+" : "−") + money(amt); }

  function renderFinances() {
    var host = $("#view-finances");
    var t = finTotals();
    var cards =
      '<div class="fin-cards">' +
        '<div class="fin-card fin-card--bal"><span class="fin-k">Balance</span><span class="fin-v tnum">' + (t.balance < 0 ? "−" + money(-t.balance) : money(t.balance)) + '</span>' +
          '<span class="fin-sub">' + (t.opening ? money(t.opening) + ' opening' : 'no opening balance set') + '</span></div>' +
        '<div class="fin-card fin-card--in"><span class="fin-k">Money in</span><span class="fin-v tnum">' + money(t.cashIn) + '</span></div>' +
        '<div class="fin-card fin-card--out"><span class="fin-k">Money out</span><span class="fin-v tnum">' + money(t.cashOut) + '</span></div>' +
        (t.inkind ? '<div class="fin-card fin-card--kind"><span class="fin-k">In-kind received</span><span class="fin-v tnum">' + money(t.inkind) + '</span><span class="fin-sub">non-cash value</span></div>' : "") +
      '</div>' +
      (t.hasSched ? '<p class="fin-sched-note">Scheduled (not yet in the balance): ' +
        (t.schedIn ? '<b class="u-in">+' + money(t.schedIn) + '</b> in' : "") + (t.schedIn && t.schedOut ? ' · ' : "") +
        (t.schedOut ? '<b class="u-out">−' + money(t.schedOut) + '</b> out' : "") + '</p>' : "") +
      (SIGNUPS_URL ? '<span class="att-sync">Synced to your Google Sheet ledger</span>' : '<span class="att-sync att-sync--off">This device only — connect the Sheet to sync</span>');

    if (!state.finances.length) {
      host.innerHTML = cards + '<div class="empty empty--mini"><h3>No transactions yet.</h3>' +
        '<p>Log every dollar in and out — sponsor checks, gear, field rental, printing, referees. It builds your ledger for the books and taxes.</p>' +
        '<div class="empty__actions"><button class="btn btn--primary" data-action="add-finance"><svg class="ic"><use href="#ic-plus"/></svg>Add a transaction</button></div></div>' +
        sponsorSection();
      return;
    }

    // category breakdown (expenses + income), largest first
    function breakdown(kind) {
      var by = {};
      state.finances.forEach(function (x) { if (x.kind !== kind || finInkind(x)) return; by[x.category] = (by[x.category] || 0) + (Number(x.amount) || 0); });
      var arr = Object.keys(by).map(function (c) { return { cat: c, amt: by[c] }; }).sort(function (a, b) { return b.amt - a.amt; });
      var max = arr.length ? arr[0].amt : 0;
      return arr.map(function (r) {
        return '<div class="fin-brow"><span class="fin-bcat">' + esc(r.cat) + '</span>' +
          '<span class="fin-bbar"><i style="width:' + (max ? Math.max(4, Math.round(r.amt / max * 100)) : 0) + '%"></i></span>' +
          '<span class="fin-bamt tnum">' + money(r.amt) + '</span></div>';
      }).join("");
    }
    var outBd = breakdown("out"), inBd = breakdown("in");
    var breakdownHtml = (outBd || inBd) ? '<div class="fin-breakdowns">' +
      (outBd ? '<div class="fin-bd"><h3>Where it goes</h3>' + outBd + '</div>' : "") +
      (inBd ? '<div class="fin-bd"><h3>Where it comes from</h3>' + inBd + '</div>' : "") +
    '</div>' : "";

    var filt = ui.finFilter || "all";
    var chips = '<div class="fin-filter">' + [["all", "All"], ["in", "Money in"], ["out", "Money out"]].map(function (p) {
      return '<button class="chip' + (filt === p[0] ? " is-on" : "") + '" data-action="fin-filter" data-f="' + p[0] + '"' + (filt === p[0] ? ' aria-pressed="true"' : "") + '>' + p[1] + '</button>';
    }).join("") + '</div>';

    var list = finsSorted().filter(function (x) { return filt === "all" || x.kind === filt; });
    var rows = list.map(function (x) {
      var ik = finInkind(x), sched = finScheduled(x);
      var badges = (sched ? '<span class="fin-tag fin-tag--sched">scheduled</span>' : "") +
        (x.series ? '<span class="fin-tag fin-tag--rep">↻ ' + esc(finFreqLabel(x.repeat) || "repeats") + '</span>' : "");
      return '<tr class="' + (sched ? "is-sched" : "") + '" data-action="edit-finance" data-id="' + x.id + '">' +
        '<td class="fin-date tnum">' + esc(fmtDate(x.date)) + '</td>' +
        '<td><button type="button" class="who__name" data-action="edit-finance" data-id="' + x.id + '">' + esc(x.desc || x.category) + '</button>' + badges +
          '<div class="fin-meta">' + esc(x.category) + (x.party ? ' · ' + esc(x.party) : "") + (x.method ? ' · ' + esc(x.method) : "") + '</div></td>' +
        '<td class="fin-amt ' + (ik ? "is-kind" : x.kind === "in" ? "is-in" : "is-out") + ' tnum">' + (ik ? money(Number(x.amount) || 0) + ' in-kind' : signed(x)) + '</td></tr>';
    }).join("");

    host.innerHTML = cards + breakdownHtml + chips +
      '<div class="tablewrap"><table class="roster fin-table"><thead><tr><th>Date</th><th>Transaction</th><th class="fin-amth">Amount</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>' + sponsorSection();
  }

  // Sponsors now live inside Finances — a distinct section under the ledger.
  function sponsorSection() {
    var head = '<div class="fin-sechead"><div><h2 class="fin-sech">Sponsors</h2>' +
      '<p class="fin-sechsub">Who funds “Every Kid Plays” — pledges &amp; support (separate from cash received above).</p></div>' +
      '<button class="btn btn--ghost btn--sm" data-action="add-sponsor"><svg class="ic"><use href="#ic-plus"/></svg>Add sponsor</button></div>';
    var total = state.sponsors.reduce(function (s, x) { return s + (Number(x.amount) || 0); }, 0);
    var summary = '<div class="spon-summary"><div class="spon-total">' +
      '<div class="n tnum">' + money(total) + '</div>' +
      '<div class="l">pledged from ' + state.sponsors.length + ' sponsor' + (state.sponsors.length === 1 ? "" : "s") + '</div>' +
      '<div class="goal">Goal ' + money(SPONSOR_GOAL) + ' · keeps the year free for families</div></div></div>';
    var body;
    if (!state.sponsors.length) {
      body = '<p class="fin-sechempty">No sponsors yet — add the local businesses backing the program.</p>';
    } else {
      var sorted = state.sponsors.slice().sort(function (a, b) { return (b.amount || 0) - (a.amount || 0); });
      var rows = sorted.map(function (s) {
        return '<tr data-action="edit-sponsor" data-id="' + s.id + '">' +
          '<td><button type="button" class="who__name" data-action="edit-sponsor" data-id="' + s.id + '">' + esc(s.name) + '</button>' +
            (s.note ? '<div class="who__sports" style="text-transform:none;font-weight:500">' + esc(s.note) + '</div>' : "") + '</td>' +
          '<td class="tnum" style="font-weight:700">' + (s.amount ? money(s.amount) : "In-kind") + '</td></tr>';
      }).join("");
      body = '<div class="tablewrap"><table class="roster"><thead><tr><th>Sponsor</th><th>Amount</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    return '<div class="fin-sponsors">' + head + summary + body + '</div>';
  }

  function financeForm(x) {
    x = x || {};
    var kind = x.kind || "out";
    function cats(k) { return FIN_CATS[k].map(function (c) { return '<option value="' + esc(c) + '"' + (x.category === c ? " selected" : "") + '>' + esc(c) + '</option>'; }).join(""); }
    var methods = FIN_METHODS.map(function (m) { return '<option value="' + esc(m) + '"' + (x.method === m ? " selected" : "") + '>' + esc(m) + '</option>'; }).join("");
    return '<form id="finForm">' +
      '<div class="field"><label>Type</label><div class="segfield">' +
        '<label><input type="radio" name="f-kind" value="out"' + (kind !== "in" ? " checked" : "") + '><span>Money out</span></label>' +
        '<label><input type="radio" name="f-kind" value="in"' + (kind === "in" ? " checked" : "") + '><span>Money in</span></label>' +
      '</div></div>' +
      '<div class="field--row">' +
        '<div class="field"><label for="f-amt">Amount</label><input id="f-amt" type="number" min="0" step="0.01" value="' + (x.amount != null ? x.amount : "") + '" placeholder="0.00" required></div>' +
        '<div class="field"><label for="f-date">Date</label><input id="f-date" type="date" value="' + esc(x.date || today()) + '" required></div>' +
      '</div>' +
      '<div class="field"><label for="f-cat">Category</label>' +
        '<select id="f-cat-out"' + (kind === "in" ? ' hidden' : '') + '>' + cats("out") + '</select>' +
        '<select id="f-cat-in"' + (kind === "in" ? '' : ' hidden') + '>' + cats("in") + '</select></div>' +
      '<div class="field"><label for="f-desc">Description</label><input id="f-desc" value="' + esc(x.desc || "") + '" placeholder="20 size-4 balls, field rental, sponsor check…"></div>' +
      '<div class="field--row">' +
        '<div class="field"><label for="f-party">Paid to / from</label><input id="f-party" value="' + esc(x.party || "") + '" placeholder="Vendor or sponsor"></div>' +
        '<div class="field"><label for="f-method">Method</label><select id="f-method">' + methods + '</select></div>' +
      '</div>' +
      '<div class="field"><label for="f-note">Note <span style="font-weight:500;color:var(--ink-3)">(optional)</span></label><textarea id="f-note" placeholder="Receipt #, reimbursed by…">' + esc(x.note || "") + '</textarea></div>' +
      (x.id ? "" :
        '<div class="field--row">' +
          '<div class="field"><label for="f-repeat">Repeat</label><select id="f-repeat"><option value="">Does not repeat</option>' +
            FIN_FREQS.map(function (f) { return '<option value="' + f[0] + '">' + f[1] + '</option>'; }).join("") + '</select></div>' +
          '<div class="field" id="f-count-wrap" hidden><label for="f-count">How many</label><input id="f-count" type="number" min="2" max="60" value="12"></div>' +
        '</div>' +
        '<p class="fin-rep-hint" id="f-rep-hint" hidden></p>') +
      '<div class="drawer__foot">' +
        (x.id ? '<button type="button" class="btn btn--danger" data-action="delete-finance" data-id="' + x.id + '">Delete</button>' : "") +
        '<button type="submit" class="btn btn--primary">' + (x.id ? "Save" : "Add transaction") + '</button>' +
      '</div></form>';
  }
  function openFinance(x) {
    showDrawer(x ? "Edit transaction" : "Add transaction", financeForm(x));
    var kindRadios = $$('input[name="f-kind"]');
    function syncCatVisibility() {
      var k = (document.querySelector('input[name="f-kind"]:checked') || {}).value || "out";
      $("#f-cat-out").hidden = k === "in"; $("#f-cat-in").hidden = k !== "in";
    }
    kindRadios.forEach(function (r) { r.addEventListener("change", syncCatVisibility); });
    var repeatSel = $("#f-repeat");
    function syncRepeat() {
      var f = repeatSel.value, wrap = $("#f-count-wrap"), hint = $("#f-rep-hint");
      wrap.hidden = !f;
      if (!f) { hint.hidden = true; return; }
      var n = Math.max(2, Math.min(60, parseInt($("#f-count").value, 10) || 12));
      var last = finAddPeriods($("#f-date").value || today(), f, n - 1);
      hint.hidden = false; hint.textContent = "Creates " + n + " " + finFreqLabel(f).toLowerCase() + " transactions through " + fmtDate(last) + ". Future ones show as “scheduled” until their date.";
    }
    if (repeatSel) { repeatSel.addEventListener("change", syncRepeat);
      $("#f-count").addEventListener("input", syncRepeat); $("#f-date").addEventListener("change", syncRepeat); }
    $("#finForm").addEventListener("submit", function (sub) {
      sub.preventDefault();
      var amt = parseFloat($("#f-amt").value); var date = $("#f-date").value;
      $("#f-amt").closest(".field").classList.toggle("field--invalid", !(amt >= 0));
      $("#f-date").closest(".field").classList.toggle("field--invalid", !date);
      if (!(amt >= 0) || !date) { $(!(amt >= 0) ? "#f-amt" : "#f-date").focus(); return; }
      var kind = (document.querySelector('input[name="f-kind"]:checked') || {}).value || "out";
      var cat = kind === "in" ? $("#f-cat-in").value : $("#f-cat-out").value;
      var base = { date: date, kind: kind, category: cat, amount: Math.round(amt * 100) / 100,
        method: $("#f-method").value, party: $("#f-party").value.trim(), desc: $("#f-desc").value.trim(),
        note: $("#f-note").value.trim() };
      if (x && x.id) {
        var idx = state.finances.findIndex(function (y) { return y.id === x.id; });
        state.finances[idx] = Object.assign({}, x, base, { updated: new Date().toISOString(), unsynced: true });
        save(); pushFinance(state.finances[idx]); toast("Transaction saved.");
      } else {
        var freq = repeatSel ? repeatSel.value : "";
        if (freq) {
          var count = Math.max(2, Math.min(60, parseInt($("#f-count").value, 10) || 12));
          var series = uid("ser");
          for (var i = 0; i < count; i++) {
            var occ = Object.assign({}, base, { id: uid("fin"), date: finAddPeriods(date, freq, i),
              series: series, repeat: freq, updated: new Date().toISOString(), unsynced: true });
            state.finances.push(occ); pushFinance(occ);
          }
          save(); toast(count + " " + finFreqLabel(freq).toLowerCase() + " transactions added.");
        } else {
          var rec = Object.assign({}, base, { id: uid("fin"), updated: new Date().toISOString(), unsynced: true });
          state.finances.push(rec); save(); pushFinance(rec);
          toast((kind === "in" ? "+" : "−") + money(base.amount) + " logged.");
        }
      }
      hideDrawer(); renderView();
    });
  }
  function deleteFinance(id) {
    var x = finById(id); if (!x) return;
    if (!window.confirm("Delete this transaction (" + signed(x) + ")?")) return;
    state.finances = state.finances.filter(function (y) { return y.id !== id; });
    save(); pushFinanceDelete(x); hideDrawer(); renderView(); toast("Transaction removed.");
  }
  function openOpeningBalance() {
    showDrawer("Opening balance", '<form id="obForm">' +
      '<div class="field"><label for="ob-amt">Opening / bank balance</label><input id="ob-amt" type="number" step="0.01" value="' + (Number(state.settings.openingBalance) || 0) + '">' +
      '<p class="err" style="color:var(--ink-3);font-weight:500">Your starting cash before any transactions below — so Balance matches your real account.</p></div>' +
      '<div class="drawer__foot"><button type="submit" class="btn btn--primary">Save</button></div></form>');
    $("#obForm").addEventListener("submit", function (e) { e.preventDefault();
      state.settings.openingBalance = Math.round((parseFloat($("#ob-amt").value) || 0) * 100) / 100;
      save(); hideDrawer(); renderView(); toast("Opening balance set.");
    });
  }

  // ---- finances cross-device sync via the Sheet ----
  function pushFinance(x) {
    if (!SIGNUPS_URL || !x) return;
    apiPost({ type: "finance", id: x.id, date: x.date, kind: x.kind, category: x.category, amount: x.amount,
      method: x.method, party: x.party, desc: x.desc, note: x.note, updated: x.updated })
      .then(function () { delete x.unsynced; save(); }).catch(function () {});
  }
  function pushFinanceDelete(x) {
    if (!SIGNUPS_URL || !x) return;
    apiPost({ type: "finance-delete", id: x.id }).catch(function () {});
  }
  function syncFinances(quiet) {
    if (!SIGNUPS_URL || (AUTH.enabled && !AUTH.ready)) return;
    state.finances.forEach(function (x) { if (x.unsynced) pushFinance(x); });
    apiGet().then(function (data) {
      if (data && data.error === "auth") { relock("Session expired — sign in again."); return; }
      if (!data || !data.finances) return;
      var byId = {}; state.finances.forEach(function (x) { byId[x.id] = x; });
      data.finances.forEach(function (row) {
        if (!row.id) return;
        var local = byId[row.id];
        var remote = { id: row.id, date: String(row.date), kind: row.kind === "in" ? "in" : "out", category: row.category || "",
          amount: Number(row.amount) || 0, method: row.method || "", party: row.party || "", desc: row.desc || "",
          note: row.note || "", updated: String(row.updated || "") };
        if (!local) byId[row.id] = remote;
        else if (!local.unsynced && String(remote.updated) >= String(local.updated || "")) byId[row.id] = Object.assign(local, remote);
      });
      state.finances = Object.keys(byId).map(function (id) { return byId[id]; });
      save();
      if (ui.view === "finances") renderView();
    }).catch(function () {});
  }

  // ================================================================
  //  DRAWER
  // ================================================================
  var lastFocus = null;
  function showDrawer(title, html) {
    lastFocus = document.activeElement;
    $("#drawerTitle").textContent = title;
    $("#drawerBody").innerHTML = html;
    var d = $("#drawer"); d.hidden = false;
    requestAnimationFrame(function () { d.classList.add("is-open"); $("#scrim").classList.add("is-open"); });
    var f = $("#drawerBody input, #drawerBody select, #drawerBody textarea"); if (f) f.focus();
  }
  function hideDrawer() {
    var d = $("#drawer"); d.classList.remove("is-open"); $("#scrim").classList.remove("is-open");
    setTimeout(function () { d.hidden = true; $("#drawerBody").innerHTML = ""; }, 260);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function gradeOptions(sel) {
    return LB.GRADE_LABELS.map(function (g, i) { return '<option value="' + i + '"' + (i === sel ? " selected" : "") + '>' + g + (i === 0 ? "" : " grade") + '</option>'; }).join("");
  }
  function athleteForm(a) {
    a = a || {};
    var st = a.status || "prospect";
    var statuses = Object.keys(LB.STATUSES).map(function (k) {
      return '<label' + (k === "atrisk" ? ' class="risk"' : "") + '><input type="radio" name="f-status" value="' + k + '"' + (st === k ? " checked" : "") + '><span>' + LB.STATUSES[k].label + '</span></label>';
    }).join("");
    return '<form id="athForm">' +
      '<div class="field--row">' +
        '<div class="field"><label for="f-first">First name</label><input id="f-first" value="' + esc(a.first || "") + '" required></div>' +
        '<div class="field"><label for="f-last">Last name</label><input id="f-last" value="' + esc(a.last || "") + '" required></div>' +
      '</div>' +
      '<div class="field--row">' +
        '<div class="field"><label for="f-grade">Grade</label><select id="f-grade">' + gradeOptions(a.grade == null ? 3 : a.grade) + '</select></div>' +
        '<div class="field"><label>Program</label><div class="segfield">' +
          '<label><input type="radio" name="f-prog" value="Boys"' + (a.program !== "Girls" ? " checked" : "") + '><span>Boys</span></label>' +
          '<label><input type="radio" name="f-prog" value="Girls"' + (a.program === "Girls" ? " checked" : "") + '><span>Girls</span></label>' +
        '</div></div>' +
      '</div>' +
      '<div class="field"><label for="f-sports">Sports <span style="font-weight:500;color:var(--ink-3)">(comma-separated)</span></label>' +
        '<input id="f-sports" value="' + esc((a.sports || []).join(", ")) + '" placeholder="Soccer, Basketball…"></div>' +
      '<div class="field--row">' +
        '<div class="field"><label for="f-email">Parent email <span style="font-weight:500;color:var(--ink-3)">(for alerts)</span></label>' +
          '<input id="f-email" type="email" value="' + esc(a.email || "") + '" placeholder="name@email.com"></div>' +
        '<div class="field"><label for="f-phone">Parent mobile</label>' +
          '<input id="f-phone" type="tel" value="' + esc(a.phone || "") + '" placeholder="419-555-0100"></div>' +
      '</div>' +
      '<fieldset class="field"><legend>Status</legend><div class="segfield status-choices">' + statuses + '</div></fieldset>' +
      '<div class="field"><label for="f-note">Note <span style="font-weight:500;color:var(--ink-3)">(what to do next)</span></label>' +
        '<textarea id="f-note" placeholder="Missed 3 Saturdays — call this week…">' + esc(a.note || "") + '</textarea></div>' +
      '<div class="drawer__foot">' +
        (a.id ? '<button type="button" class="btn btn--danger" data-action="delete-athlete" data-id="' + a.id + '">Delete</button>' : "") +
        '<button type="submit" class="btn btn--primary">' + (a.id ? "Save" : "Add athlete") + '</button>' +
      '</div></form>';
  }
  function openAthlete(a) {
    showDrawer(a ? "Edit athlete" : "Add athlete", athleteForm(a));
    $("#athForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var first = $("#f-first").value.trim(), last = $("#f-last").value.trim();
      var ok = true;
      [["#f-first", first], ["#f-last", last]].forEach(function (p) {
        var field = $(p[0]).closest(".field"); field.classList.toggle("field--invalid", !p[1]);
        if (!p[1]) { ok = false; if (!field.querySelector(".err")) { var e2 = document.createElement("p"); e2.className = "err"; e2.textContent = "Required."; field.appendChild(e2); } }
        else { var ex = field.querySelector(".err"); if (ex) ex.remove(); }
      });
      if (!ok) { $("#f-first").focus(); return; }
      var grade = parseInt($("#f-grade").value, 10);
      var prog = (document.querySelector('input[name="f-prog"]:checked') || {}).value || "Boys";
      var status = (document.querySelector('input[name="f-status"]:checked') || {}).value || "prospect";
      var sports = $("#f-sports").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      var email = $("#f-email").value.trim(), phone = $("#f-phone").value.trim();
      var note = $("#f-note").value.trim();
      if (a && a.id) {
        var idx = state.athletes.findIndex(function (x) { return x.id === a.id; });
        state.athletes[idx] = Object.assign({}, a, { first: first, last: last, grade: grade, gradYear: LB.gradYearFor(grade), program: prog, status: status, sports: sports, email: email, phone: phone, note: note, updated: today() });
        toast("Saved " + first + " " + last + ".");
      } else {
        state.athletes.push({ id: uid("a"), first: first, last: last, grade: grade, gradYear: LB.gradYearFor(grade), program: prog, status: status, sports: sports, email: email, phone: phone, note: note, updated: today() });
        toast("Added " + first + " " + last + " to the map.");
      }
      save(); hideDrawer(); renderView();
    });
  }

  function sponsorForm(s) {
    s = s || {};
    return '<form id="sponForm">' +
      '<div class="field"><label for="s-name">Business name</label><input id="s-name" value="' + esc(s.name || "") + '" required></div>' +
      '<div class="field"><label for="s-amt">Amount <span style="font-weight:500;color:var(--ink-3)">(0 for in-kind)</span></label>' +
        '<input id="s-amt" type="number" min="0" step="25" value="' + (s.amount != null ? s.amount : "") + '" placeholder="100"></div>' +
      '<div class="field"><label for="s-note">Note</label><textarea id="s-note" placeholder="Banner up · in-kind cleats · PA shout-out…">' + esc(s.note || "") + '</textarea></div>' +
      '<div class="drawer__foot">' +
        (s.id ? '<button type="button" class="btn btn--danger" data-action="delete-sponsor" data-id="' + s.id + '">Delete</button>' : "") +
        '<button type="submit" class="btn btn--primary">' + (s.id ? "Save" : "Add sponsor") + '</button>' +
      '</div></form>';
  }
  function openSponsor(s) {
    showDrawer(s ? "Edit sponsor" : "Add sponsor", sponsorForm(s));
    $("#sponForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("#s-name").value.trim();
      var field = $("#s-name").closest(".field"); field.classList.toggle("field--invalid", !name);
      if (!name) { $("#s-name").focus(); return; }
      var amt = parseInt($("#s-amt").value, 10); if (isNaN(amt) || amt < 0) amt = 0;
      var note = $("#s-note").value.trim();
      if (s && s.id) { var idx = state.sponsors.findIndex(function (x) { return x.id === s.id; });
        state.sponsors[idx] = Object.assign({}, s, { name: name, amount: amt, note: note }); toast("Saved " + name + "."); }
      else { state.sponsors.push({ id: uid("sp"), name: name, amount: amt, note: note }); toast("Added " + name + "."); }
      save(); hideDrawer(); renderView();
    });
  }

  function openSettings() {
    var s = state.settings;
    showDrawer("Program numbers", '<form id="setForm">' +
      '<div class="field"><label for="set-dist">Athletic kids in the district</label><input id="set-dist" type="number" min="0" value="' + s.districtAthletes + '"><p class="err" style="color:var(--ink-3);font-weight:500">The denominator for capture rate and active-player share — your best estimate of every athletic kid K–8.</p></div>' +
      '<div class="drawer__foot"><button type="submit" class="btn btn--primary">Save numbers</button></div></form>');
    $("#setForm").addEventListener("submit", function (e) { e.preventDefault();
      state.settings.districtAthletes = Math.max(0, parseInt($("#set-dist").value, 10) || 0);
      save(); hideDrawer(); renderView(); toast("Numbers updated.");
    });
  }

  // ================================================================
  //  MESSAGE FAMILIES — Remind is primary; email is the backup
  // ================================================================
  function openBroadcast() {
    var recipients = pool();                 // respects the Boys/Girls/All filter
    var withEmail = recipients.filter(function (a) { return a.email && a.email.indexOf("@") > 0; });
    var withPhone = recipients.filter(function (a) { return a.phone; });
    var scope = ui.prog === "all" ? "families" : ui.prog + " families";
    var emails = withEmail.map(function (a) { return a.email; });
    var phones = withPhone.map(function (a) { return a.phone; });

    var remindBlock = REMIND_URL
      ? '<a class="btn btn--primary btn--block" href="' + esc(REMIND_URL) + '" target="_blank" rel="noopener">Open Remind to send</a>'
      : '<p class="cast-hint">Paste your Remind class link into <code>REMIND_URL</code> (src/app.js) and this becomes a one-click “Open Remind.”</p>';

    var html =
      '<div class="cast-primary">' +
        '<p class="cast-note"><b>Remind is your main channel.</b> One message reaches families by phone push, text, and email. Send it there.</p>' +
        remindBlock +
        '<p class="cast-note" style="margin-top:.9rem">New families to add to Remind? Copy their contacts and paste into Remind ▸ Add people:</p>' +
        '<div class="cast-tools">' +
          '<button type="button" class="btn btn--ghost btn--sm" data-cast="phones"' + (phones.length ? "" : " disabled") + '>Copy ' + phones.length + ' phone number' + (phones.length === 1 ? "" : "s") + '</button>' +
          '<button type="button" class="btn btn--ghost btn--sm" data-cast="emails"' + (emails.length ? "" : " disabled") + '>Copy ' + emails.length + ' email' + (emails.length === 1 ? "" : "s") + '</button>' +
        '</div>' +
      '</div>' +
      '<details class="cast-backup"><summary>Backup: email these ' + esc(scope) + ' directly</summary>' +
        '<form id="castForm">' +
          '<p class="cast-note">Opens a Gmail draft to ' + emails.length + ' ' + esc(scope) + ' with everyone BCC\'d (they can\'t see each other). Use only if Remind is down.</p>' +
          '<label class="cast-urgent"><input type="checkbox" id="cast-urgent"><span><b>🚨 Mark urgent</b></span></label>' +
          '<div class="field"><label for="cast-subj">Subject</label><input id="cast-subj" placeholder="Tonight’s session — update"></div>' +
          '<div class="field"><label for="cast-msg">Message</label><textarea id="cast-msg" rows="5" placeholder="Hi families —…"></textarea></div>' +
          '<div class="drawer__foot"><button type="submit" class="btn btn--ghost"' + (emails.length ? "" : " disabled") + '>Open email draft</button></div>' +
        '</form>' +
      '</details>';
    showDrawer("Message families", html);

    function copy(text, label, btn) {
      var done = function () { var old = btn.textContent; btn.textContent = "Copied ✓"; toast(label + " copied."); setTimeout(function () { btn.textContent = old; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt("Copy:", text); });
      else window.prompt("Copy:", text);
    }
    $("#drawerBody").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cast]"); if (!b) return;
      if (b.dataset.cast === "emails") copy(emails.join(", "), emails.length + " emails", b);
      else if (b.dataset.cast === "phones") copy(phones.join(", "), phones.length + " numbers", b);
    });
    var castForm = $("#castForm");
    if (castForm) castForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!emails.length) return;
      var urgent = $("#cast-urgent").checked;
      var subj = $("#cast-subj").value.trim() || "LB Soccer Academy update";
      if (urgent) subj = "🚨 URGENT — " + subj;
      var msg = $("#cast-msg").value.trim();
      var body = (urgent ? "URGENT NOTICE\n\n" : "") + msg + "\n\n— LB Soccer Academy";
      var url = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(CONTACT_EMAIL) +
        "&bcc=" + encodeURIComponent(emails.join(",")) +
        "&su=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
      var win = window.open(url, "_blank", "noopener");
      if (!win) window.location.href = "mailto:" + encodeURIComponent(CONTACT_EMAIL) +
        "?bcc=" + encodeURIComponent(emails.join(",")) + "&subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
      hideDrawer();
      toast("Opened a draft to " + emails.length + " " + (emails.length === 1 ? "family" : "families") + ".");
    });
  }

  // ================================================================
  //  SYNC SIGN-UPS  (website -> Athletes)
  // ================================================================
  var GRADE_MAP = { "Pre-K": 0, "Kindergarten": 0, "1st grade": 1, "2nd grade": 2,
    "3rd grade": 3, "4th grade": 4, "5th grade": 5, "6th grade": 6, "7th grade": 7,
    "8th grade": 8, "9th grade": 8, "10th grade": 8, "11th grade": 8, "12th grade": 8 };

  function parseSignup(s) {
    var name = String(s.child || "").trim();
    var sp = name.indexOf(" ");
    var first = sp > 0 ? name.slice(0, sp) : name;
    var last = sp > 0 ? name.slice(sp + 1).trim() : "";
    var gc = String(s.gradClass || "");
    var ym = gc.match(/Class of\s*(\d{4})/);
    var lm = gc.match(/\(([^)]+)\)/);
    var grade = lm ? GRADE_MAP[lm[1]] : undefined;
    if (grade == null) grade = 0;
    var gradYear = ym ? parseInt(ym[1], 10) : LB.gradYearFor(grade);
    var sports = String(s.sports || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    return { id: uid("a"), first: first, last: last, grade: grade, gradYear: gradYear,
      program: (s.program === "Girls" ? "Girls" : "Boys"), status: "active",
      sports: sports, email: String(s.email || ""), phone: String(s.phone || ""),
      note: String(s.note || ""), updated: today() };
  }

  function syncSignups(quiet) {
    if (!SIGNUPS_URL) { if (!quiet) openSyncHelp(); return; }
    if (AUTH.enabled && !AUTH.ready) return;
    if (!quiet) toast("Checking for new sign-ups…");
    apiGet()
      .then(function (data) {
        if (data && data.error === "auth") { relock("Session expired — sign in again."); return; }
        if (!data || !data.signups) { if (!quiet) toast("No sign-ups found."); return; }
        state.importedSignups = state.importedSignups || [];
        var seen = {}; state.importedSignups.forEach(function (k) { seen[k] = 1; });
        var fresh = [];
        data.signups.forEach(function (s) {
          if (!s.child) return;
          if (String(s.program || "").indexOf("Sponsor") > -1) return;  // sponsors aren't athletes
          var key = String(s.when) + "|" + s.child + "|" + (s.email || "");
          if (seen[key]) return;
          seen[key] = 1; state.importedSignups.push(key);
          var a = parseSignup(s);
          var dupe = state.athletes.some(function (x) {
            return x.first === a.first && x.last === a.last && x.gradYear === a.gradYear; });
          if (dupe) return;
          state.athletes.push(a); fresh.push(a);
        });
        save();
        var added = fresh.length;
        if (added) {
          renderView();
          toast("Imported " + added + " new sign-up" + (added === 1 ? "" : "s") + " into Athletes.");
          if (!quiet) openRemindAdd(fresh);        // offer their numbers for Remind
        } else if (!quiet) toast("You're all caught up — no new sign-ups.");
        syncAttendance(true);   // roster is current — pull attendance too
      })
      .catch(function () { if (!quiet) toast("Couldn't reach the sign-up sheet. Check SIGNUPS_URL."); });
  }

  // After importing sign-ups, offer their phone numbers to paste into Remind.
  function openRemindAdd(list) {
    var phones = list.map(function (a) { return a.phone; }).filter(Boolean);
    var n = list.length;
    var html = '<div class="cast-primary">' +
      '<p class="cast-note"><b>' + n + ' new famil' + (n === 1 ? "y" : "ies") + ' imported.</b> ' +
        'They\'re auto-invited to Remind by email — to add them yourself, paste their numbers into <b>Remind ▸ Add people</b>.</p>' +
      (REMIND_URL ? '<a class="btn btn--primary btn--block" href="' + esc(REMIND_URL) + '" target="_blank" rel="noopener">Open Remind</a>' : "") +
      '<div class="cast-tools" style="margin-top:.7rem">' +
        '<button type="button" class="btn btn--ghost btn--sm" data-radd="1"' + (phones.length ? "" : " disabled") + '>Copy ' + phones.length + ' phone number' + (phones.length === 1 ? "" : "s") + '</button>' +
      '</div>' +
      '<p class="cast-hint">Remind skips anyone already in the class, so pasting is always safe.</p>' +
      '</div><div class="drawer__foot"><button type="button" class="btn btn--ghost" data-action="close-drawer">Done</button></div>';
    showDrawer("Add new families to Remind", html);
    $("#drawerBody").addEventListener("click", function (e) {
      var b = e.target.closest("[data-radd]"); if (!b) return;
      var text = phones.join("\n");
      var done = function () { var o = b.textContent; b.textContent = "Copied ✓"; toast("Copied " + phones.length + " numbers."); setTimeout(function () { b.textContent = o; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt("Copy:", text); });
      else window.prompt("Copy:", text);
    });
  }

  function openSyncHelp() {
    showDrawer("Connect sign-ups", '<div class="cast-primary">' +
      '<p class="cast-note">Website sign-ups flow into your <b>Google Sheet</b>, and this button pulls new ones straight into <b>Athletes</b> — no retyping.</p>' +
      '<p class="cast-note">To turn it on, deploy the Apps Script (see the parent-alerts guide), then paste your web-app <code>/exec</code> URL into <code>SIGNUPS_URL</code> at the top of <code>src/app.js</code>.</p>' +
      '<p class="cast-hint">It maps each sign-up to an athlete (name, graduation class, Boys/Girls, other sports), marks them Active, skips sponsors, and never imports the same kid twice.</p>' +
      '</div><div class="drawer__foot"><button type="button" class="btn btn--primary" data-action="close-drawer">Got it</button></div>');
  }

  // ================================================================
  //  STATUS POPOVER
  // ================================================================
  function openStatusPop(btn, id) {
    closePop();
    var a = state.athletes.find(function (x) { return x.id === id; }); if (!a) return;
    var pop = document.createElement("div"); pop.className = "pop"; pop.id = "statusPop";
    pop.innerHTML = Object.keys(LB.STATUSES).map(function (k) {
      var st = LB.STATUSES[k];
      return '<button data-set="' + k + '"><span class="pdot" style="background:' + toneColor(st.tone) + '"></span>' + st.label +
        (k === a.status ? ' ✓' : "") + '</button>';
    }).join("");
    document.body.appendChild(pop);
    var r = btn.getBoundingClientRect();
    pop.style.top = (r.bottom + window.scrollY + 4) + "px";
    pop.style.left = Math.min(r.left + window.scrollX, window.innerWidth - pop.offsetWidth - 8) + "px";
    var pf = pop.querySelector("button"); if (pf) pf.focus();
    pop.addEventListener("click", function (e) { var b = e.target.closest("button[data-set]"); if (!b) return;
      setStatus(id, b.dataset.set); closePop(); });
  }
  function closePop() { var p = $("#statusPop"); if (p) p.remove(); }
  function toneColor(t) { return t === "danger" ? "var(--danger)" : t === "good" ? "var(--accent)" : t === "muted" ? "#b9c2d0" : "var(--ink-3)"; }
  function setStatus(id, status) {
    var a = state.athletes.find(function (x) { return x.id === id; }); if (!a) return;
    a.status = status; a.updated = today(); save(); renderView();
    toast(a.first + " → " + LB.STATUSES[status].label + ".");
  }

  // ================================================================
  //  MISC
  // ================================================================
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  var toastTimer;
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("is-show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("is-show"); }, 2600); }

  function openSidebar() { $("#sidebar").classList.add("is-open"); $("#scrim").classList.add("is-open"); $("#burger").setAttribute("aria-expanded", "true"); }
  function closeSidebar() { $("#sidebar").classList.remove("is-open"); if (!$("#drawer").classList.contains("is-open")) $("#scrim").classList.remove("is-open"); $("#burger").setAttribute("aria-expanded", "false"); }

  // ================================================================
  //  EVENTS (delegation)
  // ================================================================
  document.addEventListener("click", function (e) {
    var nav = e.target.closest(".side__link"); if (nav) { setView(nav.dataset.view); return; }
    var seg = e.target.closest("#progSeg button"); if (seg) { ui.prog = seg.dataset.prog;
      $$("#progSeg button").forEach(function (b) { b.setAttribute("aria-pressed", String(b === seg)); }); renderView(); return; }
    var act = e.target.closest("[data-action]"); if (!act) { closePop(); return; }
    var action = act.dataset.action, id = act.dataset.id;
    switch (action) {
      case "add-athlete": openAthlete(null); break;
      case "edit": openAthlete(state.athletes.find(function (x) { return x.id === id; })); break;
      case "delete-athlete": state.athletes = state.athletes.filter(function (x) { return x.id !== id; }); save(); hideDrawer(); renderView(); toast("Athlete removed."); break;
      case "reached": setStatus(id, "active"); break;
      case "status": e.stopPropagation(); openStatusPop(act, id); break;
      case "filter-status": ui.status = act.dataset.status; renderAthletes(); break;
      case "filter-grad": ui.grad = act.dataset.grad; renderAthletes(); break;
      case "clear-filters": ui.status = "all"; ui.grad = "all"; ui.search = ""; renderAthletes(); break;
      case "toggle-phase": togglePhase(parseInt(act.dataset.n, 10)); break;
      case "add-event": openEvent(null); break;
      case "edit-event": openEvent(eventById(id)); break;
      case "delete-event": deleteEvent(id); break;
      case "take-attendance": ui.attEvent = id; ui.presentEvent = null; setView("attendance"); break;
      case "add-sponsor": openSponsor(null); break;
      case "edit-sponsor": openSponsor(state.sponsors.find(function (x) { return x.id === id; })); break;
      case "delete-sponsor": state.sponsors = state.sponsors.filter(function (x) { return x.id !== id; }); save(); hideDrawer(); renderView(); toast("Sponsor removed."); break;
      case "add-finance": openFinance(null); break;
      case "edit-finance": openFinance(finById(id)); break;
      case "delete-finance": deleteFinance(id); break;
      case "fin-opening": openOpeningBalance(); break;
      case "fin-filter": ui.finFilter = act.dataset.f; renderFinances(); break;
      case "settings": openSettings(); break;
      case "broadcast": openBroadcast(); break;
      case "sync-signups": syncSignups(false); break;
      case "att-toggle":
        var k = act.dataset.key;
        if (ui.present[k]) delete ui.present[k]; else ui.present[k] = 1;
        ui.attDirty = true;
        act.classList.toggle("is-on"); act.setAttribute("aria-pressed", String(!!ui.present[k]));
        updateAttCount(); break;
      case "att-all": var evAll = eventById(ui.attEvent); if (evAll) attRoster(evAll).forEach(function (x) { ui.present[athKey(x)] = 1; }); ui.attDirty = true; renderAttendance(); break;
      case "att-none": ui.present = {}; ui.presentEvent = ui.attEvent; ui.attDirty = true; renderAttendance(); break;
      case "att-load": ui.attEvent = act.dataset.id; loadPresent(ui.attEvent); renderAttendance(); break;
      case "save-session": saveSession(); break;
      case "manage-access": openAccess(); break;
      case "sign-out": signOut(); break;
      case "close-drawer": hideDrawer(); break;
      case "load-sample": loadSample(); break;
      case "clear": clearAll(); break;
    }
  });
  function togglePhase(n) {
    var i = state.phasesDone.indexOf(n);
    if (i === -1) state.phasesDone.push(n); else state.phasesDone.splice(i, 1);
    save(); renderPlan();
  }
  function loadSample() {
    state = JSON.parse(JSON.stringify(LB.SAMPLE)); state.seeded = true;
    state.sessions = state.sessions || []; state.phasesDone = state.phasesDone || []; state.events = state.events || []; state.finances = state.finances || [];
    save(); renderView();
    toast("Sample roster loaded.");
  }
  function clearAll() {
    if (!window.confirm("Clear all athletes, sponsors, plan progress, and numbers? This can't be undone.")) return;
    state = blank(); save(); renderView(); toast("All data cleared.");
  }

  $("#burger").addEventListener("click", function () {
    if ($("#sidebar").classList.contains("is-open")) closeSidebar(); else openSidebar();
  });
  var authOther = $("#authOther"); if (authOther) authOther.addEventListener("click", signOut);
  $("#drawerClose").addEventListener("click", hideDrawer);
  $("#scrim").addEventListener("click", function () { hideDrawer(); closeSidebar(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closePop(); if ($("#drawer") && !$("#drawer").hidden) hideDrawer(); closeSidebar(); } });
  window.addEventListener("scroll", closePop, { passive: true });
  window.addEventListener("resize", closePop);

  // ---- boot --------------------------------------------------------
  renderTopbar();
  renderView();
  initAuth();   // gate the dashboard; runBootSyncs() pulls sign-ups + attendance + events once approved
})();
