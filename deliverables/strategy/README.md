# The LB Soccer Academy — website + coach dashboard

Two zero-build, static apps (plain HTML/CSS/JS — no framework, no build step).
Both open by double-click locally and host as-is on **GitHub Pages**.

| App | Local file | On GitHub Pages |
|-----|-----------|-----------------|
| **Public "Every Kid Plays" site** | `public/index.html` | `https://<user>.github.io/<repo>/public/` |
| **Coach's dashboard** | `index.html` (root) | `https://<user>.github.io/<repo>/` |

> Note: with this layout the **dashboard is the site's front page** and the public
> site lives at `/public/`. Want the marketing site at the root URL instead? That's
> a small restructure — ask and it can be swapped.

## Configuration (all in plain JS, safe to be public)

- **Parent alerts (Remind):** `public/app.js` → `REMIND_JOIN_URL`, `REMIND_CLASS_CODE`
  (class `@6ee4bkk`). Dashboard: `src/app.js` → `REMIND_URL`.
- **Session calendar:** `public/app.js` → `GOOGLE_CALENDAR_ID` (make the Google
  calendar **public** for the "Add to calendar" button to work).
- **Signup delivery:** `public/app.js` → `FORM_ENDPOINT` (empty = opens an email
  draft to the office; set it to a Google Apps Script URL to auto-collect).

## Before making the repo public

- **`assets/fonts/OctinSportsRg.*` is a commercial font.** Only publish it if your
  license permits web embedding; otherwise remove it (the wordmark falls back to
  Montserrat, which is open-licensed).
- **`integrations/google-apps-script.gs`** must never contain real Twilio keys when
  committed — keep those blank here and paste them only inside Google Apps Script.

## Run locally

Just open the files, or serve the folder:
`python -m http.server 8137` then visit `/` (dashboard) or `/public/` (site).
