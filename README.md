# The LB Soccer Academy — public site + coach dashboard

Two zero-build static apps: plain HTML, CSS and ES5 JavaScript. No framework, no
bundler, no `package.json`, no build step. Hosted as-is on **GitHub Pages** from
`main` — a push is a deploy, live in about a minute.

| Surface | Source | Live |
|---|---|---|
| **Public site** — "Grow our own" | `index.html`, `styles.css`, `app.js` | <https://lbsocceracademy.org/> |
| **Coach's dashboard** — internal, sign-in required | `dashboard/` | <https://lbsocceracademy.org/dashboard/> |

The public marketing site is the **root** of the domain; the dashboard lives at
`/dashboard/`. (Before commit `aec9373` it was the other way round and the public
site sat in a `public/` folder. That folder no longer exists — if you find a
reference to `public/app.js` or a root-level dashboard anywhere, it is stale.)

## Layout

```
index.html  styles.css  app.js          public site
dashboard/
  index.html                            dashboard shell + view containers
  src/app.js                            all dashboard logic (~2,100 lines)
  src/styles.css
  src/data.js                           constants + sample data → window.LBSA
integrations/
  google-apps-script.gs                 ← the backend. This one.
assets/        fonts, logos, photos
docs/          generated coach-facing guides (HTML + PDF)
deliverables/  finished flyers / social / guides (PNG outputs, not sources)
```

The two front-ends share **no code**. Their only coupling is the duplicated
configuration below, which must stay in sync by hand.

## Backend

`integrations/google-apps-script.gs` is deployed as a Google Apps Script web app
and writes to a Google Sheet (tabs: Signups, Send a message, Attendance, Events,
Access, Access requests, Finances, Resources, Training use).

> **`deliverables/backend/google-apps-script.gs` is a stale fork — do not deploy
> it.** It is missing access-request logging, usage logging, and the unknown-type
> guard. `integrations/` is the only real copy.

Access resolves to one of three states: **owner** (listed in `CONFIG.OWNER_EMAILS`)
gets full edit; an **approved** non-owner is view-only; anyone else has their
sign-in logged to *Access requests* and the owner is emailed. View-only is enforced
in four places that must agree — the backend route gate, `canEdit()`, the
`.owner-only` CSS class, and the `VIEW_ACTIONS` allowlist in `dashboard/src/app.js`.

### Redeploying it

In the Apps Script editor, always edit the **existing** deployment and choose
**"New version"**.

> **Never click "New deployment".** That mints a new `/exec` URL and instantly
> breaks both front-ends, which hard-code the old one.

## Configuration

All config is plain JavaScript and intentionally public — none of it is secret.
Several values are duplicated across three files and **must match**:

| Value | Public site | Dashboard | Backend |
|---|---|---|---|
| Apps Script `/exec` | `app.js` → `FORM_ENDPOINT` | `dashboard/src/app.js` → `SIGNUPS_URL` | — |
| Google Calendar ID | `app.js` → `GOOGLE_CALENDAR_ID` | `dashboard/src/app.js` → `CALENDAR_ID` | `CONFIG.CALENDAR_ID` |
| OAuth client ID | — | `dashboard/src/app.js` → `GOOGLE_CLIENT_ID` | `CONFIG.CLIENT_ID` |
| Remind class (`@6ee4bkk`) | `app.js` → `REMIND_JOIN_URL`, `REMIND_CLASS_CODE` | `dashboard/src/app.js` → `REMIND_URL` | `CONFIG.REMIND_CODE` |
| Contact email | `app.js` → `CONTACT_EMAIL` | `dashboard/src/app.js` → `CONTACT_EMAIL` | `CONFIG.OFFICE_EMAIL` |

Notes:

- A mismatch between `GOOGLE_CLIENT_ID` and `CONFIG.CLIENT_ID` locks every coach
  out, and it presents as a generic auth error rather than a config one.
- The Google Calendar must be **public** for the site's "add to calendar" button
  to work.
- `FORM_ENDPOINT` empty = the signup form opens an email draft to the office
  instead of collecting automatically.
- Setting `CONFIG.CLIENT_ID` to `""` disables the sign-in gate entirely (open
  access) — only ever while finishing setup.

## Run locally

The **public site** opens by double-clicking `index.html`. The **dashboard** needs
to be served, because Google Sign-In requires an `http(s)` origin:

```
python -m http.server 8137
```

Then `/` for the public site and `/dashboard/` for the dashboard.

## Conventions

- **ES5 only** — `var`, function expressions, string concatenation. No `const`,
  `let`, arrow functions, template literals or classes anywhere. This is
  deliberate, so the files run without a build step.
- Each JS file is one IIFE opening with `"use strict"`. Cross-file sharing goes
  through exactly one global, `window.LBSA`.
- **Do not add a dependency or a build step** without discussing it — zero-build
  is what makes this hostable on Pages and openable locally.
- CSS keeps all colour and spacing as custom properties on `:root`, uses `oklch()`
  throughout, and honours `prefers-reduced-motion` and `pointer: coarse`.
- Several comments exist specifically to stop a deliberate decision being "tidied
  up" — they name the bug they prevent. Don't strip them.
- Commit subjects state the user-visible consequence in the imperative, not the
  mechanism. No `feat:`/`fix:` prefixes.

## Before making the repo public

- **`assets/fonts/OctinSportsRg.*` is a commercial font.** Only publish it if your
  licence permits web embedding; otherwise remove it — the wordmark falls back to
  Montserrat, which is openly licensed.
- **`integrations/google-apps-script.gs` must never hold real Twilio keys.** Keep
  `TWILIO_SID`, `TWILIO_TOKEN` and `TWILIO_FROM` blank here and paste them only
  inside the Apps Script editor.
- Note that anything committed at the repo root is served publicly by GitHub
  Pages. Don't park working notes or drafts there.

## Known-stale files

- `PRODUCT.md` and `DESIGN.md` still describe the sponsor-funded, "free to play"
  model with sponsor tiers and a Four Numbers scoreboard. That model was dropped
  in `acaf3b8` and `4923b00`. **The live code is the specification**, not these
  files. They need refreshing or archiving.
- `deliverables/strategy/DESIGN.md` and `PRODUCT.md` are byte-identical copies of
  those two.
