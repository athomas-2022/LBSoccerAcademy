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

  var SETTINGS_DEFAULT = { districtAthletes: 240 };

  // ---- state -------------------------------------------------------
  var state, ui = { view: "overview", prog: "all", search: "", status: "all", grad: "all", attDate: "", attEvent: "", present: {},
    resType: "all", resAge: "all", resTopic: "all", resSearch: "" };

  var TEAM_LEVELS = ["Rec", "Travel", "Club", "School", "Other"];
  // Where a coach sits in the affiliation funnel: prospect -> invited -> affiliated.
  var AFFIL = [
    { key: "affiliated", label: "Affiliated", tone: "good", help: "Trained in the Eagles Way and coaching it." },
    { key: "invited", label: "Invited", tone: "warn", help: "Asked to a clinic — not yet trained." },
    { key: "prospect", label: "Prospect", tone: "neutral", help: "A coach we want to bring in." }
  ];
  function affilOf(k) { for (var i = 0; i < AFFIL.length; i++) if (AFFIL[i].key === k) return AFFIL[i]; return AFFIL[2]; }
  var SHIRT_SIZES = ["Youth XS", "Youth S", "Youth M", "Youth L", "Youth XL", "Adult S", "Adult M", "Adult L", "Adult XL"];
  function shortSize(s) { return String(s || "").replace("Youth ", "Y").replace("Adult ", "A"); }

  // ---- Training library: videos + guides for coaches ----
  var RES_TYPES = [
    { key: "video", label: "Video", icon: "ic-play" },
    { key: "guide", label: "Guide", icon: "ic-doc" },
    { key: "plan",  label: "Session plan", icon: "ic-plan" },
    { key: "link",  label: "Link", icon: "ic-link" }
  ];
  var RES_AGES = [ { key: "grassroot", label: "K–2" }, { key: "academy", label: "3–5" }, { key: "nextxi", label: "6–8" }, { key: "all", label: "All ages" } ];
  var RES_TOPICS = ["Ball mastery", "Dribbling", "1v1 / moves", "Passing & receiving", "First touch", "Shooting & finishing",
    "Small-sided games", "Defending", "Goalkeeping", "Team shape", "Set pieces", "Warmups", "Fun & games", "Session plans", "Coaching basics"];
  function resType(k) { for (var i = 0; i < RES_TYPES.length; i++) if (RES_TYPES[i].key === k) return RES_TYPES[i]; return RES_TYPES[0]; }
  function resAge(k) { for (var i = 0; i < RES_AGES.length; i++) if (RES_AGES[i].key === k) return RES_AGES[i]; return null; }
  function ytId(u) { var m = String(u || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{6,})/); return m ? m[1] : ""; }
  function vimeoId(u) { var m = String(u || "").match(/vimeo\.com\/(?:video\/)?(\d+)/); return m ? m[1] : ""; }
  function resEmbed(u) { var y = ytId(u); if (y) return "https://www.youtube-nocookie.com/embed/" + y + "?rel=0&autoplay=1";
    var v = vimeoId(u); if (v) return "https://player.vimeo.com/video/" + v + "?autoplay=1"; return ""; }
  function resThumb(r) { var y = ytId(r.url || ""); return y ? "https://i.ytimg.com/vi/" + y + "/hqdefault.jpg" : ""; }
  var EWAY_URL = "https://lbsocceracademy.org/#eaglesway";
  var STARTER_RESOURCES = [
    { title: "The Eagles Way — full curriculum", type: "guide", url: EWAY_URL, ages: ["all"], topics: ["Coaching basics", "Session plans"], duration: "", desc: "The complete K–8 coaching curriculum: the Standard, the session shape, and what to teach by age band.", note: "Starter" },
    { title: "The Standard — six non-negotiables", type: "guide", url: EWAY_URL, ages: ["all"], topics: ["Coaching basics"], duration: "", desc: "Touches · Brave · Play · Fun · System · every kid known by name — the rules every affiliated coach carries.", note: "Starter" },
    { title: "The Eagles session shape (4 beats)", type: "plan", url: EWAY_URL, ages: ["all"], topics: ["Session plans", "Warmups"], duration: "", desc: "Arrival ball-mastery → skill of the day → small-sided games → free scrimmage. The repeatable template for any age.", note: "Starter" },
    { title: "Grassroot K–2 — sample session", type: "plan", url: EWAY_URL, ages: ["grassroot"], topics: ["Dribbling", "Fun & games", "Session plans"], duration: "", desc: "Traffic & turns: dribble a maze, freeze, change direction, then swarm-of-tiny-goals 1v1s. Fun is the curriculum.", note: "Starter" },
    { title: "Rising Eagles 3–5 — sample session", type: "plan", url: EWAY_URL, ages: ["academy"], topics: ["1v1 / moves", "Small-sided games", "Session plans"], duration: "", desc: "Take them on: warm up a 1v1 move, rep vs a passive then live defender, then 2v2 with a bonus point for beating your player.", note: "Starter" },
    { title: "Next XI 6–8 — sample session", type: "plan", url: EWAY_URL, ages: ["nextxi"], topics: ["Team shape", "Session plans"], duration: "", desc: "Out of the back: rondo to keep the ball, 4v4+2 building from the keeper, then a game rewarding a clean build through the thirds.", note: "Starter" },
    { title: "Example — ball-mastery warmup clip", type: "video", url: "https://www.youtube.com/results?search_query=youth+soccer+ball+mastery+warmup", ages: ["grassroot", "academy"], topics: ["Ball mastery", "Warmups"], duration: "", desc: "Replace with your own clip — paste any YouTube or Vimeo link and it plays right here in the dashboard.", note: "Example — replace with your clip" },
    { title: "Example — 1v1 moves to teach", type: "video", url: "https://www.youtube.com/results?search_query=soccer+1v1+moves+for+kids", ages: ["academy", "nextxi"], topics: ["1v1 / moves", "Dribbling"], duration: "", desc: "Example placeholder. Add a real YouTube/Vimeo link and coaches watch it without leaving the dashboard.", note: "Example — replace with your clip" }
  ];

  function blank() { return { athletes: [], sponsors: [], phasesDone: [], sessions: [], events: [], finances: [], teams: [], resources: [], usage: [], settings: Object.assign({}, SETTINGS_DEFAULT), seeded: false }; }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) { var d = JSON.parse(raw);
      d.settings = Object.assign({}, SETTINGS_DEFAULT, d.settings || {}); d.athletes = d.athletes || [];
      d.sponsors = d.sponsors || []; d.phasesDone = d.phasesDone || []; d.sessions = d.sessions || []; d.events = d.events || []; d.finances = d.finances || []; d.teams = d.teams || []; d.resources = d.resources || []; d.usage = d.usage || []; return d; } }
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
  // Only the owner may edit. Approved non-owners are view-only. (No gate configured yet → editable.)
  function canEdit() { return !AUTH.enabled || AUTH.owner; }
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
  function runBootSyncs() { if (SIGNUPS_URL) { syncSignups(true); syncEvents(true); syncResources(true); syncUsage(true); } }

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
      activeShare: dist > 0 ? Math.round(active / dist * 100) : 0
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
    teams: { title: "Coaches", sub: "The district's coaches — train them in the Eagles Way and every kid on their roster benefits." },
    training: { title: "Training Library", sub: "Videos, drills & guides for every Eagles-Affiliated coach." },
    schedule: { title: "Schedule", sub: "Preseason coach clinics & showcases — auto-added to the shared calendar. Take clinic attendance right here." }
  };
  function renderTopbar() {
    var m = VIEW_META[ui.view];
    $("#viewTitle").textContent = m.title; $("#viewSub").textContent = m.sub;
    var slot = $("#topActions"); slot.innerHTML = "";
    if (!canEdit()) {
      // View-only coaches get read-only actions only.
      slot.innerHTML = '<span class="viewonly-pill">View only</span>' +
        (ui.view === "schedule" && CALENDAR_ID ? '<a class="btn btn--ghost" href="https://calendar.google.com/calendar/u/0/r?cid=' + encodeURIComponent(CALENDAR_ID) + '" target="_blank" rel="noopener">Open shared calendar</a>' : "");
      return;
    }
    if (ui.view === "overview") {
      slot.innerHTML = '<button class="btn btn--ghost" data-action="settings">Edit numbers</button>' +
        '<button class="btn btn--primary" data-action="add-athlete"><svg class="ic"><use href="#ic-plus"/></svg>Add athlete</button>';
    } else if (ui.view === "athletes") {
      slot.innerHTML = '<button class="btn btn--ghost" data-action="sync-signups">Sync sign-ups</button>' +
        '<button class="btn btn--ghost" data-action="broadcast"><svg class="ic"><use href="#ic-phone"/></svg>Message families</button>' +
        '<button class="btn btn--primary" data-action="add-athlete"><svg class="ic"><use href="#ic-plus"/></svg>Add athlete</button>';
    } else if (ui.view === "teams") {
      slot.innerHTML = '<button class="btn btn--primary" data-action="add-team"><svg class="ic"><use href="#ic-plus"/></svg>Add coach</button>';
    } else if (ui.view === "training") {
      slot.innerHTML = '<button class="btn btn--ghost" data-action="coach-activity"><svg class="ic"><use href="#ic-attend"/></svg>Coach activity</button>' +
        '<button class="btn btn--primary" data-action="add-resource"><svg class="ic"><use href="#ic-plus"/></svg>Add resource</button>';
    } else if (ui.view === "schedule") {
      slot.innerHTML = (CALENDAR_ID ? '<a class="btn btn--ghost" href="https://calendar.google.com/calendar/u/0/r?cid=' + encodeURIComponent(CALENDAR_ID) + '" target="_blank" rel="noopener">Open shared calendar</a>' : "") +
        '<button class="btn btn--primary" data-action="add-event"><svg class="ic"><use href="#ic-plus"/></svg>Add event</button>';
    }
  }
  function setView(v) {
    ui.view = v;
    $$(".side__link").forEach(function (b) { b.setAttribute("aria-current", String(b.dataset.view === v)); });
    $$(".view").forEach(function (s) { s.classList.remove("is-active"); });
    $("#view-" + v).classList.add("is-active");
    closeSidebar();
    renderTopbar(); renderView();
    if (v === "schedule") { syncEvents(true); syncAttendance(true); }  // pull events + clinic attendance
    if (v === "training") { syncResources(true); syncUsage(true); }   // pull the shared library + coach activity
    $("#view-" + v).focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  function renderView() {
    document.body.classList.toggle("is-viewonly", !canEdit());
    if (ui.view === "overview") renderOverview();
    else if (ui.view === "athletes") renderAthletes();
    else if (ui.view === "teams") renderTeams();
    else if (ui.view === "training") renderTraining();
    else if (ui.view === "schedule") renderSchedule();
    renderNavBadge(); renderDataNote();
  }
  function renderNavBadge() {
    var n = state.athletes.filter(function (a) { return a.status === "atrisk"; }).length;
    var b = $("#navRisk"); if (n > 0) { b.hidden = false; b.textContent = n; } else b.hidden = true;
  }
  function renderDataNote() {
    var note = $("#dataNote");
    if (!state.athletes.length || !canEdit()) { note.innerHTML = ""; return; }
    note.innerHTML = (state.seeded ? "Showing sample data. " : "") +
      '<button data-action="clear">Clear all data</button>';
  }

  // ================================================================
  //  OVERVIEW
  // ================================================================
  function renderOverview() {
    var n = numbers();
    var host = $("#view-overview");
    if (!state.athletes.length) { host.innerHTML = firstRunEmpty(); return; }

    var pct = function (v) { return Math.max(0, Math.min(100, v)); };
    var board =
      '<div class="scoreboard" role="group" aria-label="The Four Numbers">' +
        scoreCell("Capture rate", n.capture + '<small>%</small>', "touched " + n.touched + " of ~" + state.settings.districtAthletes + " kids", pct(n.capture), true) +
        scoreCell("Retention", n.retention + '<small>%</small>', n.active + " active · " + n.atrisk + " at risk", pct(n.retention), true) +
        scoreCell("Active players", String(n.active), "playing right now, K–8", pct(n.activeShare), true) +
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

    var sideCol =
      '<section class="panel"><div class="panel__head"><h2>Where we stand</h2></div><div class="panel__body">' +
        '<div class="mini">' +
          miniRow("Capture rate", n.capture + "%", n.capture, false) +
          miniRow("Retention", n.retention + "%", n.retention, false) +
          miniRow("At risk", n.atrisk + " of " + n.touched, n.touched ? Math.round(n.atrisk / n.touched * 100) : 0, true) +
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
      '<img src="../assets/logos/Crest.png" alt="" />' +
      '<h3>Let’s build the map.</h3>' +
      '<p>Every athletic kid in the district matters — today’s second-grader is tomorrow’s varsity. Start by adding the kids you know, or load a sample roster to see how it works.</p>' +
      '<div class="empty__actions owner-only">' +
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
      host.innerHTML = '<div class="empty"><img src="../assets/logos/Crest.png" alt="" />' +
        '<h3>No athletes yet.</h3><p>Map every athletic kid K–8 — including the fast basketball kid who’s never touched a soccer ball. A future center back or keeper.</p>' +
        '<div class="empty__actions owner-only"><button class="btn btn--primary" data-action="add-athlete"><svg class="ic"><use href="#ic-plus"/></svg>Add an athlete</button>' +
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

    var editAttr = canEdit() ? ' data-action="edit"' : "";
    var rows = list.map(function (a) {
      return '<tr' + editAttr + ' data-id="' + a.id + '"' + (a.status === "atrisk" ? ' class="is-risk"' : "") + '>' +
        '<td><div class="who"><span class="avatar ' + (a.program === "Girls" ? "g" : "") + '">' + esc(initials(a)) + '</span>' +
          '<span>' + (canEdit() ? '<button type="button" class="who__name" data-action="edit" data-id="' + a.id + '">' + esc(a.first + " " + a.last) + '</button>' : '<span class="who__name">' + esc(a.first + " " + a.last) + '</span>') +
          (a.sports && a.sports.length ? '<span class="who__sports">' + esc(a.sports.join(", ")) + '</span>' : "") +
          (a.shirt ? '<span class="who__shirt" title="Shirt size">' + esc(shortSize(a.shirt)) + '</span>' : "") + '</span></div></td>' +
        '<td class="tnum">' + LB.GRADE_LABELS[a.grade] + '</td>' +
        '<td class="tnum">' + a.gradYear + '</td>' +
        '<td><span class="prog-tag ' + (a.program === "Girls" ? "g" : "b") + '">' + esc(a.program) + '</span></td>' +
        '<td>' + statusPill(a.status, canEdit(), a.id) + '</td>' +
        '</tr>';
    }).join("");

    var table = list.length
      ? '<div class="tablewrap"><table class="roster"><thead><tr>' +
          '<th>Athlete</th><th>Grade</th><th>Class of</th><th>Program</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="empty"><h3>No matches.</h3><p>No athletes fit these filters. Try clearing them.</p>' +
        '<div class="empty__actions"><button class="btn btn--ghost" data-action="clear-filters">Clear filters</button></div></div>';

    var everyone = pool(), sizes = {}, withSize = 0;
    everyone.forEach(function (a) { if (a.shirt) { sizes[a.shirt] = (sizes[a.shirt] || 0) + 1; withSize++; } });
    var tally = withSize ? '<div class="shirt-tally"><span class="shirt-tally__h">Shirt order</span>' +
      SHIRT_SIZES.filter(function (s) { return sizes[s]; }).map(function (s) { return '<span class="shirt-pill">' + esc(shortSize(s)) + ' <b>×' + sizes[s] + '</b></span>'; }).join("") +
      '<span class="shirt-tally__n">' + withSize + ' of ' + everyone.length + ' sized</span></div>' : "";

    host.innerHTML = map + toolbar + tally + table;
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
  //  TEAMS — local teams already playing; a recruiting funnel
  // ================================================================
  function teamById(id) { for (var i = 0; i < state.teams.length; i++) if (state.teams[i].id === id) return state.teams[i]; return null; }
  function parseRoster(text) {
    return String(text || "").split("\n").map(function (line) {
      var t = line.trim(); if (!t) return null;
      var m = t.match(/^(.*?)[,\-–]\s*(K|\d{1,2})(?:\s*(?:st|nd|rd|th)?\s*(?:grade)?)?\s*$/i);
      if (m) { var g = /^k$/i.test(m[2]) ? 0 : parseInt(m[2], 10); return { name: m[1].trim(), grade: (g >= 0 && g <= 8) ? g : null }; }
      return { name: t, grade: null };
    }).filter(Boolean);
  }
  function rosterToText(players) {
    return (players || []).map(function (p) { return p.name + (p.grade != null ? ", " + (p.grade === 0 ? "K" : p.grade) : ""); }).join("\n");
  }
  // A team can have several coaches. Normalize legacy single-coach records.
  function teamCoaches(t) {
    if (t.coaches && t.coaches.length) return t.coaches;
    if (t.coach) return [{ name: t.coach, email: t.coachEmail || "", phone: t.coachPhone || "" }];
    return [];
  }
  // how many of a team's players already exist as academy athletes
  function teamMatched(t) {
    var prog = t.program === "Girls" ? "Girls" : "Boys";
    return (t.players || []).filter(function (p) {
      var name = String(p.name || "").trim(), sp = name.indexOf(" ");
      var first = sp > 0 ? name.slice(0, sp) : name, last = sp > 0 ? name.slice(sp + 1).trim() : "";
      var gy = LB.gradYearFor(p.grade != null ? p.grade : 3);
      return state.athletes.some(function (a) {
        return a.first.toLowerCase() === first.toLowerCase() && a.last.toLowerCase() === last.toLowerCase() && a.gradYear === gy;
      });
    }).length;
  }

  function renderTeams() {
    var host = $("#view-teams");
    var teamCount = state.teams.length;
    var coachCount = allCoaches().length;
    var playerCount = state.teams.reduce(function (n, t) { return n + (t.players ? t.players.length : 0); }, 0);
    var affCount = state.teams.filter(function (t) { return t.affiliation === "affiliated"; }).length;
    var summary = '<div class="team-summary">' +
      '<div class="team-stat"><b class="tnum">' + coachCount + '</b> coach' + (coachCount === 1 ? "" : "es") + '</div>' +
      '<div class="team-stat"><b class="tnum">' + teamCount + '</b> team' + (teamCount === 1 ? "" : "s") + ' · ' + affCount + ' affiliated</div>' +
      '<div class="team-stat"><b class="tnum">' + playerCount + '</b> kids reached</div>' +
      '<p class="team-lede">Every rec, travel, club and school coach in the district. Train them in the Eagles Way and it reaches every kid on their roster — no extra sessions for the kids.</p></div>';

    if (!teamCount) {
      host.innerHTML = summary + '<div class="empty"><img src="../assets/logos/Crest.png" alt="" />' +
        '<h3>No coaches yet.</h3><p>Add a rec, travel, club or school coach — their team and roster. Track them from prospect to invited to Eagles-Affiliated, and pull their kids into Athletes with one tap.</p>' +
        '<div class="empty__actions owner-only"><button class="btn btn--primary" data-action="add-team"><svg class="ic"><use href="#ic-plus"/></svg>Add a coach</button></div></div>';
      return;
    }
    var affRank = { affiliated: 0, invited: 1, prospect: 2 };
    var cards = state.teams.slice().sort(function (a, b) {
      return (affRank[a.affiliation] || 2) - (affRank[b.affiliation] || 2) || a.name.localeCompare(b.name);
    }).map(function (t) {
      var players = t.players || [], matched = teamMatched(t);
      var aff = affilOf(t.affiliation);
      var chips = '<span class="team-chip team-chip--' + aff.tone + '">' + esc(aff.label) + '</span>' +
        '<span class="team-chip">' + esc(t.level || "Team") + '</span>' +
        '<span class="team-chip">' + esc(t.program || "Coed") + '</span>' +
        (t.ageGroup ? '<span class="team-chip">' + esc(t.ageGroup) + '</span>' : "");
      var cs = teamCoaches(t);
      var coach = cs.length ? '<div class="team-coaches">' + cs.map(function (c) {
        return '<div class="team-coach"><b>Coach ' + esc(c.name) + '</b>' +
          (c.email ? ' · <a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : "") +
          (c.phone ? ' · <a href="tel:' + esc(c.phone) + '">' + esc(c.phone) + '</a>' : "") + '</div>';
      }).join("") +
        (t.clinic ? '<div class="team-clinic">last clinic ' + esc(fmtDate(t.clinic)) + '</div>' : "") + '</div>' : "";
      var roster = players.length ? '<div class="team-roster">' + players.map(function (p) {
        return '<span class="team-player">' + esc(p.name) + (p.grade != null ? ' <i>' + (p.grade === 0 ? "K" : LB.GRADE_LABELS[p.grade]) + '</i>' : "") + '</span>';
      }).join("") + '</div>' : '<p class="team-empty">No players added yet.</p>';
      var importLbl = matched >= players.length && players.length ? "All in academy" : "Add roster to Athletes";
      return '<div class="team-card">' +
        '<div class="team-card__head"><div><h3 class="team-name">' + esc(t.name) + '</h3><div class="team-chips">' + chips + '</div></div>' +
          '<div class="team-actions owner-only">' +
            '<button class="btn btn--primary btn--sm" data-action="import-team" data-id="' + t.id + '"' + (players.length && matched < players.length ? "" : " disabled") + '>' + importLbl + '</button>' +
            '<button class="btn btn--ghost btn--sm" data-action="edit-team" data-id="' + t.id + '">Edit</button>' +
          '</div></div>' +
        coach +
        '<div class="team-rosterhead"><span>' + players.length + ' player' + (players.length === 1 ? "" : "s") + '</span>' +
          (players.length ? '<span class="team-matched">' + matched + ' already in academy</span>' : "") + '</div>' +
        roster +
        (t.note ? '<p class="team-note">' + esc(t.note) + '</p>' : "") +
      '</div>';
    }).join("");
    host.innerHTML = summary + '<div class="team-list">' + cards + '</div>';
  }

  function coachRowHtml(c) {
    c = c || {};
    return '<div class="coach-row">' +
      '<div class="coach-row__top">' +
        '<input class="c-name" value="' + esc(c.name || "") + '" placeholder="Coach name">' +
        '<button type="button" class="btn btn--ghost btn--sm coach-del" aria-label="Remove coach">✕</button></div>' +
      '<div class="field--row coach-row__contact">' +
        '<input class="c-email" type="email" value="' + esc(c.email || "") + '" placeholder="coach@email.com">' +
        '<input class="c-phone" type="tel" value="' + esc(c.phone || "") + '" placeholder="419-555-0100">' +
      '</div></div>';
  }
  function teamForm(t) {
    t = t || {};
    var prog = t.program || "Coed";
    var coachRows = teamCoaches(t); if (!coachRows.length) coachRows = [{}];
    var curAffil = t.affiliation || "prospect";
    var levels = TEAM_LEVELS.map(function (l) { return '<option value="' + l + '"' + (t.level === l ? " selected" : "") + '>' + l + '</option>'; }).join("");
    var affilOpts = AFFIL.map(function (a) { return '<option value="' + a.key + '"' + (curAffil === a.key ? " selected" : "") + '>' + a.label + '</option>'; }).join("");
    return '<form id="teamForm">' +
      '<div class="field"><label for="t-name">Team name</label><input id="t-name" value="' + esc(t.name || "") + '" placeholder="Findlay FC Red, LB Rec 3rd grade…" required></div>' +
      '<div class="field--row">' +
        '<div class="field"><label for="t-level">Level</label><select id="t-level">' + levels + '</select></div>' +
        '<div class="field"><label>Who</label><div class="segfield">' +
          ["Boys", "Girls", "Coed"].map(function (p) { return '<label><input type="radio" name="t-prog" value="' + p + '"' + (prog === p ? " checked" : "") + '><span>' + p + '</span></label>'; }).join("") +
        '</div></div>' +
      '</div>' +
      '<div class="field"><label for="t-age">Age group <span style="font-weight:500;color:var(--ink-3)">(optional)</span></label><input id="t-age" value="' + esc(t.ageGroup || "") + '" placeholder="U10 · 3rd–4th grade"></div>' +
      '<div class="field--row">' +
        '<div class="field"><label for="t-affil">Affiliation</label><select id="t-affil">' + affilOpts + '</select></div>' +
        '<div class="field"><label for="t-clinic">Last clinic <span style="font-weight:500;color:var(--ink-3)">(optional)</span></label><input id="t-clinic" type="date" value="' + esc(t.clinic || "") + '"></div>' +
      '</div>' +
      '<fieldset class="field"><legend>Coaches</legend>' +
        '<div id="coachRows">' + coachRows.map(coachRowHtml).join("") + '</div>' +
        '<button type="button" class="btn btn--ghost btn--sm" id="addCoach"><svg class="ic"><use href="#ic-plus"/></svg>Add another coach</button>' +
      '</fieldset>' +
      '<div class="field"><label for="t-roster">Roster <span style="font-weight:500;color:var(--ink-3)">(one player per line — optionally add a grade: “Jack Smith, 4”)</span></label>' +
        '<textarea id="t-roster" rows="7" placeholder="Jack Smith, 4&#10;Ava Jones, 3&#10;Liam Carter">' + esc(rosterToText(t.players)) + '</textarea></div>' +
      '<div class="field"><label for="t-note">Note <span style="font-weight:500;color:var(--ink-3)">(optional)</span></label><textarea id="t-note" placeholder="Coach open to a joint session · plays Saturdays…">' + esc(t.note || "") + '</textarea></div>' +
      '<div class="drawer__foot">' +
        (t.id ? '<button type="button" class="btn btn--danger" data-action="delete-team" data-id="' + t.id + '">Delete</button>' : "") +
        '<button type="submit" class="btn btn--primary">' + (t.id ? "Save team" : "Add team") + '</button>' +
      '</div></form>';
  }
  function openTeam(t) {
    showDrawer(t ? "Edit coach" : "Add coach", teamForm(t));
    $("#addCoach").addEventListener("click", function () {
      $("#coachRows").insertAdjacentHTML("beforeend", coachRowHtml(null));
      var names = $$("#coachRows .c-name"); if (names.length) names[names.length - 1].focus();
    });
    $("#coachRows").addEventListener("click", function (e) {
      var del = e.target.closest(".coach-del"); if (!del) return;
      var rows = $$("#coachRows .coach-row");
      if (rows.length > 1) del.closest(".coach-row").remove();
      else { var row = del.closest(".coach-row");
        row.querySelector(".c-name").value = ""; row.querySelector(".c-email").value = ""; row.querySelector(".c-phone").value = ""; }
    });
    $("#teamForm").addEventListener("submit", function (sub) {
      sub.preventDefault();
      var name = $("#t-name").value.trim();
      $("#t-name").closest(".field").classList.toggle("field--invalid", !name);
      if (!name) { $("#t-name").focus(); return; }
      var coaches = $$("#coachRows .coach-row").map(function (row) {
        return { name: row.querySelector(".c-name").value.trim(),
          email: row.querySelector(".c-email").value.trim(),
          phone: row.querySelector(".c-phone").value.trim() };
      }).filter(function (c) { return c.name; });
      var data = { name: name, level: $("#t-level").value, program: (document.querySelector('input[name="t-prog"]:checked') || {}).value || "Coed",
        ageGroup: $("#t-age").value.trim(), affiliation: $("#t-affil").value, clinic: $("#t-clinic").value || "",
        coaches: coaches,
        coach: coaches.length ? coaches[0].name : "", coachEmail: coaches.length ? coaches[0].email : "", coachPhone: coaches.length ? coaches[0].phone : "",
        players: parseRoster($("#t-roster").value), note: $("#t-note").value.trim(),
        updated: today() };
      if (t && t.id) { var idx = state.teams.findIndex(function (x) { return x.id === t.id; });
        state.teams[idx] = Object.assign({}, t, data); toast("Saved " + name + "."); }
      else { data.id = uid("tm"); state.teams.push(data); toast("Added " + name + " (" + data.players.length + " players)."); }
      save(); hideDrawer(); renderView();
    });
  }
  function deleteTeam(id) {
    var t = teamById(id); if (!t) return;
    if (!window.confirm("Remove “" + t.name + "”" + (t.coach ? " (coach " + t.coach + ")" : "") + "? (Any players you already imported into Athletes stay.)")) return;
    state.teams = state.teams.filter(function (x) { return x.id !== id; });
    save(); hideDrawer(); renderView(); toast("Coach removed.");
  }
  function importTeam(id) {
    var t = teamById(id); if (!t) return;
    var missing = (t.players || []).filter(function (p) { return p.grade == null && String(p.name || "").trim(); });
    if (missing.length) { promptGrades(t, missing); return; }
    doImportTeam(t);
  }
  // Ask for a grade on any roster player that doesn't have one, then import.
  function promptGrades(t, missing) {
    var rows = missing.map(function (p, i) {
      return '<div class="field grade-row"><label>' + esc(p.name) + '</label><select data-gp="' + i + '">' + gradeOptions(3) + '</select></div>';
    }).join("");
    showDrawer("Set grades — " + t.name, '<form id="gradeForm">' +
      '<p class="cast-note">These players need a grade before they go into Athletes — it sets their graduation-year bucket. Confirm each, then import.</p>' +
      rows +
      '<div class="drawer__foot"><button type="submit" class="btn btn--primary">Set grades &amp; import</button></div></form>');
    $("#gradeForm").addEventListener("submit", function (e) {
      e.preventDefault();
      $$('[data-gp]').forEach(function (sel) { missing[parseInt(sel.dataset.gp, 10)].grade = parseInt(sel.value, 10); });
      save(); hideDrawer(); doImportTeam(t);
    });
  }
  function doImportTeam(t) {
    var prog = t.program === "Girls" ? "Girls" : "Boys";
    var added = 0, skipped = 0;
    (t.players || []).forEach(function (p) {
      var name = String(p.name || "").trim(); if (!name) return;
      var sp = name.indexOf(" ");
      var first = sp > 0 ? name.slice(0, sp) : name, last = sp > 0 ? name.slice(sp + 1).trim() : "";
      var grade = p.grade != null ? p.grade : 3;
      var gy = LB.gradYearFor(grade);
      if (state.athletes.some(function (a) { return a.first.toLowerCase() === first.toLowerCase() && a.last.toLowerCase() === last.toLowerCase() && a.gradYear === gy; })) { skipped++; return; }
      state.athletes.push({ id: uid("a"), first: first, last: last, grade: grade, gradYear: gy, program: prog,
        status: "prospect", sports: ["Soccer"], email: "", phone: "",
        note: "From " + t.name + (t.coach ? " (coach " + t.coach + ")" : ""), updated: today() });
      added++;
    });
    save(); renderView();
    toast(added + " prospect" + (added === 1 ? "" : "s") + " added to Athletes" + (skipped ? ", " + skipped + " already there" : "") + ".");
  }

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

  function renderSchedule() {
    var host = $("#view-schedule");
    var calNote = CALENDAR_ID
      ? '<p class="sched-note">Every event is added to your shared Google Calendar — families who tapped “Add to calendar” see it, and any change, automatically.</p>'
      : '<p class="sched-note sched-note--off">Events save and sync across your devices. To also push them to a calendar families can subscribe to, connect a shared Google Calendar (see setup).</p>';
    if (!state.events.length) {
      host.innerHTML = calNote + '<div class="empty"><img src="../assets/logos/Crest.png" alt="" />' +
        '<h3>No events yet.</h3><p>Add your first date — a preseason coach clinic or a Play-with-the-Eagles showcase. You’ll take attendance against these.</p>' +
        '<div class="empty__actions owner-only"><button class="btn btn--primary" data-action="add-event"><svg class="ic"><use href="#ic-plus"/></svg>Add an event</button></div></div>';
      return;
    }
    var td = today(), evs = eventsSorted();
    var upcoming = evs.filter(function (e) { return e.date >= td; });
    var past = evs.filter(function (e) { return e.date < td; }).reverse();
    function card(e) {
      var att = sessionForEvent(e.id);
      var attN = att ? att.present.length : 0, coachN = allCoaches().length;
      var chips = '<span class="ev-chip ev-chip--prog">' + esc(e.program || "All") + '</span>' +
        (e.tier ? '<span class="ev-chip">' + esc(tierName(e.tier)) + '</span>' : "") +
        (att ? '<span class="ev-chip ev-chip--done"><svg class="ic"><use href="#ic-check"/></svg>' + attN + (coachN ? '/' + coachN : "") + ' coaches</span>' : "");
      return '<div class="ev-card">' +
        '<div class="ev-card__main">' +
          '<div class="ev-when">' + esc(eventWhen(e)) + '</div>' +
          '<h3 class="ev-title">' + esc(e.title) + '</h3>' +
          (e.location ? '<div class="ev-loc">' + esc(e.location) + '</div>' : "") +
          '<div class="ev-chips">' + chips + '</div>' +
          (e.note ? '<p class="ev-note">' + esc(e.note) + '</p>' : "") +
        '</div>' +
        '<div class="ev-card__actions owner-only">' +
          '<button class="btn btn--primary btn--sm" data-action="clinic-attendance" data-id="' + e.id + '"><svg class="ic"><use href="#ic-attend"/></svg>Attendance</button>' +
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
      return '<option value="' + t.key + '"' + (e.tier === t.key ? " selected" : "") + '>' + esc(t.name) + ' (' + esc(t.grades) + ' · ' + esc(t.ages) + ')</option>'; }).join("");
    return '<form id="evForm">' +
      '<div class="field"><label for="e-title">Event name</label><input id="e-title" value="' + esc(e.title || "") + '" placeholder="Fall coach clinic, Spring coach clinic, showcase…" required></div>' +
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
    }).catch(function () {});
  }


  // ================================================================
  //  CLINIC ATTENDANCE — which coaches showed up to each event
  // ================================================================
  function sessionsSorted() { return state.sessions.slice().sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); }); }
  function sessionForEvent(id) { for (var i = 0; i < state.sessions.length; i++) if (state.sessions[i].eventId === id) return state.sessions[i]; return null; }

  // Every coach across every team, flattened into one attendance roster.
  // We key each coach "<coach name>|<team id>" so the name round-trips
  // through the shared Sheet while the team id keeps it unique.
  function allCoaches() {
    var out = [];
    state.teams.forEach(function (t) {
      teamCoaches(t).forEach(function (c) {
        var name = (c.name || "").trim(); if (!name) return;
        out.push({ name: name, teamId: t.id, teamName: t.name, level: t.level || "", program: t.program || "" });
      });
    });
    return out;
  }
  function coachKey(c) { return (c.name + "|" + c.teamId).trim().toLowerCase(); }
  function coachByKey(k) {
    k = String(k).toLowerCase();
    var all = allCoaches();
    for (var i = 0; i < all.length; i++) if (coachKey(all[i]) === k) return all[i];
    return null;
  }
  function coachRoster() { return allCoaches().sort(function (a, b) { return a.name.localeCompare(b.name); }); }

  function openClinicAttendance(eventId) {
    var ev = eventById(eventId); if (!ev) return;
    if (!state.teams.length) {
      showDrawer("Clinic attendance — " + ev.title,
        '<div class="empty empty--mini"><h3>No coaches yet.</h3>' +
        '<p>Add the district’s coaches on the <b>Coaches</b> tab first, then check them in here.</p>' +
        '<div class="drawer__foot"><button type="button" class="btn btn--primary" data-action="goto-coaches">Go to Coaches</button></div></div>');
      return;
    }
    var s = sessionForEvent(eventId);
    var present = {}; if (s) s.present.forEach(function (k) { present[k] = 1; });
    var roster = coachRoster();
    var rows = roster.map(function (c) {
      var k = coachKey(c), on = !!present[k];
      return '<label class="att-check-row' + (on ? " is-on" : "") + '">' +
        '<input type="checkbox" class="clinic-att-box" data-k="' + esc(k) + '"' + (on ? " checked" : "") + '>' +
        '<span class="att-check"><svg class="ic"><use href="#ic-check"/></svg></span>' +
        '<span class="att-who"><span class="att-name">' + esc(c.name) + '</span>' +
          '<span class="att-meta">' + esc(c.teamName) + (c.level ? " · " + esc(c.level) : "") + '</span></span>' +
      '</label>';
    }).join("");
    var syncNote = SIGNUPS_URL ? '<span class="att-sync">Syncs to all your devices</span>' : '<span class="att-sync att-sync--off">This device only — connect the Sheet to sync</span>';
    showDrawer("Clinic attendance — " + ev.title,
      '<form id="clinicAttForm">' +
        '<p class="att-evwhen">' + esc(eventWhen(ev) + (ev.location ? " · " + ev.location : "")) + '</p>' +
        '<div class="att-quick"><button type="button" class="chip" id="clinicAll">All present</button>' +
          '<button type="button" class="chip" id="clinicNone">Clear</button>' +
          '<span class="att-count"><b class="tnum" id="clinicAttN">' + Object.keys(present).length + '</b> of ' + roster.length + ' present</span></div>' +
        '<div class="att-list">' + rows + '</div>' + syncNote +
        '<div class="drawer__foot"><button type="submit" class="btn btn--primary"><svg class="ic"><use href="#ic-check"/></svg>Save attendance</button></div>' +
      '</form>');
    var form = $("#clinicAttForm");
    function refreshCount() { var el = $("#clinicAttN"); if (el) el.textContent = form.querySelectorAll(".clinic-att-box:checked").length; }
    form.addEventListener("change", function (e) {
      if (e.target.classList.contains("clinic-att-box")) { e.target.closest(".att-check-row").classList.toggle("is-on", e.target.checked); refreshCount(); }
    });
    $("#clinicAll").addEventListener("click", function () { $$(".clinic-att-box").forEach(function (b) { b.checked = true; b.closest(".att-check-row").classList.add("is-on"); }); refreshCount(); });
    $("#clinicNone").addEventListener("click", function () { $$(".clinic-att-box").forEach(function (b) { b.checked = false; b.closest(".att-check-row").classList.remove("is-on"); }); refreshCount(); });
    form.addEventListener("submit", function (sub) {
      sub.preventDefault();
      var keys = $$(".clinic-att-box:checked").map(function (b) { return b.dataset.k; });
      var sess = sessionForEvent(eventId);
      if (sess) { sess.present = keys; }
      else { sess = { id: uid("ses"), eventId: eventId, date: ev.date, present: keys }; state.sessions.push(sess); }
      sess.date = ev.date; sess.updated = new Date().toISOString(); sess.unsynced = true;
      save(); pushSession(sess); hideDrawer(); renderView();
      toast(keys.length + " coach" + (keys.length === 1 ? "" : "es") + " marked present for " + ev.title + "." + (SIGNUPS_URL ? " Syncing…" : ""));
    });
  }

  // ---- clinic attendance cross-device sync via the Google Sheet ----
  function pushSession(s) {
    if (!SIGNUPS_URL) return;
    var present = s.present.map(function (k) {
      var c = coachByKey(k);
      if (c) return { name: c.name, gradYear: c.teamId, program: c.program || "" };
      var parts = String(k).split("|"); return { name: parts[0], gradYear: parts[1] || "", program: "" };
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
      Object.keys(sheetByDate).forEach(function (d) {
        var local = byDate[d];
        if (!local || String(sheetByDate[d].updated) >= String(local.updated || "")) byDate[d] = sheetByDate[d];
      });
      state.sessions = Object.keys(byDate).map(function (d) { return byDate[d]; });
      save();
      if (ui.view === "schedule") renderView();
    }).catch(function () {});
  }

  // ================================================================
  //  TRAINING LIBRARY — videos + guides for coaches (shared, synced)
  // ================================================================
  function resById(id) { for (var i = 0; i < state.resources.length; i++) if (state.resources[i].id === id) return state.resources[i]; return null; }
  function filteredResources() {
    var q = (ui.resSearch || "").trim().toLowerCase();
    return state.resources.filter(function (r) {
      if (ui.resType && ui.resType !== "all" && r.type !== ui.resType) return false;
      if (ui.resAge && ui.resAge !== "all" && (r.ages || []).indexOf(ui.resAge) === -1) return false;
      if (ui.resTopic && ui.resTopic !== "all" && (r.topics || []).indexOf(ui.resTopic) === -1) return false;
      if (q) { var hay = (r.title + " " + (r.desc || "") + " " + (r.topics || []).join(" ")).toLowerCase(); if (hay.indexOf(q) === -1) return false; }
      return true;
    }).sort(function (a, b) { return (a.type === "video" ? 0 : 1) - (b.type === "video" ? 0 : 1) || String(a.title).localeCompare(String(b.title)); });
  }
  function resCard(r) {
    var ty = resType(r.type), isVideo = r.type === "video";
    var thumb = resThumb(r), act = isVideo ? "play-resource" : "open-resource";
    var thumbHtml = isVideo
      ? '<div class="res-thumb' + (thumb ? "" : " res-thumb--plain") + '"' + (thumb ? ' style="background-image:url(\'' + esc(thumb) + '\')"' : "") + '>' +
          '<span class="res-play"><svg class="ic"><use href="#ic-play"/></svg></span>' +
          '<span class="res-dur">' + (r.duration ? esc(r.duration) : "Video") + '</span></div>'
      : '<div class="res-thumb res-thumb--doc res-thumb--' + esc(r.type) + '"><svg class="ic res-typeic"><use href="#' + ty.icon + '"/></svg>' +
          '<span class="res-dur">' + esc(ty.label) + (r.duration ? " · " + esc(r.duration) : "") + '</span></div>';
    var ages = (r.ages || []).map(function (a) { var o = resAge(a); return o ? '<span class="res-age res-age--' + esc(a) + '">' + o.label + '</span>' : ""; }).join("");
    var topics = (r.topics || []).slice(0, 3).map(function (t) { return '<span class="res-topic">' + esc(t) + '</span>'; }).join("");
    // Owner-only: how many coaches have opened this material.
    var used = canEdit() ? usageForResource(r.id) : [];
    var usedHtml = canEdit() ? (used.length
      ? '<button type="button" class="res-used" data-action="resource-usage" data-id="' + r.id + '">' +
          '<svg class="ic"><use href="#ic-attend"/></svg>' + used.length + ' coach' + (used.length === 1 ? "" : "es") + ' used this</button>'
      : '<span class="res-used res-used--none">No coaches yet</span>') : "";
    return '<article class="res-card" data-action="' + act + '" data-id="' + r.id + '">' +
      thumbHtml +
      '<div class="res-body">' +
        (ages ? '<div class="res-ages">' + ages + '</div>' : "") +
        '<h3 class="res-title">' + esc(r.title) + '</h3>' +
        (r.desc ? '<p class="res-desc">' + esc(r.desc) + '</p>' : "") +
        (topics ? '<div class="res-topics">' + topics + '</div>' : "") +
        (r.note && /example/i.test(r.note) ? '<p class="res-flag">' + esc(r.note) + '</p>' : "") +
        usedHtml +
        '<div class="res-actions">' +
          '<button class="btn btn--primary btn--sm" data-action="' + act + '" data-id="' + r.id + '"><svg class="ic"><use href="#' + (isVideo ? "ic-play" : "ic-link") + '"/></svg>' + (isVideo ? "Watch" : "Open") + '</button>' +
          '<button class="btn btn--ghost btn--sm owner-only" data-action="edit-resource" data-id="' + r.id + '">Edit</button>' +
        '</div>' +
      '</div></article>';
  }
  function renderTraining() {
    var host = $("#view-training");
    var syncNote = SIGNUPS_URL ? '<span class="att-sync">Shared with every signed-in coach</span>' : '<span class="att-sync att-sync--off">This device only — connect the Sheet to share with coaches</span>';
    if (!state.resources.length) {
      host.innerHTML = '<div class="empty"><img src="../assets/logos/Crest.png" alt="" />' +
        '<h3>Build your coaching library.</h3><p>Collect the videos, drills, and session plans your coaches should use — YouTube &amp; Vimeo links play right here, guides and PDFs open in a tab. Everything you add is shared with every coach.</p>' +
        '<div class="empty__actions owner-only"><button class="btn btn--primary" data-action="add-resource"><svg class="ic"><use href="#ic-plus"/></svg>Add a resource</button>' +
        '<button class="btn btn--ghost" data-action="load-starter-resources">Load the starter library</button></div></div>';
      return;
    }
    var count = state.resources.length, vids = state.resources.filter(function (r) { return r.type === "video"; }).length;
    var activeCoaches = canEdit() ? usageByCoach().length : 0;
    var summary = '<div class="team-summary"><div class="team-stat"><b class="tnum">' + count + '</b> resource' + (count === 1 ? "" : "s") + '</div>' +
      '<div class="team-stat"><b class="tnum">' + vids + '</b> video' + (vids === 1 ? "" : "s") + '</div>' +
      (canEdit() ? '<button class="team-stat team-stat--btn" data-action="coach-activity"><b class="tnum">' + activeCoaches + '</b> coach' + (activeCoaches === 1 ? "" : "es") + ' active</button>' : "") +
      '<p class="team-lede">Everything your coaches need to run the Eagles Way — videos play in-app, guides &amp; plans open in a tab. ' + syncNote + '</p></div>';

    var typeChips = '<div class="filterset">' + [["all", "All"]].concat(RES_TYPES.map(function (t) { return [t.key, t.label]; })).map(function (p) {
      return '<button class="chip' + ((ui.resType || "all") === p[0] ? " is-on" : "") + '" data-action="res-type" data-v="' + esc(p[0]) + '" aria-pressed="' + ((ui.resType || "all") === p[0]) + '">' + esc(p[1]) + '</button>';
    }).join("") + '</div>';
    var ageChips = '<div class="filterset">' + [["all", "All ages"]].concat(RES_AGES.filter(function (a) { return a.key !== "all"; }).map(function (a) { return [a.key, a.label]; })).map(function (p) {
      return '<button class="chip' + ((ui.resAge || "all") === p[0] ? " is-on" : "") + '" data-action="res-age" data-v="' + esc(p[0]) + '" aria-pressed="' + ((ui.resAge || "all") === p[0]) + '">' + esc(p[1]) + '</button>';
    }).join("") + '</div>';
    var topicOpts = '<option value="all">All topics</option>' + RES_TOPICS.map(function (t) { return '<option value="' + esc(t) + '"' + ((ui.resTopic || "all") === t ? " selected" : "") + '>' + esc(t) + '</option>'; }).join("");
    var toolbar = '<div class="res-toolbar">' +
      '<div class="search"><svg class="ic"><use href="#ic-search"/></svg><input type="search" id="resSearch" placeholder="Search title, topic…" value="' + esc(ui.resSearch || "") + '" aria-label="Search resources"></div>' +
      '<select id="resTopic" class="res-topicsel" aria-label="Filter by topic">' + topicOpts + '</select>' +
      '</div><div class="res-filters">' + typeChips + ageChips + '</div>';

    var list = filteredResources();
    var grid = list.length ? '<div class="res-grid">' + list.map(resCard).join("") + '</div>'
      : '<div class="empty empty--mini"><h3>No matches.</h3><p>Nothing fits these filters yet.</p>' +
        '<div class="empty__actions"><button class="btn btn--ghost" data-action="res-type" data-v="all">Clear filters</button></div></div>';

    host.innerHTML = summary + toolbar + grid;
    var s = $("#resSearch");
    if (s) s.addEventListener("input", function () { ui.resSearch = this.value; var pos = this.selectionStart;
      renderTraining(); var s2 = $("#resSearch"); if (s2) { s2.focus(); try { s2.setSelectionRange(pos, pos); } catch (e) {} } });
    var tp = $("#resTopic");
    if (tp) tp.addEventListener("change", function () { ui.resTopic = this.value; renderTraining(); });
  }

  function resourceForm(r) {
    r = r || {};
    var type = r.type || "video";
    var typeSeg = RES_TYPES.map(function (t) { return '<label><input type="radio" name="r-type" value="' + t.key + '"' + (type === t.key ? " checked" : "") + '><span>' + t.label + '</span></label>'; }).join("");
    var ageBoxes = RES_AGES.map(function (a) { return '<label class="res-check"><input type="checkbox" name="r-age" value="' + a.key + '"' + ((r.ages || []).indexOf(a.key) > -1 ? " checked" : "") + '><span>' + a.label + '</span></label>'; }).join("");
    var topicBoxes = RES_TOPICS.map(function (t) { return '<label class="res-check"><input type="checkbox" name="r-topic" value="' + esc(t) + '"' + ((r.topics || []).indexOf(t) > -1 ? " checked" : "") + '><span>' + esc(t) + '</span></label>'; }).join("");
    return '<form id="resForm">' +
      '<div class="field"><label for="r-title">Title</label><input id="r-title" value="' + esc(r.title || "") + '" placeholder="Ball-mastery warmup, Grassroot session plan…" required></div>' +
      '<div class="field"><label>Type</label><div class="segfield segfield--wrap">' + typeSeg + '</div></div>' +
      '<div class="field"><label for="r-url">Link</label><input id="r-url" value="' + esc(r.url || "") + '" placeholder="YouTube / Vimeo link, or a PDF / Google Doc URL" required>' +
        '<p class="cast-hint">YouTube &amp; Vimeo links play inside the dashboard. Anything else opens in a new tab.</p></div>' +
      '<div class="field"><label for="r-dur">Length <span style="font-weight:500;color:var(--ink-3)">(optional)</span></label><input id="r-dur" value="' + esc(r.duration || "") + '" placeholder="6 min · 1 page"></div>' +
      '<fieldset class="field"><legend>Age groups</legend><div class="res-checks">' + ageBoxes + '</div></fieldset>' +
      '<fieldset class="field"><legend>Topics</legend><div class="res-checks">' + topicBoxes + '</div></fieldset>' +
      '<div class="field"><label for="r-desc">Description <span style="font-weight:500;color:var(--ink-3)">(optional)</span></label><textarea id="r-desc" placeholder="What it covers and how to use it…">' + esc(r.desc || "") + '</textarea></div>' +
      '<div class="drawer__foot">' +
        (r.id ? '<button type="button" class="btn btn--danger" data-action="delete-resource" data-id="' + r.id + '">Delete</button>' : "") +
        '<button type="submit" class="btn btn--primary">' + (r.id ? "Save resource" : "Add resource") + '</button>' +
      '</div></form>';
  }
  function openResource(r) {
    showDrawer(r ? "Edit resource" : "Add resource", resourceForm(r));
    $("#resForm").addEventListener("submit", function (sub) {
      sub.preventDefault();
      var title = $("#r-title").value.trim(), url = $("#r-url").value.trim();
      $("#r-title").closest(".field").classList.toggle("field--invalid", !title);
      $("#r-url").closest(".field").classList.toggle("field--invalid", !url);
      if (!title || !url) { $(!title ? "#r-title" : "#r-url").focus(); return; }
      var type = (document.querySelector('input[name="r-type"]:checked') || {}).value || "video";
      var ages = $$('input[name="r-age"]:checked').map(function (c) { return c.value; });
      var topics = $$('input[name="r-topic"]:checked').map(function (c) { return c.value; });
      var data = { title: title, type: type, url: url, duration: $("#r-dur").value.trim(),
        ages: ages, topics: topics, desc: $("#r-desc").value.trim(), note: (r && r.note) || "",
        updated: new Date().toISOString(), unsynced: true };
      var rec;
      if (r && r.id) { var idx = state.resources.findIndex(function (x) { return x.id === r.id; });
        rec = Object.assign({}, r, data); state.resources[idx] = rec; toast("Saved “" + title + ".”"); }
      else { data.id = uid("res"); rec = data; state.resources.push(rec); toast("Added “" + title + ".”"); }
      save(); pushResource(rec); hideDrawer(); renderView();
    });
  }
  function deleteResource(id) {
    var r = resById(id); if (!r) return;
    if (!window.confirm("Delete “" + r.title + "” from the library?")) return;
    state.resources = state.resources.filter(function (x) { return x.id !== id; });
    save(); pushResourceDelete(r); hideDrawer(); renderView(); toast("Resource removed.");
  }
  function loadStarterResources() {
    var added = 0;
    STARTER_RESOURCES.forEach(function (s) {
      if (state.resources.some(function (x) { return x.title === s.title; })) return;
      var rec = Object.assign({}, s, { id: uid("res"), ages: s.ages.slice(), topics: s.topics.slice(), updated: new Date().toISOString(), unsynced: true });
      state.resources.push(rec); pushResource(rec); added++;
    });
    save(); renderView();
    toast(added + " starter resource" + (added === 1 ? "" : "s") + " added.");
  }

  // ---- video / resource player ----
  function openPlayer(r) {
    if (!r) return;
    var emb = resEmbed(r.url || "");
    if (!emb) { if (r.url) window.open(r.url, "_blank", "noopener"); return; }   // not embeddable -> open the link
    $("#playerTitle").textContent = r.title || "Video";
    $("#playerExt").href = r.url || "#";
    $("#playerFrame").innerHTML = '<iframe src="' + esc(emb) + '" title="' + esc(r.title || "Video") + '" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    var p = $("#player"); p.hidden = false; requestAnimationFrame(function () { p.classList.add("is-open"); });
  }
  function closePlayer() { var p = $("#player"); if (!p || p.hidden) return; p.classList.remove("is-open");
    setTimeout(function () { p.hidden = true; $("#playerFrame").innerHTML = ""; }, 200); }

  // ---- resources cross-device sync via the Sheet ----
  function pushResource(r) {
    if (!SIGNUPS_URL || !r) return;
    apiPost({ type: "resource", id: r.id, title: r.title, kind: r.type, ages: (r.ages || []).join(","),
      topics: (r.topics || []).join(","), url: r.url, duration: r.duration, desc: r.desc, note: r.note, updated: r.updated })
      .then(function () { delete r.unsynced; save(); }).catch(function () {});
  }
  function pushResourceDelete(r) { if (!SIGNUPS_URL || !r) return; apiPost({ type: "resource-delete", id: r.id }).catch(function () {}); }
  function syncResources(quiet) {
    if (!SIGNUPS_URL || (AUTH.enabled && !AUTH.ready)) return;
    state.resources.forEach(function (r) { if (r.unsynced) pushResource(r); });
    apiGet().then(function (data) {
      if (data && data.error === "auth") { relock("Session expired — sign in again."); return; }
      if (!data || !data.resources) return;
      var splitList = function (s) { return String(s || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); };
      var byId = {}; state.resources.forEach(function (r) { byId[r.id] = r; });
      data.resources.forEach(function (row) {
        if (!row.id) return;
        var local = byId[row.id];
        var remote = { id: row.id, title: row.title || "", type: row.type || "video", url: row.url || "",
          duration: row.duration || "", ages: splitList(row.ages), topics: splitList(row.topics),
          desc: row.desc || "", note: row.note || "", updated: String(row.updated || "") };
        if (!local) byId[row.id] = remote;
        else if (!local.unsynced && String(remote.updated) >= String(local.updated || "")) byId[row.id] = Object.assign(local, remote);
      });
      state.resources = Object.keys(byId).map(function (id) { return byId[id]; });
      save();
      if (ui.view === "training") renderView();
    }).catch(function () {});
  }

  // ================================================================
  //  TRAINING USE — which coaches open which materials
  //  A signed-in coach opening/watching a resource logs a row to the
  //  Sheet (allowed even for view-only coaches). Only the owner reads
  //  the log back. Usage is keyed to the coach's Google account.
  // ================================================================
  function logUsage(r, action) {
    if (!SIGNUPS_URL || !r) return;
    if (AUTH.enabled && !AUTH.ready) return;
    apiPost({ type: "usage", resourceId: r.id, title: r.title, kind: r.type, action: action || "open",
      coachName: AUTH.name || "", email: AUTH.email || "", ts: Date.now() });
  }
  function syncUsage(quiet) {
    if (!SIGNUPS_URL || (AUTH.enabled && !AUTH.ready)) return;
    if (AUTH.enabled && !AUTH.owner) return;                 // only the owner pulls the activity log
    apiGet().then(function (data) {
      if (data && data.error === "auth") { relock("Session expired — sign in again."); return; }
      if (!data || !data.usage) return;
      state.usage = data.usage; save();
      if (ui.view === "training") renderView();
    }).catch(function () {});
  }
  function usageKey(u) { return String(u.email || u.coach || "").trim().toLowerCase(); }
  function fmtStamp(ts) {
    var x = new Date(Number(ts)); if (!Number(ts) || isNaN(x)) return "";
    var h = x.getHours(), m = x.getMinutes(), ap = h < 12 ? "AM" : "PM", h12 = h % 12 || 12;
    return ATT_MON[x.getMonth()] + " " + x.getDate() + ", " + h12 + ":" + String(m).padStart(2, "0") + " " + ap;
  }
  // Distinct coaches who have opened one material, most-recent first.
  function usageForResource(id) {
    var by = {};
    (state.usage || []).forEach(function (u) {
      if (String(u.resourceId) !== String(id)) return;
      var k = usageKey(u); if (!k) return;
      if (!by[k] || u.ts > by[k].ts) by[k] = { coach: u.coach || u.email, email: u.email, ts: u.ts };
    });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.ts - a.ts; });
  }
  // Each coach with the distinct materials they've opened, most-recent first.
  function usageByCoach() {
    var by = {};
    (state.usage || []).forEach(function (u) {
      var k = usageKey(u); if (!k) return;
      if (!by[k]) by[k] = { coach: u.coach || u.email, email: u.email, last: 0, res: {} };
      var g = by[k]; if (u.coach) g.coach = u.coach; if (u.ts > g.last) g.last = u.ts;
      var rk = String(u.resourceId);
      if (!g.res[rk] || u.ts > g.res[rk].ts) g.res[rk] = { resourceId: rk, title: u.title, type: u.type, ts: u.ts };
    });
    return Object.keys(by).map(function (k) {
      var g = by[k];
      g.items = Object.keys(g.res).map(function (r) { return g.res[r]; }).sort(function (a, b) { return b.ts - a.ts; });
      g.count = g.items.length; return g;
    }).sort(function (a, b) { return b.last - a.last; });
  }
  function openResourceUsage(id) {
    var r = resById(id); if (!r) return;
    var used = usageForResource(id);
    var rows = used.length ? used.map(function (u) {
      return '<li class="use-row"><span class="use-row__who"><span class="use-name">' + esc(u.coach || u.email) + '</span>' +
        (u.email && u.coach && u.email.toLowerCase() !== String(u.coach).toLowerCase() ? '<span class="use-mail">' + esc(u.email) + '</span>' : "") +
        '</span><span class="use-when">' + esc(fmtStamp(u.ts)) + '</span></li>';
    }).join("") : '<li class="use-empty">No coach has opened this yet.</li>';
    showDrawer("Who's used this",
      '<div class="use-head"><h3 class="use-h3">' + esc(r.title) + '</h3>' +
      '<p class="cast-note">' + used.length + ' coach' + (used.length === 1 ? "" : "es") + ' opened this material. Most recent first.</p></div>' +
      '<ul class="use-list">' + rows + '</ul>');
  }
  function openCoachActivity() {
    var coaches = usageByCoach();
    var total = (state.usage || []).length;
    var body;
    if (!coaches.length) {
      body = '<div class="empty empty--mini"><h3>No activity yet.</h3>' +
        '<p>When a coach signs in and opens a video or guide from the library, it shows up here — so you can see who’s using what.</p></div>';
    } else {
      body = '<p class="cast-note">' + coaches.length + ' coach' + (coaches.length === 1 ? "" : "es") + ' active · ' + total + ' open' + (total === 1 ? "" : "s") + ' logged. Most recent first.</p>' +
        '<div class="use-coaches">' + coaches.map(function (g) {
          var items = g.items.map(function (it) {
            return '<li class="use-item"><span class="use-item__t">' + esc(it.title || "(untitled)") + '</span>' +
              '<span class="use-item__meta">' + esc((it.type || "") + (it.ts ? " · " + fmtStamp(it.ts) : "")) + '</span></li>';
          }).join("");
          return '<div class="use-coach"><div class="use-coach__head">' +
            '<span class="use-coach__name">' + esc(g.coach || g.email) + '</span>' +
            '<span class="use-coach__n">' + g.count + ' material' + (g.count === 1 ? "" : "s") + '</span></div>' +
            '<div class="use-coach__mail">' + (g.email ? esc(g.email) + ' · ' : "") + 'last ' + esc(fmtStamp(g.last)) + '</div>' +
            '<ul class="use-items">' + items + '</ul></div>';
        }).join("") + '</div>' +
        '<p class="cast-hint">Activity is keyed to each coach’s signed-in Google account.</p>';
    }
    showDrawer("Coach activity", body);
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
  function shirtOptions(sel) {
    return '<option value="">—</option>' + SHIRT_SIZES.map(function (s) { return '<option value="' + s + '"' + (sel === s ? " selected" : "") + '>' + s + '</option>'; }).join("");
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
      '<div class="field--row">' +
        '<div class="field"><label for="f-sports">Sports <span style="font-weight:500;color:var(--ink-3)">(comma-separated)</span></label>' +
          '<input id="f-sports" value="' + esc((a.sports || []).join(", ")) + '" placeholder="Soccer, Basketball…"></div>' +
        '<div class="field field--narrow"><label for="f-shirt">Shirt size</label><select id="f-shirt">' + shirtOptions(a.shirt) + '</select></div>' +
      '</div>' +
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
      var shirt = $("#f-shirt").value;
      var note = $("#f-note").value.trim();
      if (a && a.id) {
        var idx = state.athletes.findIndex(function (x) { return x.id === a.id; });
        state.athletes[idx] = Object.assign({}, a, { first: first, last: last, grade: grade, gradYear: LB.gradYearFor(grade), program: prog, status: status, sports: sports, email: email, phone: phone, shirt: shirt, note: note, updated: today() });
        toast("Saved " + first + " " + last + ".");
      } else {
        state.athletes.push({ id: uid("a"), first: first, last: last, grade: grade, gradYear: LB.gradYearFor(grade), program: prog, status: status, sports: sports, email: email, phone: phone, shirt: shirt, note: note, updated: today() });
        toast("Added " + first + " " + last + " to the map.");
      }
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
      shirt: String(s.shirt || ""), note: String(s.note || ""), updated: today() };
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
      '<p class="cast-hint">It maps each sign-up to an athlete (name, graduation class, Boys/Girls, other sports), marks them Active, and never imports the same kid twice.</p>' +
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
  // Non-mutating actions a view-only coach is still allowed to trigger.
  var VIEW_ACTIONS = { "res-type": 1, "res-age": 1, "filter-status": 1, "filter-grad": 1,
    "clear-filters": 1, "play-resource": 1, "open-resource": 1, "close-player": 1,
    "close-drawer": 1, "goto-coaches": 1, "sign-out": 1 };
  document.addEventListener("click", function (e) {
    var nav = e.target.closest(".side__link"); if (nav) { setView(nav.dataset.view); return; }
    var seg = e.target.closest("#progSeg button"); if (seg) { ui.prog = seg.dataset.prog;
      $$("#progSeg button").forEach(function (b) { b.setAttribute("aria-pressed", String(b === seg)); }); renderView(); return; }
    var act = e.target.closest("[data-action]"); if (!act) { closePop(); return; }
    var action = act.dataset.action, id = act.dataset.id;
    // View-only coaches may browse and open the calendar/videos, but not change anything.
    if (!canEdit() && !VIEW_ACTIONS[action]) { toast("View only — only the owner can make changes."); return; }
    switch (action) {
      case "add-athlete": openAthlete(null); break;
      case "edit": openAthlete(state.athletes.find(function (x) { return x.id === id; })); break;
      case "delete-athlete": state.athletes = state.athletes.filter(function (x) { return x.id !== id; }); save(); hideDrawer(); renderView(); toast("Athlete removed."); break;
      case "add-team": openTeam(null); break;
      case "edit-team": openTeam(teamById(id)); break;
      case "delete-team": deleteTeam(id); break;
      case "import-team": importTeam(id); break;
      case "add-resource": openResource(null); break;
      case "edit-resource": openResource(resById(id)); break;
      case "delete-resource": deleteResource(id); break;
      case "play-resource": logUsage(resById(id), "watch"); openPlayer(resById(id)); break;
      case "open-resource": var rr = resById(id); if (rr && rr.url) { window.open(rr.url, "_blank", "noopener"); logUsage(rr, "open"); } break;
      case "resource-usage": openResourceUsage(id); break;
      case "coach-activity": openCoachActivity(); break;
      case "load-starter-resources": loadStarterResources(); break;
      case "res-type": ui.resType = act.dataset.v; if (act.dataset.v === "all") { ui.resAge = "all"; ui.resTopic = "all"; ui.resSearch = ""; } renderTraining(); break;
      case "res-age": ui.resAge = act.dataset.v; renderTraining(); break;
      case "close-player": closePlayer(); break;
      case "reached": setStatus(id, "active"); break;
      case "status": e.stopPropagation(); openStatusPop(act, id); break;
      case "filter-status": ui.status = act.dataset.status; renderAthletes(); break;
      case "filter-grad": ui.grad = act.dataset.grad; renderAthletes(); break;
      case "clear-filters": ui.status = "all"; ui.grad = "all"; ui.search = ""; renderAthletes(); break;
      case "add-event": openEvent(null); break;
      case "edit-event": openEvent(eventById(id)); break;
      case "delete-event": deleteEvent(id); break;
      case "clinic-attendance": openClinicAttendance(id); break;
      case "goto-coaches": hideDrawer(); setView("teams"); break;
      case "settings": openSettings(); break;
      case "broadcast": openBroadcast(); break;
      case "sync-signups": syncSignups(false); break;
      case "manage-access": openAccess(); break;
      case "sign-out": signOut(); break;
      case "close-drawer": hideDrawer(); break;
      case "load-sample": loadSample(); break;
      case "clear": clearAll(); break;
    }
  });
  function loadSample() {
    state = JSON.parse(JSON.stringify(LB.SAMPLE)); state.seeded = true;
    state.sessions = state.sessions || []; state.phasesDone = state.phasesDone || []; state.events = state.events || []; state.finances = state.finances || []; state.teams = state.teams || []; state.resources = state.resources || [];
    save(); renderView();
    toast("Sample roster loaded.");
  }
  function clearAll() {
    if (!window.confirm("Clear all athletes, plan progress, and numbers? This can't be undone.")) return;
    state = blank(); save(); renderView(); toast("All data cleared.");
  }

  $("#burger").addEventListener("click", function () {
    if ($("#sidebar").classList.contains("is-open")) closeSidebar(); else openSidebar();
  });
  var authOther = $("#authOther"); if (authOther) authOther.addEventListener("click", signOut);
  $("#drawerClose").addEventListener("click", hideDrawer);
  $("#scrim").addEventListener("click", function () { hideDrawer(); closeSidebar(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closePop(); closePlayer(); if ($("#drawer") && !$("#drawer").hidden) hideDrawer(); closeSidebar(); } });
  window.addEventListener("scroll", closePop, { passive: true });
  window.addEventListener("resize", closePop);

  // ---- boot --------------------------------------------------------
  renderTopbar();
  renderView();
  initAuth();   // gate the dashboard; runBootSyncs() pulls sign-ups + attendance + events once approved
})();
