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
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); };
  var money = function (n) { return "$" + Number(n || 0).toLocaleString("en-US"); };

  var SETTINGS_DEFAULT = { districtAthletes: 240 };
  var SPONSOR_GOAL = 3000;

  // ---- state -------------------------------------------------------
  var state, ui = { view: "overview", prog: "all", search: "", status: "all", grad: "all" };

  function blank() { return { athletes: [], sponsors: [], phasesDone: [], settings: Object.assign({}, SETTINGS_DEFAULT), seeded: false }; }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) { var d = JSON.parse(raw);
      d.settings = Object.assign({}, SETTINGS_DEFAULT, d.settings || {}); d.athletes = d.athletes || [];
      d.sponsors = d.sponsors || []; d.phasesDone = d.phasesDone || []; return d; } }
    catch (e) {}
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function uid(p) { return (p || "x") + "-" + Math.abs((Date.now() ^ (idSeed++ * 2654435761)) >>> 0).toString(36); }
  var idSeed = 1;

  state = load();

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
    plan: { title: "The 360-Day Plan", sub: "Twelve phases from first conversation to year two." },
    sponsors: { title: "Sponsors", sub: "Who funds “Every Kid Plays.”" }
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
    } else if (ui.view === "sponsors") {
      slot.innerHTML = '<button class="btn btn--primary" data-action="add-sponsor"><svg class="ic"><use href="#ic-plus"/></svg>Add sponsor</button>';
    }
  }
  function setView(v) {
    ui.view = v;
    $$(".side__link").forEach(function (b) { b.setAttribute("aria-current", String(b.dataset.view === v)); });
    $$(".view").forEach(function (s) { s.classList.remove("is-active"); });
    $("#view-" + v).classList.add("is-active");
    closeSidebar();
    renderTopbar(); renderView();
    $("#view-" + v).focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  function renderView() {
    if (ui.view === "overview") renderOverview();
    else if (ui.view === "athletes") renderAthletes();
    else if (ui.view === "plan") renderPlan();
    else if (ui.view === "sponsors") renderSponsors();
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
          (a.sports && a.sports.length ? '<span class="who__sports">' + esc(a.sports.join(", ")) + '</span>' : "") + '</span></div></td>' +
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
  //  SPONSORS
  // ================================================================
  function renderSponsors() {
    var host = $("#view-sponsors");
    var total = state.sponsors.reduce(function (s, x) { return s + (Number(x.amount) || 0); }, 0);
    var summary = '<div class="spon-summary">' +
      '<div class="spon-total"><div class="n tnum">' + money(total) + '</div><div class="l">raised from ' + state.sponsors.length + ' sponsor' + (state.sponsors.length === 1 ? "" : "s") + '</div>' +
        '<div class="goal">Goal ' + money(SPONSOR_GOAL) + ' · keeps the year free for families</div></div>' +
      '</div>';

    if (!state.sponsors.length) {
      host.innerHTML = summary + '<div class="empty"><img src="assets/logos/Eagle Head.png" alt="" />' +
        '<h3>No sponsors yet.</h3><p>Local businesses fund the gear and field costs that keep it free. Add your first.</p>' +
        '<div class="empty__actions"><button class="btn btn--primary" data-action="add-sponsor"><svg class="ic"><use href="#ic-plus"/></svg>Add a sponsor</button>' +
        '<button class="btn btn--ghost" data-action="load-sample">Load sample data</button></div></div>';
      return;
    }
    var sorted = state.sponsors.slice().sort(function (a, b) { return (b.amount || 0) - (a.amount || 0); });
    var rows = sorted.map(function (s) {
      return '<tr data-action="edit-sponsor" data-id="' + s.id + '">' +
        '<td><button type="button" class="who__name" data-action="edit-sponsor" data-id="' + s.id + '">' + esc(s.name) + '</button>' + (s.note ? '<div class="who__sports" style="text-transform:none;font-weight:500">' + esc(s.note) + '</div>' : "") + '</td>' +
        '<td class="tnum" style="font-weight:700">' + (s.amount ? money(s.amount) : "In-kind") + '</td></tr>';
    }).join("");
    host.innerHTML = summary + '<div class="tablewrap"><table class="roster"><thead><tr><th>Sponsor</th><th>Amount</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
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
    if (!quiet) toast("Checking for new sign-ups…");
    fetch(SIGNUPS_URL, { method: "GET" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
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
      case "add-sponsor": openSponsor(null); break;
      case "edit-sponsor": openSponsor(state.sponsors.find(function (x) { return x.id === id; })); break;
      case "delete-sponsor": state.sponsors = state.sponsors.filter(function (x) { return x.id !== id; }); save(); hideDrawer(); renderView(); toast("Sponsor removed."); break;
      case "settings": openSettings(); break;
      case "broadcast": openBroadcast(); break;
      case "sync-signups": syncSignups(false); break;
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
    state = JSON.parse(JSON.stringify(LB.SAMPLE)); state.seeded = true; save(); renderView();
    toast("Sample roster loaded.");
  }
  function clearAll() {
    if (!window.confirm("Clear all athletes, sponsors, plan progress, and numbers? This can't be undone.")) return;
    state = blank(); save(); renderView(); toast("All data cleared.");
  }

  $("#burger").addEventListener("click", function () {
    if ($("#sidebar").classList.contains("is-open")) closeSidebar(); else openSidebar();
  });
  $("#drawerClose").addEventListener("click", hideDrawer);
  $("#scrim").addEventListener("click", function () { hideDrawer(); closeSidebar(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closePop(); if ($("#drawer") && !$("#drawer").hidden) hideDrawer(); closeSidebar(); } });
  window.addEventListener("scroll", closePop, { passive: true });
  window.addEventListener("resize", closePop);

  // ---- boot --------------------------------------------------------
  renderTopbar();
  renderView();
  if (SIGNUPS_URL) syncSignups(true);   // quietly pull any new sign-ups on load
})();
