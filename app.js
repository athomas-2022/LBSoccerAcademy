/* ============================================================
   THE LB SOCCER ACADEMY — public site behavior
   Progressive enhancement: content is fully visible without JS.
   ============================================================ */
(function () {
  "use strict";

  // ---- Backend hook -------------------------------------------------
  // Paste your Google Apps Script Web-app URL here (ends in /exec) to send
  // every signup straight into your Google Sheet — auto-logged, auto-welcomed,
  // ready for one-click messaging. See integrations/google-apps-script.gs.
  // Leave "" to fall back to a pre-filled email to the office (zero backend).
  var FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycby68vlCB8FhoyOk03A5Yam4f1Vhwumm8rqSPz8bAw26Tk2UUH1mLwwy0MvnLl7-YQD5/exec";
  var CONTACT_EMAIL = "athomas@Liberty-Benton.org";

  // ---- Shared season calendar --------------------------------------
  // The "Add to calendar" button subscribes people to the Academy's shared
  // Google Calendar, so any date you add or change syncs to their phone.
  // Paste the public calendar's **Calendar ID** here (from Google Calendar →
  // Settings → Integrate calendar). Leave "" to hide the button.
  // Looks like:  abc123...@group.calendar.google.com
  var GOOGLE_CALENDAR_ID = "c_a280d4cafbf4f9838c8141178df7d56c29221939f94bf2b1810d6c5426f8490c@group.calendar.google.com";

  // ---- Text + email alerts (Remind) --------------------------------
  // Families join once and get session reminders + urgent weather/cancellation
  // alerts by text AND email — no app to download.
  // Set up a free class at remind.com, then paste its join link + code below.
  //   REMIND_JOIN_URL: the class join link (e.g. "https://www.remind.com/join/abcde")
  //   REMIND_CLASS_CODE: the text-to-join code without the @ (e.g. "lbsoccer")
  // Leave both "" and the button falls back to emailing the office.
  var REMIND_JOIN_URL = "https://www.remind.com/join/6ee4bkk";
  var REMIND_CLASS_CODE = "6ee4bkk";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  document.documentElement.classList.add("js");

  // ---- Footer year --------------------------------------------------
  var yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ---- Mobile nav ---------------------------------------------------
  var toggle = $("#navToggle");
  var mobileNav = $("#mobileNav");
  if (toggle && mobileNav) {
    var setNav = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      if (open) { mobileNav.hidden = false; }
      else { mobileNav.hidden = true; }
      document.body.style.overflow = open ? "hidden" : "";
    };
    toggle.addEventListener("click", function () {
      setNav(toggle.getAttribute("aria-expanded") !== "true");
    });
    $$("a", mobileNav).forEach(function (a) {
      a.addEventListener("click", function () { setNav(false); });
    });
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setNav(false); toggle.focus();
      }
    });
  }

  // ---- Header elevation on scroll ----------------------------------
  var header = $("#siteHeader");
  if (header) {
    var onScroll = function () {
      header.setAttribute("data-elevated", window.scrollY > 24 ? "true" : "false");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ---- Scroll reveals (never gate content; add class then observe) --
  if (!reduceMotion && "IntersectionObserver" in window) {
    var revealTargets = [];
    var add = function (sel, stagger) {
      $$(sel).forEach(function (el, i) {
        el.classList.add("reveal");
        if (stagger) el.setAttribute("data-delay", String(Math.min(i + 1, 4)));
        revealTargets.push(el);
      });
    };
    add(".triad__item", true);
    add(".rung", true);
    add(".keepadd", true);
    add(".fit", true);
    add(".std", true);
    add(".tier", true);
    add(".stat", true);
    add(".section-title", false);
    add(".section-lede", false);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revealTargets.forEach(function (el) { io.observe(el); });
  }

  // ---- Stat count-up ------------------------------------------------
  var counted = false;
  var runCounts = function () {
    if (counted) return; counted = true;
    $$(".stat__num[data-count]").forEach(function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var prefix = el.getAttribute("data-prefix") || "";
      var suffix = el.getAttribute("data-suffix") || "";
      if (reduceMotion || isNaN(target)) { el.textContent = prefix + target + suffix; return; }
      var start = null, dur = 1200;
      var step = function (ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  };
  var statsSection = $(".why__stats");
  if (statsSection && "IntersectionObserver" in window) {
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { runCounts(); sio.disconnect(); } });
    }, { threshold: 0.3 });
    sio.observe(statsSection);
  } else { runCounts(); }

  // ---- Register form ------------------------------------------------
  var form = $("#regForm");

  // Keep the graduation-class list current every year (static HTML is the
  // no-JS fallback; this rebuilds it based on the actual school year).
  var gradSel = $("#gradClass");
  if (gradSel) {
    var fallYear = new Date().getFullYear();        // the upcoming/current fall
    var seniorClass = fallYear + 1;                 // 12th graders this fall
    var levels = [
      "Pre-K", "Kindergarten", "1st grade", "2nd grade", "3rd grade",
      "4th grade", "5th grade", "6th grade", "7th grade", "8th grade",
      "9th grade", "10th grade", "11th grade", "12th grade"
    ];
    var opts = ['<option value="" selected disabled>Select…</option>'];
    for (var g = -1; g <= 12; g++) {
      var cls = seniorClass + (12 - g);
      opts.push("<option>Class of " + cls + " (" + levels[g + 1] + ")</option>");
    }
    gradSel.innerHTML = opts.join("");
  }
  var statusEl = $("#regStatus");
  var submitBtn = $("#regSubmit");

  // Role toggle: parent-only fields appear only when "A parent" is chosen.
  function syncRole() {
    if (!form) return;
    var r = (form.querySelector('input[name="role"]:checked') || {}).value || "";
    $$("[data-role-only]", form).forEach(function (el) {
      el.hidden = el.getAttribute("data-role-only") !== r;
    });
  }
  if (form) {
    $$('input[name="role"]', form).forEach(function (r) { r.addEventListener("change", syncRole); });
    syncRole();
  }

  var setStatus = function (msg, kind) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    if (kind) statusEl.setAttribute("data-kind", kind); else statusEl.removeAttribute("data-kind");
  };

  var markField = function (input, invalid) {
    var wrap = input.closest(".field") || input.closest("fieldset");
    if (!wrap) return;
    wrap.classList.toggle("field--invalid", invalid);
    var err = wrap.querySelector(".field__error");
    if (invalid && !err) {
      err = document.createElement("p");
      err.className = "field__error";
      err.textContent = "Please fill this in.";
      wrap.appendChild(err);
    } else if (!invalid && err) { err.remove(); }
  };

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setStatus("", null);

      var required = [
        form.querySelector("#parentName"),
        form.querySelector("#email"),
        form.querySelector("#phone")
      ];
      var firstBad = null;
      required.forEach(function (input) {
        var bad = !input.value.trim();
        markField(input, bad);
        if (bad && !firstBad) firstBad = input;
      });
      var role = form.querySelector('input[name="role"]:checked');
      if (!role) {
        markField(form.querySelector('input[name="role"]'), true);
        if (!firstBad) firstBad = form.querySelector('input[name="role"]');
      } else {
        markField(form.querySelector('input[name="role"]'), false);
      }

      if (firstBad) {
        setStatus("Just a couple fields left — highlighted above.", "err");
        firstBad.focus();
        return;
      }

      var program = form.querySelector('input[name="program"]:checked');
      var data = {
        role: role.value,
        parentName: form.parentName.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        alerts: true,                 // every signup is enrolled in text + email alerts
        team: form.team.value.trim(),
        childName: form.childName.value.trim(),
        gradClass: form.gradClass.value,
        program: program ? program.value : "",
        shirt: form.shirt.value,
        sports: "",
        note: form.note.value.trim()
      };

      if (FORM_ENDPOINT) {
        submitBtn.disabled = true;
        setStatus("Sending…", null);
        // Apps Script Web apps don't send CORS headers, so we post as a "simple"
        // request (text/plain, no-cors). The response is opaque — if the fetch
        // resolves, the signup went through; a network error falls back to email.
        fetch(FORM_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(data)
        }).then(function () {
          form.reset(); syncRole();
          setStatus("You're in! We'll be in touch soon. Go Eagles!", "ok");
          showJoinStep();
        }).catch(function () {
          openMailto(data);
          setStatus("Opened an email draft — just hit send.", "ok");
          showJoinStep();
        }).finally(function () { submitBtn.disabled = false; });
      } else {
        openMailto(data);
        setStatus("Opened an email draft — just hit send.", "ok");
        showJoinStep();
      }
    });
  }

  // After a signup, surface the one-tap Remind join so alerts turn on right away.
  function showJoinStep() {
    var wrap = $("#regJoin"), btn = $("#regJoinBtn");
    if (!wrap || !btn) return;
    var url = (REMIND_JOIN_URL || "").trim();
    if (!url) return;                          // no alert channel connected yet
    btn.href = url;
    wrap.hidden = false;
    wrap.scrollIntoView({ behavior: "smooth", block: "center" });
    btn.focus();
  }

  function openMailto(d) {
    var role = d.role || "";
    var subject, lines;
    if (role === "Sponsor / partner") {
      subject = "LB Soccer Academy — sponsorship interest";
      lines = ["Hi — I'd like to help keep the program free.", "",
        "Name: " + d.parentName, "Email: " + d.email,
        d.phone ? "Phone: " + d.phone : "",
        d.team ? "Business: " + d.team : "",
        d.note ? "Note: " + d.note : "", "", "Thanks!"];
    } else if (role === "Coach") {
      subject = "LB Soccer Academy — Eagles-Affiliated Coach interest";
      lines = ["Hi — I'd like to become an Eagles-Affiliated Coach.", "",
        "Name: " + d.parentName, "Email: " + d.email, "Mobile: " + d.phone,
        d.team ? "Team I coach: " + d.team : "",
        "Add me to clinic + alert messages: yes",
        d.note ? "Notes: " + d.note : "", "", "Thank you!"];
    } else {
      subject = "LB Soccer Academy signup — " + (d.childName || d.parentName);
      lines = ["Hi — I'd like to get my kid the Eagles Way.", "",
        d.childName ? "Child: " + d.childName : "",
        d.gradClass ? "Graduation class: " + d.gradClass : "",
        d.program ? "Program: " + d.program : "",
        d.team ? "Their team: " + d.team : "",
        d.shirt ? "Shirt size: " + d.shirt : "",
        "Parent/guardian: " + d.parentName, "Email: " + d.email,
        "Mobile: " + d.phone, "Add us to clinic + alert messages: yes",
        d.note ? "Notes: " + d.note : "", "", "Thank you!"];
    }
    var body = lines.filter(function (l) { return l !== ""; }).join("\n");
    var gmail = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(CONTACT_EMAIL) +
      "&su=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    var win = window.open(gmail, "_blank", "noopener");
    // Fallback to the OS mail handler if the popup was blocked
    if (!win) window.location.href = "mailto:" + CONTACT_EMAIL +
      "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  // ---- Season calendar: one "Add to calendar" button ---------------
  (function calendar() {
    var btn = $("#calGoogle");
    if (!btn) return;
    var id = (GOOGLE_CALENDAR_ID || "").trim();
    if (!id) { btn.hidden = true; return; }        // no calendar connected yet
    // Google subscribe link — adds the shared calendar so future changes sync.
    btn.href = "https://calendar.google.com/calendar/u/0/r?cid=" + encodeURIComponent(id);
  })();
})();
